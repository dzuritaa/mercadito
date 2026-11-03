import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal stand-ins for Next.js request APIs used by the auth code.
const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name)
  }),
  headers: async () => new Headers({ "user-agent": "vitest" })
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`REDIRECT ${url}`), { url });
  }
}));

const { prisma } = await import("@/lib/prisma");
const { hashPassword } = await import("@/lib/auth/password");
const { SESSION_COOKIE, hashToken, validateSessionToken, getCurrentUser } = await import(
  "@/lib/auth/session"
);
const { createAccountAction, loginAction, logoutAction } = await import("@/app/auth-actions");

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

/** Runs a server action and returns the URL it redirected to. */
async function redirectOf(action: Promise<unknown>) {
  try {
    await action;
  } catch (error) {
    if (error instanceof Error && "url" in error) {
      return (error as Error & { url: string }).url;
    }
    throw error;
  }
  throw new Error("Expected a redirect");
}

async function createUser(username = "casa", password = "clave-segura-1") {
  return prisma.user.create({
    data: { username, passwordHash: await hashPassword(password) }
  });
}

beforeEach(() => {
  cookieJar.clear();
});

describe("first account", () => {
  it("creates the account, signs it in, and continues to household setup", async () => {
    const url = await redirectOf(
      createAccountAction(
        form({ username: " Casa.Garcia ", password: "clave-segura-1", passwordConfirm: "clave-segura-1" })
      )
    );

    expect(url).toBe("/setup");
    expect((await prisma.user.findFirstOrThrow()).username).toBe("casa.garcia");
    expect(cookieJar.has(SESSION_COOKIE)).toBe(true);
    expect((await getCurrentUser())?.username).toBe("casa.garcia");
  });

  it("rejects mismatched passwords and a second account", async () => {
    expect(
      await redirectOf(
        createAccountAction(form({ username: "casa", password: "clave-segura-1", passwordConfirm: "otra-clave-2" }))
      )
    ).toBe("/setup?error=passwordsDontMatch");

    await createUser();
    expect(
      await redirectOf(
        createAccountAction(form({ username: "otra", password: "clave-segura-1", passwordConfirm: "clave-segura-1" }))
      )
    ).toBe("/login?error=accountExists");
    expect(await prisma.user.count()).toBe(1);
  });
});

describe("sign in", () => {
  it("signs in case-insensitively and returns to the requested page", async () => {
    await createUser();
    const url = await redirectOf(
      loginAction(form({ username: "CASA", password: "clave-segura-1", next: "/recipes?tag=1" }))
    );

    expect(url).toBe("/recipes?tag=1");
    expect(await prisma.session.count()).toBe(1);
  });

  it("gives the same error for a wrong password and an unknown user", async () => {
    await createUser();
    const wrong = await redirectOf(loginAction(form({ username: "casa", password: "nope-nope" })));
    const unknown = await redirectOf(loginAction(form({ username: "nadie", password: "nope-nope" })));

    expect(wrong).toBe("/login?error=invalidCredentials");
    expect(unknown).toBe(wrong);
  });

  it("locks the account after 5 failures, even for the right password", async () => {
    await createUser();

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      expect(await redirectOf(loginAction(form({ username: "casa", password: "wrong-pass" })))).toBe(
        "/login?error=invalidCredentials"
      );
    }

    expect(await redirectOf(loginAction(form({ username: "casa", password: "wrong-pass" })))).toBe(
      "/login?error=accountLocked"
    );
    expect(await redirectOf(loginAction(form({ username: "casa", password: "clave-segura-1" })))).toBe(
      "/login?error=accountLocked"
    );
    expect(await prisma.session.count()).toBe(0);
  });

  it("never redirects to another site after signing in", async () => {
    await createUser();
    const url = await redirectOf(
      loginAction(form({ username: "casa", password: "clave-segura-1", next: "//evil.example" }))
    );
    expect(url).toBe("/");
  });

  it("signs out by deleting the session", async () => {
    await createUser();
    await redirectOf(loginAction(form({ username: "casa", password: "clave-segura-1" })));

    expect(await redirectOf(logoutAction())).toBe("/login?notice=loggedOut");
    expect(await prisma.session.count()).toBe(0);
    expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
  });
});

describe("sessions", () => {
  async function sessionFor(daysLeft: number) {
    const user = await createUser();
    await prisma.session.create({
      data: {
        tokenHash: hashToken("token-1"),
        userId: user.id,
        expiresAt: new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000)
      }
    });
  }

  it("accepts a valid token and stores only its hash", async () => {
    await sessionFor(20);
    const result = await validateSessionToken("token-1");

    expect(result?.session.user.username).toBe("casa");
    expect(result?.renewed).toBe(false);
    expect(await prisma.session.count({ where: { tokenHash: "token-1" } })).toBe(0);
  });

  it("renews sessions that are close to expiring", async () => {
    await sessionFor(3);
    const result = await validateSessionToken("token-1");
    const daysLeft = (result!.session.expiresAt.getTime() - Date.now()) / 86_400_000;

    expect(result?.renewed).toBe(true);
    expect(daysLeft).toBeGreaterThan(29);
  });

  it("rejects and deletes expired sessions, and unknown tokens", async () => {
    await sessionFor(-1);

    expect(await validateSessionToken("token-1")).toBeNull();
    expect(await prisma.session.count()).toBe(0);
    expect(await validateSessionToken("unknown")).toBeNull();
    expect(await validateSessionToken(undefined)).toBeNull();
  });
});

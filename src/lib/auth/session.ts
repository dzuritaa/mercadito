import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "mercadito_session";
export const SESSION_DAYS = 30;
/** Sessions with less than this left are extended on use. */
export const SESSION_RENEW_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 5;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(secure: boolean, expires: Date) {
  return {
    expires,
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure
  };
}

/** HTTPS when served directly over TLS or behind a proxy that says so. */
export async function requestIsSecure() {
  const headerList = await headers();
  return headerList.get("x-forwarded-proto") === "https";
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  const headerList = await headers();

  await prisma.session.create({
    data: {
      expiresAt,
      tokenHash: hashToken(token),
      userAgent: headerList.get("user-agent")?.slice(0, 300) ?? null,
      userId
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(await requestIsSecure(), expiresAt));
}

/**
 * Looks up a session by its raw cookie token. Expired sessions are deleted.
 * Returns the session (with user) and whether it was extended.
 */
export async function validateSessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, username: true, householdId: true } } }
  });

  if (!session) {
    return null;
  }

  const now = Date.now();

  if (session.expiresAt.getTime() <= now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  if (session.expiresAt.getTime() - now < SESSION_RENEW_DAYS * DAY_MS) {
    const expiresAt = new Date(now + SESSION_DAYS * DAY_MS);
    await prisma.session.update({ where: { id: session.id }, data: { expiresAt } });
    return { renewed: true, session: { ...session, expiresAt } };
  }

  return { renewed: false, session };
}

/** The signed-in user for this request, or null (cached per request). */
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const result = await validateSessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  return result?.session.user ?? null;
});

/** For server actions: stop unless someone is signed in. */
export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function hasAnyUser() {
  return (await prisma.user.count()) > 0;
}

/** Only allow same-site relative paths after login. */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }

  return value;
}

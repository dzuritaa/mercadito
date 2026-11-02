"use server";

import { redirect } from "next/navigation";
import {
  hashPassword,
  isAcceptablePassword,
  normalizeUsername,
  verifyPassword
} from "@/lib/auth/password";
import {
  createSession,
  destroyCurrentSession,
  hasAnyUser,
  LOGIN_LOCK_MINUTES,
  LOGIN_MAX_FAILURES,
  requireUser,
  safeNextPath
} from "@/lib/auth/session";
import { getHousehold } from "@/lib/household";
import { prisma } from "@/lib/prisma";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function withError(path: string, message: string, extra: Record<string, string> = {}): never {
  const params = new URLSearchParams({ ...extra, error: message });
  redirect(`${path}?${params.toString()}`);
}

function readNewPassword(formData: FormData, path: string) {
  const password = readString(formData, "password");
  const confirm = readString(formData, "passwordConfirm");

  if (!isAcceptablePassword(password)) {
    withError(path, "passwordTooShort");
  }

  if (password !== confirm) {
    withError(path, "passwordsDontMatch");
  }

  return password;
}

/** First run only: creates the household's account and signs it in. */
export async function createAccountAction(formData: FormData) {
  if (await hasAnyUser()) {
    withError("/login", "accountExists");
  }

  const username = normalizeUsername(readString(formData, "username"));

  if (!username) {
    withError("/setup", "usernameInvalid");
  }

  const password = readNewPassword(formData, "/setup");
  const household = await getHousehold();

  const user = await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction so two first-run requests can't both win.
    if ((await tx.user.count()) > 0) {
      return null;
    }

    return tx.user.create({
      data: {
        householdId: household?.id ?? null,
        passwordHash: await hashPassword(password),
        username
      }
    });
  });

  if (!user) {
    withError("/login", "accountExists");
  }

  await createSession(user.id);
  redirect(household?.setupCompletedAt ? "/" : "/setup");
}

// Spends the same work as a real check when the username doesn't exist.
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

export async function loginAction(formData: FormData) {
  const next = safeNextPath(readString(formData, "next"));
  const extra: Record<string, string> = next !== "/" ? { next } : {};
  const username = normalizeUsername(readString(formData, "username"));
  const password = readString(formData, "password");
  const user = username ? await prisma.user.findUnique({ where: { username } }) : null;

  if (!user) {
    await verifyPassword(password, DUMMY_HASH);
    withError("/login", "invalidCredentials", extra);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    withError("/login", "accountLocked", extra);
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failures = user.failedLoginCount + 1;
    const locked = failures >= LOGIN_MAX_FAILURES;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: locked ? 0 : failures,
        lockedUntil: locked ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000) : null
      }
    });

    withError("/login", locked ? "accountLocked" : "invalidCredentials", extra);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lastLoginAt: new Date(), lockedUntil: null }
  });
  await createSession(user.id);
  redirect(next);
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/login?notice=loggedOut");
}

export async function changePasswordAction(formData: FormData) {
  const current = await requireUser();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: current.id } });

  if (!(await verifyPassword(readString(formData, "currentPassword"), user.passwordHash))) {
    withError("/settings", "currentPasswordWrong");
  }

  const password = readNewPassword(formData, "/settings");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) }
    }),
    // Sign out every other device.
    prisma.session.deleteMany({ where: { userId: user.id } })
  ]);

  await createSession(user.id);
  redirect("/settings?notice=passwordChanged");
}

/**
 * Reset a household account's password from the server.
 *
 *   docker compose exec app npm run user:reset-password
 *   docker compose exec app npm run user:reset-password -- <username>
 *   docker compose exec app npm run user:reset-password -- <username> --password "<new password>"
 *
 * Without --password a random one is generated and printed once.
 * All sessions for the account are signed out and any lockout is cleared.
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword, isAcceptablePassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const positional = process.argv.slice(2).filter((arg, index, all) => {
    return !arg.startsWith("--") && all[index - 1] !== "--password";
  });
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  if (users.length === 0) {
    console.log("No accounts yet. Open the app in a browser to create one.");
    return;
  }

  const username = positional[0]?.trim().toLowerCase() ?? (users.length === 1 ? users[0].username : undefined);

  if (!username) {
    console.log("Several accounts exist. Pass the username:");
    users.forEach((user) => console.log(`  ${user.username}`));
    process.exitCode = 1;
    return;
  }

  const user = users.find((candidate) => candidate.username === username);

  if (!user) {
    console.error(`No account named "${username}".`);
    process.exitCode = 1;
    return;
  }

  const provided = argValue("--password");
  const password = provided ?? randomBytes(12).toString("base64url");

  if (!isAcceptablePassword(password)) {
    console.error("The password must have at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        passwordHash: await hashPassword(password)
      }
    }),
    prisma.session.deleteMany({ where: { userId: user.id } })
  ]);

  console.log(`Password reset for "${user.username}". All devices were signed out.`);

  if (!provided) {
    console.log(`New password: ${password}`);
    console.log("Sign in and change it in Settings → Account.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

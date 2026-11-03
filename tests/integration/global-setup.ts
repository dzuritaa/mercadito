import { execSync } from "node:child_process";

/**
 * Recreates the test database from the migrations before the run.
 * Refuses to touch any database whose name doesn't contain "test".
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) {
    throw new Error("TEST_DATABASE_URL is required for integration tests.");
  }

  const databaseName = new URL(url).pathname.replace(/^\//, "");

  if (!/test/i.test(databaseName)) {
    throw new Error(
      `Refusing to reset "${databaseName}": the test database name must contain "test".`
    );
  }

  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe"
  });
}

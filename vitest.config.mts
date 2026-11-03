import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  console.warn(
    "\n[tests] TEST_DATABASE_URL is not set: running unit tests only. " +
      "See CONTRIBUTING.md to run the database tests.\n"
  );
}

export default defineConfig({
  resolve: {
    alias: { "@": src }
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"]
        }
      },
      ...(testDatabaseUrl
        ? [
            {
              extends: true as const,
              test: {
                name: "integration",
                environment: "node",
                include: ["tests/integration/**/*.test.ts"],
                globalSetup: ["tests/integration/global-setup.ts"],
                setupFiles: ["tests/integration/setup.ts"],
                // One shared database: run files one at a time.
                fileParallelism: false,
                env: { DATABASE_URL: testDatabaseUrl }
              }
            }
          ]
        : [])
    ]
  }
});

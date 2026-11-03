import { afterAll, beforeEach } from "vitest";
import { seedReferenceData } from "../../prisma/reference-data";
import { prisma } from "@/lib/prisma";

/** Empty every table (except migration history) and reload reference data. */
beforeEach(async () => {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length > 0) {
    const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }

  await seedReferenceData(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

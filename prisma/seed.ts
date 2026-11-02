/**
 * Loads the reference data every installation needs (grocery categories and
 * recipe tags). Safe to run repeatedly; the Docker image runs it on start.
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { seedReferenceData } from "./reference-data";

const prisma = new PrismaClient();

seedReferenceData(prisma)
  .then(() => console.log("Reference data is up to date."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

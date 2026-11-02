-- Household settings: one household per installation (self-hosted).

CREATE TYPE "UnitSystem" AS ENUM ('metric', 'imperial');
CREATE TYPE "BudgetPeriod" AS ENUM ('weekly', 'monthly');
CREATE TYPE "MealPattern" AS ENUM (
  'shared_lunch_dinner',
  'separate_lunch_dinner',
  'lunch_only',
  'dinner_only'
);

CREATE TABLE "households" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "city" TEXT,
    "currency" TEXT NOT NULL,
    "default_locale" TEXT NOT NULL DEFAULT 'es',
    "unit_system" "UnitSystem" NOT NULL DEFAULT 'metric',
    "budget_amount" DECIMAL(10,2),
    "budget_period" "BudgetPeriod" NOT NULL DEFAULT 'monthly',
    "plan_days" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "meal_pattern" "MealPattern" NOT NULL DEFAULT 'shared_lunch_dinner',
    "include_vegetarian" BOOLEAN NOT NULL DEFAULT true,
    "expiring_soon_days" INTEGER NOT NULL DEFAULT 5,
    "setup_completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "households_budget_amount_check" CHECK ("budget_amount" IS NULL OR "budget_amount" >= 0),
    CONSTRAINT "households_expiring_soon_days_check" CHECK ("expiring_soon_days" BETWEEN 1 AND 30)
);

CREATE TABLE "household_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "household_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "birth_year" INTEGER,
    "dietary_restrictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "dislikes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "household_members_household_id_idx" ON "household_members"("household_id");

ALTER TABLE "household_members"
  ADD CONSTRAINT "household_members_household_id_fkey"
  FOREIGN KEY ("household_id") REFERENCES "households"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

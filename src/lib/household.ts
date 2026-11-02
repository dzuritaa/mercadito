import { cache } from "react";
import type { Household, HouseholdMember } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type HouseholdWithMembers = Household & { members: HouseholdMember[] };

export const dietaryRestrictionOptions = [
  "vegetarian",
  "vegan",
  "gluten_free",
  "lactose_free",
  "nut_allergy",
  "seafood_allergy",
  "egg_allergy",
  "low_sodium",
  "diabetic"
] as const;

export type DietaryRestriction = (typeof dietaryRestrictionOptions)[number];

export const mealPatternOptions = [
  "shared_lunch_dinner",
  "separate_lunch_dinner",
  "lunch_only",
  "dinner_only"
] as const;

/** ISO weekdays: 1 = Monday … 7 = Sunday. */
export const isoWeekdays = [1, 2, 3, 4, 5, 6, 7] as const;

/** Used before setup and as a safety net for missing values. */
export const householdDefaults = {
  currency: "USD",
  defaultLocale: "es",
  unitSystem: "metric" as const,
  budgetAmount: null as number | null,
  budgetPeriod: "monthly" as const,
  planDays: [1, 2, 3, 4, 5],
  mealPattern: "shared_lunch_dinner" as const,
  includeVegetarian: true,
  expiringSoonDays: 5
};

/** The installation's household (cached per request). */
export const getHousehold = cache(async (): Promise<HouseholdWithMembers | null> => {
  return prisma.household.findFirst({
    include: {
      members: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    },
    orderBy: { createdAt: "asc" }
  });
});

export async function isSetupComplete() {
  const household = await getHousehold();
  return Boolean(household?.setupCompletedAt);
}

/** Settings the rest of the app reads, with defaults applied. */
export const getHouseholdSettings = cache(async () => {
  const household = await getHousehold();
  const budgetAmount = household?.budgetAmount ? household.budgetAmount.toNumber() : null;
  const budgetPeriod = household?.budgetPeriod ?? householdDefaults.budgetPeriod;

  return {
    countryCode: household?.countryCode ?? undefined,
    currency: household?.currency ?? householdDefaults.currency,
    unitSystem: household?.unitSystem ?? householdDefaults.unitSystem,
    budgetAmount,
    budgetPeriod,
    /** Budget expressed per month, so monthly reports can compare against it. */
    monthlyBudget:
      budgetAmount === null
        ? null
        : budgetPeriod === "weekly"
          ? Math.round(((budgetAmount * 52) / 12) * 100) / 100
          : budgetAmount,
    planDays:
      household?.planDays && household.planDays.length > 0
        ? [...household.planDays].sort((a, b) => a - b)
        : householdDefaults.planDays,
    mealPattern: household?.mealPattern ?? householdDefaults.mealPattern,
    includeVegetarian: household?.includeVegetarian ?? householdDefaults.includeVegetarian,
    expiringSoonDays: household?.expiringSoonDays ?? householdDefaults.expiringSoonDays,
    /** True when every member follows a vegetarian or vegan diet. */
    allVegetarian:
      Boolean(household?.members.length) &&
      household!.members.every((member) =>
        member.dietaryRestrictions.some((r) => r === "vegetarian" || r === "vegan")
      )
  };
});

export type HouseholdSettings = Awaited<ReturnType<typeof getHouseholdSettings>>;

export function memberAge(birthYear: number | null, now = new Date()) {
  return birthYear ? now.getFullYear() - birthYear : null;
}

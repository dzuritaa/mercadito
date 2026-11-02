import { Prisma, type MealPattern, type MealType } from "@prisma/client";
import { addDays, formatDateInput, startOfToday } from "@/lib/inventory";
import { pickLocalized, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { weekdayName } from "@/lib/i18n/text";
import { getHouseholdSettings, type HouseholdSettings } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import { getRecipeMatches, type RecipeMatch } from "@/lib/recipe-matching";

export const VEGETARIAN_TAG = "Vegetarian";

export const mealPlanInclude = Prisma.validator<Prisma.MealPlanInclude>()({
  items: {
    include: {
      recipe: {
        include: {
          rating: true,
          tags: {
            include: {
              tag: true
            },
            orderBy: {
              tag: {
                name: "asc"
              }
            }
          }
        }
      }
    },
    orderBy: {
      plannedDate: "asc"
    }
  }
});

export type MealPlanDetail = Prisma.MealPlanGetPayload<{
  include: typeof mealPlanInclude;
}>;

export type MealPlannerPageData = Awaited<ReturnType<typeof getMealPlannerPageData>>;

type PlannerRecipe = {
  description: string | null;
  id: string;
  missingRequiredCount: number;
  name: string;
  score: number;
  servings: number;
  tags: string[];
};

function mondayFor(date: Date) {
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = utcDate.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  utcDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);
  return utcDate;
}

export function currentWeekStartDate() {
  return mondayFor(startOfToday());
}

export function parseWeekStartDate(value?: string) {
  if (!value) {
    return currentWeekStartDate();
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    return currentWeekStartDate();
  }

  return mondayFor(parsed);
}

export type PlanWarningKey = keyof Dictionary["mealPlanner"]["warnings"];

/** Last planned calendar day for a week, given the household's plan days. */
export function weekEndDate(weekStartDate: Date, planDays: number[] = [1, 2, 3, 4, 5]) {
  return addDays(weekStartDate, Math.max(...planDays) - 1);
}

const mealTypesByPattern: Record<MealPattern, MealType[]> = {
  shared_lunch_dinner: ["lunch_and_dinner"],
  separate_lunch_dinner: ["lunch", "dinner"],
  lunch_only: ["lunch"],
  dinner_only: ["dinner"]
};

/** Every (day, meal) slot the household wants planned for a week. */
export function planSlots(
  weekStartDate: Date,
  planDays: number[],
  mealPattern: MealPattern
) {
  return planDays.flatMap((day) =>
    mealTypesByPattern[mealPattern].map((mealType) => ({
      date: addDays(weekStartDate, day - 1),
      mealType
    }))
  );
}

/** Planned dates are stored as UTC calendar dates. */
export function weekdayLabel(date: Date, locale: Locale = "en") {
  return weekdayName(locale, date);
}

function recipeFromMatch(match: RecipeMatch): PlannerRecipe {
  return {
    description: match.recipe.description,
    id: match.recipe.id,
    missingRequiredCount: match.missingRequiredCount,
    name: match.recipe.name,
    score: match.score,
    servings: match.recipe.servings,
    tags: match.recipe.tags
  };
}

function hasVegetarianTag(recipe: PlannerRecipe) {
  return recipe.tags.includes(VEGETARIAN_TAG);
}

function planWarnings(
  plan: MealPlanDetail | null,
  vegetarianRecipeAvailable: boolean,
  settings: HouseholdSettings,
  slotCount: number
) {
  const warnings: PlanWarningKey[] = [];
  const wantsVegetarian = settings.includeVegetarian || settings.allVegetarian;

  if (wantsVegetarian && !vegetarianRecipeAvailable) {
    warnings.push("noVegetarianAvailable");
  } else if (
    wantsVegetarian &&
    plan &&
    !plan.items.some((item) =>
      item.recipe.tags.some((tagMap) => tagMap.tag.name === VEGETARIAN_TAG)
    )
  ) {
    warnings.push("noVegetarianInPlan");
  }

  if (plan && plan.items.length < slotCount) {
    warnings.push("fewerMeals");
  }

  if (plan && new Set(plan.items.map((item) => item.recipeId)).size < plan.items.length) {
    warnings.push("recipesRepeat");
  }

  return warnings;
}

function choosePlannerRecipes(
  matches: RecipeMatch[],
  slotCount: number,
  settings: HouseholdSettings
) {
  const ranked = matches.map(recipeFromMatch);
  const vegetarianRecipeAvailable = ranked.some(hasVegetarianTag);
  // A fully vegetarian household only gets vegetarian recipes.
  const candidates = settings.allVegetarian ? ranked.filter(hasVegetarianTag) : ranked;
  const unique = candidates.slice(0, slotCount);

  if (
    settings.includeVegetarian &&
    !settings.allVegetarian &&
    vegetarianRecipeAvailable &&
    !unique.some(hasVegetarianTag)
  ) {
    const vegetarianRecipe = candidates.find(hasVegetarianTag);

    if (vegetarianRecipe) {
      if (unique.length < slotCount) {
        unique.push(vegetarianRecipe);
      } else {
        unique[unique.length - 1] = vegetarianRecipe;
      }
    }
  }

  // Fill every slot; with fewer recipes than slots, recipes repeat in rank order.
  const recipes =
    unique.length === 0
      ? []
      : Array.from({ length: slotCount }, (_, index) => unique[index % unique.length]);

  return { recipes, vegetarianRecipeAvailable };
}

async function findDisplayPlan(weekStartDate: Date) {
  const [approvedPlan, draftPlan] = await Promise.all([
    prisma.mealPlan.findFirst({
      where: {
        status: "approved",
        weekStartDate
      },
      include: mealPlanInclude,
      orderBy: {
        updatedAt: "desc"
      }
    }),
    prisma.mealPlan.findFirst({
      where: {
        status: "draft",
        weekStartDate
      },
      include: mealPlanInclude,
      orderBy: {
        updatedAt: "desc"
      }
    })
  ]);

  return approvedPlan ?? draftPlan;
}

export async function getMealPlannerPageData(
  weekStartValue: string | undefined,
  locale: Locale
) {
  const weekStartDate = parseWeekStartDate(weekStartValue);
  const [plan, matches, activeRecipeRows, settings] = await Promise.all([
    findDisplayPlan(weekStartDate),
    getRecipeMatches({ locale }),
    prisma.recipe.findMany({
      where: {
        isActive: true
      },
      include: {
        tags: {
          include: {
            tag: true
          },
          orderBy: {
            tag: {
              name: "asc"
            }
          }
        }
      }
    }),
    getHouseholdSettings()
  ]);
  const slotCount = planSlots(weekStartDate, settings.planDays, settings.mealPattern).length;
  const activeRecipes = activeRecipeRows
    .map((recipe) => ({
      ...recipe,
      displayName: pickLocalized(locale, recipe.nameEn, recipe.nameEs)
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, locale));
  const vegetarianRecipeAvailable = activeRecipes.some((recipe) =>
    recipe.tags.some((tagMap) => tagMap.tag.name === VEGETARIAN_TAG)
  );

  return {
    activeRecipes,
    matches,
    plan,
    settings,
    warnings: planWarnings(plan, vegetarianRecipeAvailable, settings, slotCount),
    weekStartDate
  };
}

export async function generateWeeklyMealPlan(
  weekStartValue: string | undefined,
  locale: Locale
) {
  const t = getDictionary(locale);
  const weekStartDate = parseWeekStartDate(weekStartValue);
  const existingApprovedPlan = await prisma.mealPlan.findFirst({
    where: {
      status: "approved",
      weekStartDate
    },
    select: {
      id: true
    }
  });

  if (existingApprovedPlan) {
    return {
      redirectPath: mealPlannerRedirectPath(
        "weekAlreadyApproved",
        "error",
        weekStartDate
      )
    };
  }

  const [matches, settings] = await Promise.all([
    getRecipeMatches({ locale }),
    getHouseholdSettings()
  ]);
  const slots = planSlots(weekStartDate, settings.planDays, settings.mealPattern);
  const { recipes, vegetarianRecipeAvailable } = choosePlannerRecipes(
    matches,
    slots.length,
    settings
  );
  const wantsVegetarian = settings.includeVegetarian || settings.allVegetarian;

  if (recipes.length === 0) {
    return {
      redirectPath: mealPlannerRedirectPath(
        "addRecipesFirst",
        "error",
        weekStartDate
      )
    };
  }

  const plan = await prisma.$transaction(async (tx) => {
    await tx.mealPlan.deleteMany({
      where: {
        status: "draft",
        weekStartDate
      }
    });

    return tx.mealPlan.create({
      data: {
        notes:
          wantsVegetarian && !vegetarianRecipeAvailable
            ? t.mealPlanner.generatedNoteNoVegetarian
            : null,
        status: "draft",
        weekStartDate,
        items: {
          create: recipes.map((recipe, index) => ({
            mealType: slots[index].mealType,
            notes:
              recipe.missingRequiredCount > 0
                ? t.mealPlanner.generatedNoteMissing(recipe.missingRequiredCount)
                : null,
            plannedDate: slots[index].date,
            recipeId: recipe.id,
            servingsPlanned: recipe.servings,
            status: "suggested"
          }))
        }
      }
    });
  });

  return {
    plan,
    redirectPath: mealPlannerRedirectPath("draftGenerated", "notice", weekStartDate)
  };
}

export function mealPlannerRedirectPath(
  message: string,
  type: "notice" | "error",
  weekStartDate: Date
) {
  return `/meal-planner?weekStart=${formatDateInput(weekStartDate)}&${type}=${encodeURIComponent(
    message
  )}`;
}

export async function getMealPlanById(id: string) {
  return prisma.mealPlan.findUnique({
    where: {
      id
    },
    include: mealPlanInclude
  });
}

export async function getDashboardMealPlan() {
  return findDisplayPlan(currentWeekStartDate());
}

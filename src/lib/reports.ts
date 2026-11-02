import { PurchaseType } from "@prisma/client";
import { intlLocale, pickLocalized, type Locale } from "@/lib/i18n/config";
import { getHouseholdSettings } from "@/lib/household";
import { prisma } from "@/lib/prisma";


export const purchaseTypeOptions = [
  { label: "Grocery", value: "grocery" },
  { label: "Online delivery", value: "online_delivery" },
  { label: "Eating out", value: "eating_out" },
  { label: "Household", value: "household" }
] as const;

export type PurchaseTypeValue = (typeof purchaseTypeOptions)[number]["value"];

export type ReportsMonth = {
  end: Date;
  inputValue: string;
  label: string;
  start: Date;
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

export function parseReportsMonth(value?: string, locale: Locale = "en"): ReportsMonth {
  const now = new Date();
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : now.getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();
  const safeYear = Number.isInteger(year) ? year : now.getFullYear();
  const safeMonthIndex =
    Number.isInteger(monthIndex) && monthIndex >= 0 && monthIndex <= 11
      ? monthIndex
      : now.getMonth();
  const start = new Date(Date.UTC(safeYear, safeMonthIndex, 1));
  const end = new Date(Date.UTC(safeYear, safeMonthIndex + 1, 1));

  return {
    end,
    inputValue: `${safeYear}-${String(safeMonthIndex + 1).padStart(2, "0")}`,
    label: capitalize(
      start.toLocaleDateString(intlLocale(locale), {
        month: "long",
        timeZone: "UTC",
        year: "numeric"
      })
    ),
    start
  };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function purchaseTypeLabel(type: PurchaseTypeValue | PurchaseType) {
  return purchaseTypeOptions.find((option) => option.value === type)?.label ?? type;
}

function decimalToNumber(value: { toNumber: () => number } | null) {
  return value?.toNumber() ?? 0;
}

function samePurchaseType(type: PurchaseType, values: PurchaseType[]) {
  return values.includes(type);
}

function summarizePurchases(
  purchases: { purchaseType: PurchaseType; totalAmount: { toNumber: () => number } | null }[],
  monthlyBudget: number | null
) {
  const totalSpent = purchases.reduce(
    (sum, purchase) => sum + decimalToNumber(purchase.totalAmount),
    0
  );
  const grocerySpent = purchases
    .filter((purchase) =>
      samePurchaseType(purchase.purchaseType, [
        PurchaseType.grocery,
        PurchaseType.online_delivery
      ])
    )
    .reduce((sum, purchase) => sum + decimalToNumber(purchase.totalAmount), 0);
  const eatingOutSpent = purchases
    .filter((purchase) => purchase.purchaseType === PurchaseType.eating_out)
    .reduce((sum, purchase) => sum + decimalToNumber(purchase.totalAmount), 0);
  const householdSpent = purchases
    .filter((purchase) => purchase.purchaseType === PurchaseType.household)
    .reduce((sum, purchase) => sum + decimalToNumber(purchase.totalAmount), 0);
  const hasBudget = monthlyBudget !== null && monthlyBudget > 0;

  return {
    budget: {
      grocerySpent,
      /** Null when the household has not set a budget. */
      target: hasBudget ? monthlyBudget : null,
      remaining: hasBudget ? monthlyBudget - grocerySpent : null,
      usedPercent: hasBudget
        ? Math.min(100, Math.round((grocerySpent / monthlyBudget) * 100))
        : 0
    },
    totals: {
      eatingOutSpent,
      grocerySpent,
      householdSpent,
      totalSpent
    }
  };
}

function summarizeNutrition(
  cookedMeals: {
    recipe: {
      caloriesPerServing: { toNumber: () => number } | null;
      carbsGPerServing: { toNumber: () => number } | null;
      fatGPerServing: { toNumber: () => number } | null;
      id: string;
      nameEn: string | null;
      nameEs: string | null;
      proteinGPerServing: { toNumber: () => number } | null;
    };
    servingsCooked: number;
  }[],
  locale: Locale
) {
  let trackedServings = 0;
  let totalServings = 0;
  let missingNutritionCount = 0;
  const totals = {
    calories: 0,
    carbsG: 0,
    fatG: 0,
    proteinG: 0
  };
  const recipeMap = new Map<
    string,
    {
      cookedCount: number;
      hasNutrition: boolean;
      name: string;
      servings: number;
    }
  >();

  for (const meal of cookedMeals) {
    const servings = meal.servingsCooked;
    const recipe = meal.recipe;
    const calories = decimalToNumber(recipe.caloriesPerServing);
    const proteinG = decimalToNumber(recipe.proteinGPerServing);
    const carbsG = decimalToNumber(recipe.carbsGPerServing);
    const fatG = decimalToNumber(recipe.fatGPerServing);
    const hasNutrition =
      recipe.caloriesPerServing !== null &&
      recipe.proteinGPerServing !== null &&
      recipe.carbsGPerServing !== null &&
      recipe.fatGPerServing !== null;
    const existing = recipeMap.get(recipe.id) ?? {
      cookedCount: 0,
      hasNutrition,
      name: pickLocalized(locale, recipe.nameEn, recipe.nameEs),
      servings: 0
    };

    existing.cookedCount += 1;
    existing.servings += servings;
    existing.hasNutrition = existing.hasNutrition && hasNutrition;
    recipeMap.set(recipe.id, existing);
    totalServings += servings;

    if (!hasNutrition) {
      missingNutritionCount += 1;
      continue;
    }

    trackedServings += servings;
    totals.calories += calories * servings;
    totals.proteinG += proteinG * servings;
    totals.carbsG += carbsG * servings;
    totals.fatG += fatG * servings;
  }

  return {
    averages:
      trackedServings > 0
        ? {
            calories: Math.round(totals.calories / trackedServings),
            carbsG: Math.round((totals.carbsG / trackedServings) * 10) / 10,
            fatG: Math.round((totals.fatG / trackedServings) * 10) / 10,
            proteinG: Math.round((totals.proteinG / trackedServings) * 10) / 10
          }
        : null,
    cookedMealCount: cookedMeals.length,
    missingNutritionCount,
    topRecipes: Array.from(recipeMap.values())
      .sort((first, second) => second.cookedCount - first.cookedCount)
      .slice(0, 5),
    totalServings,
    trackedServings
  };
}

export async function getDashboardSpendingData(locale: Locale = "en") {
  const month = parseReportsMonth(undefined, locale);
  const purchases = await prisma.purchase.findMany({
    where: {
      purchaseDate: {
        gte: month.start,
        lt: month.end
      }
    },
    select: {
      purchaseType: true,
      totalAmount: true
    }
  });
  const { monthlyBudget } = await getHouseholdSettings();
  const summary = summarizePurchases(purchases, monthlyBudget);

  return {
    ...summary,
    month,
    purchaseCount: purchases.length
  };
}

export async function getReportsPageData(monthValue: string | undefined, locale: Locale) {
  const month = parseReportsMonth(monthValue, locale);

  const [
    stores,
    categories,
    groceryItems,
    purchases,
    recipeUsage,
    cookedMeals,
    expiringItems
  ] = await Promise.all([
    prisma.store.findMany({
      where: { active: true },
      orderBy: { name: "asc" }
    }),
    prisma.groceryCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.groceryItem.findMany({
      include: {
        category: true
      },
      orderBy: {
        name: "asc"
      }
    }),
    prisma.purchase.findMany({
      where: {
        purchaseDate: {
          gte: month.start,
          lt: month.end
        }
      },
      include: {
        items: {
          include: {
            category: true,
            groceryItem: {
              include: {
                category: true
              }
            }
          },
          orderBy: { createdAt: "desc" }
        },
        store: true
      },
      orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }]
    }),
    prisma.cookedMeal.groupBy({
      by: ["recipeId"],
      where: {
        cookedAt: {
          gte: month.start,
          lt: month.end
        }
      },
      _count: {
        recipeId: true
      },
      orderBy: {
        _count: {
          recipeId: "desc"
        }
      },
      take: 5
    }),
    prisma.cookedMeal.findMany({
      where: {
        cookedAt: {
          gte: month.start,
          lt: month.end
        }
      },
      include: {
        recipe: {
          select: {
            caloriesPerServing: true,
            carbsGPerServing: true,
            fatGPerServing: true,
            id: true,
            nameEn: true,
            nameEs: true,
            proteinGPerServing: true
          }
        }
      },
      orderBy: {
        cookedAt: "desc"
      }
    }),
    prisma.inventoryItem.findMany({
      where: {
        expirationDate: {
          gte: month.start,
          lt: month.end
        },
        status: "available"
      },
      include: {
        groceryItem: true
      },
      orderBy: [{ expirationDate: "asc" }, { createdAt: "asc" }],
      take: 8
    })
  ]);

  const recipeIds = recipeUsage.map((usage) => usage.recipeId);
  const recipes =
    recipeIds.length > 0
      ? await prisma.recipe.findMany({
          where: {
            id: {
              in: recipeIds
            }
          }
        })
      : [];
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  const { monthlyBudget } = await getHouseholdSettings();
  const spendingSummary = summarizePurchases(purchases, monthlyBudget);
  const nutritionSummary = summarizeNutrition(cookedMeals, locale);

  const categoryTotals = new Map<string, { categoryName: string; total: number }>();
  for (const purchase of purchases) {
    for (const item of purchase.items) {
      const totalPrice = decimalToNumber(item.totalPrice);

      if (totalPrice <= 0) {
        continue;
      }

      const category = item.category ?? item.groceryItem?.category ?? null;
      const key = category?.id ?? "uncategorized";
      const existing = categoryTotals.get(key) ?? {
        categoryName: category?.name ?? "Uncategorized",
        total: 0
      };
      existing.total += totalPrice;
      categoryTotals.set(key, existing);
    }
  }

  return {
    budget: spendingSummary.budget,
    categories,
    categoryTotals: Array.from(categoryTotals.values()).sort(
      (first, second) => second.total - first.total
    ),
    expiringItems,
    groceryItems,
    month,
    nutritionSummary,
    purchases,
    recipeUsage: recipeUsage.map((usage) => ({
      count: usage._count.recipeId,
      recipe: recipeById.get(usage.recipeId)
    })),
    stores,
    totals: spendingSummary.totals
  };
}

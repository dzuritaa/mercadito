import { Prisma } from "@prisma/client";
import { formatRecipeQuantity } from "@/lib/recipes";
import { pickLocalized, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { prisma } from "@/lib/prisma";

const cookedMealInclude = Prisma.validator<Prisma.CookedMealInclude>()({
  ingredients: {
    include: {
      groceryItem: true
    },
    orderBy: {
      createdAt: "asc"
    }
  },
  mealPlanItem: true,
  recipe: true
});

const cookableRecipeInclude = Prisma.validator<Prisma.RecipeInclude>()({
  ingredients: {
    include: {
      groceryItem: true
    },
    orderBy: {
      sortOrder: "asc"
    }
  }
});

export type CookedMealDetail = Prisma.CookedMealGetPayload<{
  include: typeof cookedMealInclude;
}>;

export type MarkRecipeCookedInput = {
  mealPlanItemId?: string;
  notes?: string;
  recipeId: string;
  servingsCooked: number;
  locale?: Locale;
};

export type MarkRecipeCookedResult = {
  cookedMealId: string;
  deductedCount: number;
  manualReviewCount: number;
  partialCount: number;
  recipeId: string;
};

type CookableRecipe = Prisma.RecipeGetPayload<{
  include: typeof cookableRecipeInclude;
}>;

type CookableIngredient = CookableRecipe["ingredients"][number];

type DeductionStatus = Prisma.CookedMealIngredientCreateManyInput["deductionStatus"];

function scaleQuantity(
  quantity: Prisma.Decimal,
  recipeServings: number,
  servingsCooked: number
) {
  return quantity
    .mul(new Prisma.Decimal(servingsCooked))
    .div(new Prisma.Decimal(recipeServings))
    .toDecimalPlaces(2);
}

function compareInventoryDates(
  a: { createdAt: Date; expirationDate: Date | null },
  b: { createdAt: Date; expirationDate: Date | null }
) {
  if (a.expirationDate && b.expirationDate) {
    return a.expirationDate.getTime() - b.expirationDate.getTime();
  }

  if (a.expirationDate) {
    return -1;
  }

  if (b.expirationDate) {
    return 1;
  }

  return a.createdAt.getTime() - b.createdAt.getTime();
}

function ingredientManualReviewNotes(ingredient: CookableIngredient, t: Dictionary) {
  if (ingredient.optional) {
    return t.cooking.noteOptional;
  }

  if (!ingredient.quantity || !ingredient.unit) {
    return t.cooking.noteNoExact;
  }

  return t.cooking.noteNoInventory;
}

async function deductIngredient(
  tx: Prisma.TransactionClient,
  recipe: CookableRecipe,
  ingredient: CookableIngredient,
  servingsCooked: number,
  locale: Locale
) {
  const t = getDictionary(locale);
  const requestedQuantity =
    ingredient.quantity && recipe.servings > 0
      ? scaleQuantity(ingredient.quantity, recipe.servings, servingsCooked)
      : null;
  const requestedUnit = ingredient.unit;

  if (ingredient.optional || !requestedQuantity || !requestedUnit) {
    return {
      deductedQuantity: null,
      notes: ingredientManualReviewNotes(ingredient, t),
      requestedQuantity,
      requestedUnit,
      status: "manual_review" as DeductionStatus
    };
  }

  const inventoryItems = (
    await tx.inventoryItem.findMany({
      where: {
        groceryItemId: ingredient.groceryItemId,
        quantity: {
          not: null
        },
        status: "available",
        unit: requestedUnit
      },
      orderBy: {
        createdAt: "asc"
      }
    })
  ).sort(compareInventoryDates);

  let remainingQuantity = requestedQuantity;
  let deductedQuantity = new Prisma.Decimal(0);

  for (const inventoryItem of inventoryItems) {
    if (!inventoryItem.quantity || remainingQuantity.lessThanOrEqualTo(0)) {
      continue;
    }

    const deduction = Prisma.Decimal.min(inventoryItem.quantity, remainingQuantity);
    const nextQuantity = inventoryItem.quantity.minus(deduction);

    await tx.inventoryItem.update({
      where: {
        id: inventoryItem.id
      },
      data: {
        quantity: nextQuantity,
        status: nextQuantity.lessThanOrEqualTo(0) ? "used" : "available"
      }
    });

    await tx.inventoryTransaction.create({
      data: {
        groceryItemId: ingredient.groceryItemId,
        inventoryItemId: inventoryItem.id,
        notes: t.cooking.transactionNote(pickLocalized(locale, recipe.nameEn, recipe.nameEs)),
        quantity: deduction,
        source: "recipe_cooked",
        transactionType: "used",
        unit: requestedUnit
      }
    });

    deductedQuantity = deductedQuantity.plus(deduction);
    remainingQuantity = remainingQuantity.minus(deduction);
  }

  if (deductedQuantity.equals(0)) {
    return {
      deductedQuantity: null,
      notes: ingredientManualReviewNotes(ingredient, t),
      requestedQuantity,
      requestedUnit,
      status: "manual_review" as DeductionStatus
    };
  }

  if (deductedQuantity.lessThan(requestedQuantity)) {
    return {
      deductedQuantity,
      notes: t.cooking.notePartial(formatRecipeQuantity(deductedQuantity, requestedUnit, null, t)),
      requestedQuantity,
      requestedUnit,
      status: "partial" as DeductionStatus
    };
  }

  return {
    deductedQuantity,
    notes: null,
    requestedQuantity,
    requestedUnit,
    status: "deducted" as DeductionStatus
  };
}

export async function markRecipeCooked({
  mealPlanItemId,
  notes,
  recipeId,
  servingsCooked,
  locale = "en"
}: MarkRecipeCookedInput): Promise<MarkRecipeCookedResult> {
  if (!recipeId) {
    throw new Error("recipeMissing");
  }

  if (!Number.isInteger(servingsCooked) || servingsCooked < 1) {
    throw new Error("servingsCookedMin");
  }

  return prisma.$transaction(async (tx) => {
    if (mealPlanItemId) {
      const mealPlanItem = await tx.mealPlanItem.findUnique({
        where: {
          id: mealPlanItemId
        },
        select: {
          recipeId: true
        }
      });

      if (!mealPlanItem || mealPlanItem.recipeId !== recipeId) {
        throw new Error("mealPlanItemMismatch");
      }
    }

    const recipe = await tx.recipe.findUnique({
      where: {
        id: recipeId
      },
      include: cookableRecipeInclude
    });

    if (!recipe) {
      throw new Error("recipeNotFound");
    }

    const cookedMeal = await tx.cookedMeal.create({
      data: {
        mealPlanItemId,
        notes,
        recipeId,
        servingsCooked
      }
    });

    const ingredientRows: Prisma.CookedMealIngredientCreateManyInput[] = [];

    for (const ingredient of recipe.ingredients) {
      const deduction = await deductIngredient(tx, recipe, ingredient, servingsCooked, locale);

      ingredientRows.push({
        cookedMealId: cookedMeal.id,
        deductedQuantity: deduction.deductedQuantity,
        deductionStatus: deduction.status,
        groceryItemId: ingredient.groceryItemId,
        ingredientName: ingredient.groceryItem.name,
        notes: deduction.notes,
        recipeIngredientId: ingredient.id,
        requestedQuantity: deduction.requestedQuantity,
        requestedUnit: deduction.requestedUnit
      });
    }

    if (ingredientRows.length > 0) {
      await tx.cookedMealIngredient.createMany({
        data: ingredientRows
      });
    }

    if (mealPlanItemId) {
      await tx.mealPlanItem.update({
        where: {
          id: mealPlanItemId
        },
        data: {
          status: "cooked"
        }
      });
    }

    return {
      cookedMealId: cookedMeal.id,
      deductedCount: ingredientRows.filter(
        (ingredient) => ingredient.deductionStatus === "deducted"
      ).length,
      manualReviewCount: ingredientRows.filter(
        (ingredient) => ingredient.deductionStatus === "manual_review"
      ).length,
      partialCount: ingredientRows.filter(
        (ingredient) => ingredient.deductionStatus === "partial"
      ).length,
      recipeId
    };
  });
}

export async function getRecentCookedMeals(limit = 5) {
  return prisma.cookedMeal.findMany({
    include: cookedMealInclude,
    orderBy: {
      cookedAt: "desc"
    },
    take: limit
  });
}

export async function getRecipeCookedMeals(recipeId: string, limit = 5) {
  return prisma.cookedMeal.findMany({
    where: {
      recipeId
    },
    include: cookedMealInclude,
    orderBy: {
      cookedAt: "desc"
    },
    take: limit
  });
}

export function cookedMealReviewCount(meal: CookedMealDetail) {
  return meal.ingredients.filter(
    (ingredient) => ingredient.deductionStatus !== "deducted"
  ).length;
}

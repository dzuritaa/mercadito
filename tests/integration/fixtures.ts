import type { MealPattern, MealPlanItemStatus } from "@prisma/client";
import { addDays, normalizeGroceryName, startOfToday } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

type HouseholdOptions = {
  budgetAmount?: number | null;
  budgetPeriod?: "weekly" | "monthly";
  includeVegetarian?: boolean;
  mealPattern?: MealPattern;
  members?: { name: string; dietaryRestrictions?: string[] }[];
  planDays?: number[];
  expiringSoonDays?: number;
};

export async function createHousehold(options: HouseholdOptions = {}) {
  return prisma.household.create({
    data: {
      name: "Test household",
      countryCode: "EC",
      currency: "USD",
      budgetAmount: options.budgetAmount ?? null,
      budgetPeriod: options.budgetPeriod ?? "monthly",
      includeVegetarian: options.includeVegetarian ?? true,
      mealPattern: options.mealPattern ?? "shared_lunch_dinner",
      planDays: options.planDays ?? [1, 2, 3, 4, 5],
      expiringSoonDays: options.expiringSoonDays ?? 5,
      setupCompletedAt: new Date(),
      members: {
        create: (options.members ?? []).map((member, index) => ({
          name: member.name,
          dietaryRestrictions: member.dietaryRestrictions ?? [],
          sortOrder: index
        }))
      }
    }
  });
}

export async function groceryItem(name: string, names: { en?: string; es?: string } = {}) {
  return prisma.groceryItem.upsert({
    where: { normalizedName: normalizeGroceryName(name) },
    update: {},
    create: {
      name,
      normalizedName: normalizeGroceryName(name),
      nameEn: names.en ?? null,
      nameEs: names.es ?? null
    }
  });
}

type IngredientInput = {
  item: string;
  quantity?: string;
  unit?: string;
  optional?: boolean;
  quantityDescription?: string;
};

type RecipeInput = {
  nameEn?: string;
  nameEs?: string;
  servings?: number;
  tags?: string[];
  rating?: number;
  wouldCookAgain?: boolean;
  ingredients: IngredientInput[];
  substitutions?: { original: string; substitute: string }[];
};

export async function createRecipe(input: RecipeInput) {
  const tags = await prisma.recipeTag.findMany({ where: { name: { in: input.tags ?? [] } } });
  const ingredients = [];

  for (const [index, ingredient] of input.ingredients.entries()) {
    const item = await groceryItem(ingredient.item);
    ingredients.push({
      groceryItemId: item.id,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      optional: ingredient.optional ?? false,
      quantityDescription: ingredient.quantityDescription,
      sortOrder: index + 1
    });
  }

  const substitutions = [];

  for (const substitution of input.substitutions ?? []) {
    const original = await groceryItem(substitution.original);
    const substitute = await groceryItem(substitution.substitute);
    substitutions.push({
      originalGroceryItemId: original.id,
      substituteGroceryItemId: substitute.id
    });
  }

  return prisma.recipe.create({
    data: {
      nameEn: input.nameEn ?? null,
      nameEs: input.nameEs ?? null,
      servings: input.servings ?? 4,
      ingredients: { create: ingredients },
      steps: { create: [{ stepNumber: 1, instructionEn: "Cook it." }] },
      tags: { create: tags.map((tag) => ({ tagId: tag.id })) },
      substitutions: substitutions.length ? { create: substitutions } : undefined,
      rating:
        input.rating !== undefined || input.wouldCookAgain !== undefined
          ? { create: { rating: input.rating ?? null, wouldCookAgain: input.wouldCookAgain ?? null } }
          : undefined
    }
  });
}

type InventoryInput = {
  quantity?: string;
  unit?: string;
  quantityDescription?: string;
  expiresInDays?: number;
  createdAt?: Date;
};

export async function stock(itemName: string, input: InventoryInput) {
  const item = await groceryItem(itemName);

  return prisma.inventoryItem.create({
    data: {
      groceryItemId: item.id,
      quantity: input.quantity,
      unit: input.unit,
      quantityDescription: input.quantityDescription,
      expirationDate:
        input.expiresInDays === undefined ? null : addDays(startOfToday(), input.expiresInDays),
      createdAt: input.createdAt
    }
  });
}

/** An approved plan with the given recipes, one per day starting Monday. */
export async function approvedPlan(
  weekStartDate: Date,
  recipeIds: string[],
  status: MealPlanItemStatus = "planned"
) {
  return prisma.mealPlan.create({
    data: {
      status: "approved",
      weekStartDate,
      items: {
        create: recipeIds.map((recipeId, index) => ({
          recipeId,
          plannedDate: addDays(weekStartDate, index),
          mealType: "lunch_and_dinner",
          servingsPlanned: 4,
          status
        }))
      }
    }
  });
}

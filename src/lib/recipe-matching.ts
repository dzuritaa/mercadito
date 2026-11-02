import { Prisma } from "@prisma/client";
import {
  addDays,
  daysUntilLabel,
  startOfToday
} from "@/lib/inventory";
import { getHouseholdSettings } from "@/lib/household";
import { pickLocalized, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { groceryName } from "@/lib/i18n/text";
import { prisma } from "@/lib/prisma";
import { formatRecipeQuantity } from "@/lib/recipes";

const HEALTHY_TAG = "Healthy";
const BUDGET_TAG = "Budget Meal";
const FAST_TAG = "Fast Meal";
const MAX_BALANCED_MISSING_REQUIRED = 2;

const recipeMatchInclude = Prisma.validator<Prisma.RecipeInclude>()({
  ingredients: {
    include: {
      groceryItem: true
    },
    orderBy: {
      sortOrder: "asc"
    }
  },
  rating: true,
  substitutions: {
    include: {
      originalGroceryItem: true,
      substituteGroceryItem: true
    },
    orderBy: {
      createdAt: "asc"
    }
  },
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
});

type MatchableRecipe = Prisma.RecipeGetPayload<{
  include: typeof recipeMatchInclude;
}>;

type AvailableInventoryItem = Prisma.InventoryItemGetPayload<{
  include: {
    groceryItem: true;
  };
}>;

export type IngredientMatchStatus =
  | "available"
  | "available_unverified_quantity"
  | "substituted"
  | "missing";

export type IngredientMatch = {
  availableQuantityLabel: string;
  expirationLabel: string | null;
  ingredientId: string;
  ingredientName: string;
  isExpiringSoon: boolean;
  isOptional: boolean;
  notes: string | null;
  requiredQuantityLabel: string;
  status: IngredientMatchStatus;
  substituteName: string | null;
};

export type RecipeMatch = {
  availableRequiredCount: number;
  expiringMatchedCount: number;
  explanations: string[];
  ingredients: IngredientMatch[];
  missingRequiredCount: number;
  optionalMissingCount: number;
  recipe: {
    description: string | null;
    id: string;
    isActive: boolean;
    name: string;
    rating: number | null;
    servings: number;
    tags: string[];
    wouldCookAgain: boolean | null;
  };
  score: number;
};

function summarizeInventoryQuantity(items: AvailableInventoryItem[], t: Dictionary) {
  const exactByUnit = new Map<string, Prisma.Decimal>();
  const descriptions: string[] = [];

  for (const item of items) {
    if (item.quantity && item.unit) {
      const current = exactByUnit.get(item.unit) ?? new Prisma.Decimal(0);
      exactByUnit.set(item.unit, current.plus(item.quantity));
    }

    if (item.quantityDescription) {
      descriptions.push(item.quantityDescription);
    }
  }

  const exactParts = Array.from(exactByUnit.entries()).map(
    ([unit, quantity]) => `${quantity.toString()} ${t.units[unit] ?? unit}`
  );

  return [...exactParts, ...descriptions].join(", ") || t.common.available;
}

function findSoonestExpiration(items: AvailableInventoryItem[]) {
  return items
    .map((item) => item.expirationDate)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())[0];
}

function hasExpiringItem(items: AvailableInventoryItem[], expiringDays: number) {
  const threshold = addDays(startOfToday(), expiringDays);

  return items.some(
    (item) => item.expirationDate && item.expirationDate <= threshold
  );
}

function hasEnoughExactQuantity(
  ingredient: MatchableRecipe["ingredients"][number],
  inventoryItems: AvailableInventoryItem[]
) {
  if (!ingredient.quantity || !ingredient.unit) {
    return null;
  }

  const matchingUnitItems = inventoryItems.filter(
    (item) => item.quantity && item.unit === ingredient.unit
  );

  if (matchingUnitItems.length === 0) {
    return null;
  }

  const total = matchingUnitItems.reduce(
    (sum, item) => sum.plus(item.quantity ?? 0),
    new Prisma.Decimal(0)
  );

  return total.greaterThanOrEqualTo(ingredient.quantity);
}

function recipeHasTag(recipe: MatchableRecipe, tagName: string) {
  return recipe.tags.some((tagMap) => tagMap.tag.name === tagName);
}

function buildIngredientMatch(
  recipe: MatchableRecipe,
  ingredient: MatchableRecipe["ingredients"][number],
  inventoryByGroceryItemId: Map<string, AvailableInventoryItem[]>,
  locale: Locale,
  expiringDays: number
): IngredientMatch {
  const t = getDictionary(locale);
  const directItems = inventoryByGroceryItemId.get(ingredient.groceryItemId) ?? [];
  const substitution = recipe.substitutions.find(
    (item) => item.originalGroceryItemId === ingredient.groceryItemId
  );
  const substituteItems = substitution
    ? inventoryByGroceryItemId.get(substitution.substituteGroceryItemId) ?? []
    : [];
  const matchedItems = directItems.length > 0 ? directItems : substituteItems;
  const isSubstitution = directItems.length === 0 && substituteItems.length > 0;
  const enoughQuantity =
    matchedItems.length > 0 ? hasEnoughExactQuantity(ingredient, matchedItems) : false;
  const isExpiringSoon = hasExpiringItem(matchedItems, expiringDays);
  const expirationDate = findSoonestExpiration(matchedItems);

  let status: IngredientMatchStatus = "missing";

  if (matchedItems.length > 0) {
    if (isSubstitution) {
      status = "substituted";
    } else if (enoughQuantity === false) {
      status = "missing";
    } else if (enoughQuantity === null) {
      status = "available_unverified_quantity";
    } else {
      status = "available";
    }
  }

  return {
    availableQuantityLabel: summarizeInventoryQuantity(matchedItems, t),
    expirationLabel: expirationDate ? daysUntilLabel(expirationDate, t) : null,
    ingredientId: ingredient.id,
    ingredientName: groceryName(locale, ingredient.groceryItem),
    isExpiringSoon,
    isOptional: ingredient.optional,
    notes: pickLocalized(locale, ingredient.notesEn, ingredient.notesEs) || null,
    requiredQuantityLabel: formatRecipeQuantity(
      ingredient.quantity,
      ingredient.unit,
      ingredient.quantityDescription,
      t
    ),
    status,
    substituteName:
      isSubstitution && substitution
        ? groceryName(locale, substitution.substituteGroceryItem)
        : null
  };
}

function buildRecipeMatch(
  recipe: MatchableRecipe,
  inventoryByGroceryItemId: Map<string, AvailableInventoryItem[]>,
  locale: Locale,
  expiringDays: number
): RecipeMatch {
  const t = getDictionary(locale);
  const ingredients = recipe.ingredients.map((ingredient) =>
    buildIngredientMatch(recipe, ingredient, inventoryByGroceryItemId, locale, expiringDays)
  );
  const requiredIngredients = ingredients.filter((ingredient) => !ingredient.isOptional);
  const availableRequiredCount = requiredIngredients.filter(
    (ingredient) => ingredient.status !== "missing"
  ).length;
  const missingRequiredCount = requiredIngredients.filter(
    (ingredient) => ingredient.status === "missing"
  ).length;
  const optionalMissingCount = ingredients.filter(
    (ingredient) => ingredient.isOptional && ingredient.status === "missing"
  ).length;
  const expiringMatchedCount = ingredients.filter(
    (ingredient) => ingredient.status !== "missing" && ingredient.isExpiringSoon
  ).length;
  const tagNames = recipe.tags.map((tagMap) => tagMap.tag.name);

  let score = availableRequiredCount * 8 + expiringMatchedCount * 12;

  if (missingRequiredCount === 0) {
    score += 40;
  }

  score -= missingRequiredCount * 18;

  if (missingRequiredCount > MAX_BALANCED_MISSING_REQUIRED) {
    score -= 20;
  }

  if (recipeHasTag(recipe, HEALTHY_TAG)) {
    score += 10;
  }

  if (recipeHasTag(recipe, BUDGET_TAG)) {
    score += 8;
  }

  if (recipeHasTag(recipe, FAST_TAG)) {
    score += 6;
  }

  if (recipe.rating?.rating) {
    score += recipe.rating.rating * 2;
  }

  if (recipe.rating?.wouldCookAgain) {
    score += 5;
  }

  const explanations: string[] = [];
  const expiringIngredients = ingredients
    .filter((ingredient) => ingredient.status !== "missing" && ingredient.isExpiringSoon)
    .map((ingredient) => ingredient.substituteName ?? ingredient.ingredientName);

  if (missingRequiredCount === 0) {
    explanations.push(t.match.allAvailable);
  } else {
    explanations.push(t.match.missingRequired(missingRequiredCount));
  }

  if (missingRequiredCount > MAX_BALANCED_MISSING_REQUIRED) {
    explanations.push(t.match.deprioritized);
  }

  if (expiringIngredients.length > 0) {
    explanations.push(t.match.usesExpiring(expiringIngredients.slice(0, 2).join(", ")));
  }

  if (recipeHasTag(recipe, HEALTHY_TAG)) {
    explanations.push(t.match.healthy);
  }

  if (recipeHasTag(recipe, BUDGET_TAG)) {
    explanations.push(t.match.budget);
  }

  if (recipeHasTag(recipe, FAST_TAG)) {
    explanations.push(t.match.fast);
  }

  if (recipe.rating?.wouldCookAgain) {
    explanations.push(t.match.cookAgain);
  }

  return {
    availableRequiredCount,
    expiringMatchedCount,
    explanations,
    ingredients,
    missingRequiredCount,
    optionalMissingCount,
    recipe: {
      description: pickLocalized(locale, recipe.descriptionEn, recipe.descriptionEs) || null,
      id: recipe.id,
      isActive: recipe.isActive,
      name: pickLocalized(locale, recipe.nameEn, recipe.nameEs),
      rating: recipe.rating?.rating ?? null,
      servings: recipe.servings,
      tags: tagNames,
      wouldCookAgain: recipe.rating?.wouldCookAgain ?? null
    },
    score
  };
}

async function getAvailableInventoryByGroceryItemId() {
  const items = await prisma.inventoryItem.findMany({
    where: {
      status: "available"
    },
    include: {
      groceryItem: true
    },
    orderBy: [{ expirationDate: "asc" }, { createdAt: "desc" }]
  });
  const inventoryByGroceryItemId = new Map<string, AvailableInventoryItem[]>();

  for (const item of items) {
    const existing = inventoryByGroceryItemId.get(item.groceryItemId) ?? [];
    existing.push(item);
    inventoryByGroceryItemId.set(item.groceryItemId, existing);
  }

  return inventoryByGroceryItemId;
}

export async function getRecipeMatches({
  limit,
  locale = "en"
}: { limit?: number; locale?: Locale } = {}) {
  const [recipes, inventoryByGroceryItemId, settings] = await Promise.all([
    prisma.recipe.findMany({
      where: {
        isActive: true
      },
      include: recipeMatchInclude
    }),
    getAvailableInventoryByGroceryItemId(),
    getHouseholdSettings()
  ]);

  const matches = recipes
    .map((recipe) =>
      buildRecipeMatch(recipe, inventoryByGroceryItemId, locale, settings.expiringSoonDays)
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.missingRequiredCount - b.missingRequiredCount ||
        b.expiringMatchedCount - a.expiringMatchedCount ||
        a.recipe.name.localeCompare(b.recipe.name, locale)
    );

  return typeof limit === "number" ? matches.slice(0, limit) : matches;
}

export async function getRecipeMatchForRecipe(recipeId: string, locale: Locale = "en") {
  const [recipe, inventoryByGroceryItemId, settings] = await Promise.all([
    prisma.recipe.findUnique({
      where: {
        id: recipeId
      },
      include: recipeMatchInclude
    }),
    getAvailableInventoryByGroceryItemId(),
    getHouseholdSettings()
  ]);

  return recipe
    ? buildRecipeMatch(recipe, inventoryByGroceryItemId, locale, settings.expiringSoonDays)
    : null;
}

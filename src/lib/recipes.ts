import { Prisma } from "@prisma/client";
import { pickLocalized, type Locale } from "@/lib/i18n/config";
import { en, type Dictionary } from "@/lib/i18n/dictionaries/en";
import { prisma } from "@/lib/prisma";

export const MAX_RECIPE_INGREDIENTS = 12;
export const MAX_RECIPE_STEPS = 10;
export const MAX_RECIPE_SUBSTITUTIONS = 4;

export const recipeUnitOptions = [
  "each",
  "lb",
  "kg",
  "g",
  "oz",
  "ml",
  "l",
  "cups",
  "tbsp",
  "tsp",
  "packs",
  "cans"
] as const;

export type RecipeStatusFilter = "active" | "archived" | "all";

export type RecipeFilters = {
  query?: string;
  status?: RecipeStatusFilter;
  tagId?: string;
};

export const recipeListInclude = Prisma.validator<Prisma.RecipeInclude>()({
  ingredients: {
    include: {
      groceryItem: true
    },
    orderBy: {
      sortOrder: "asc"
    }
  },
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
});

export const recipeDetailInclude = Prisma.validator<Prisma.RecipeInclude>()({
  ingredients: {
    include: {
      groceryItem: true
    },
    orderBy: {
      sortOrder: "asc"
    }
  },
  rating: true,
  steps: {
    orderBy: {
      stepNumber: "asc"
    }
  },
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

export type RecipeListItem = Prisma.RecipeGetPayload<{
  include: typeof recipeListInclude;
}>;

export type RecipeDetail = Prisma.RecipeGetPayload<{
  include: typeof recipeDetailInclude;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids come from the URL; anything that isn't a UUID is ignored. */
export function cleanIdParam(value: string | undefined) {
  const cleaned = cleanRecipeSearchParam(value);
  return cleaned && UUID_PATTERN.test(cleaned) ? cleaned : undefined;
}

export function cleanRecipeSearchParam(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export function isRecipeStatusFilter(
  value: string | undefined
): value is RecipeStatusFilter {
  return value === "active" || value === "archived" || value === "all";
}

export function formatDecimalInput(value: Prisma.Decimal | null) {
  return value?.toString() ?? "";
}

export function formatRecipeQuantity(
  quantity: Prisma.Decimal | null,
  unit: string | null,
  quantityDescription: string | null,
  t: Dictionary = en
) {
  const unitText = unit ? t.units[unit] ?? unit : "";
  const exactQuantity = quantity
    ? `${quantity.toString()}${unitText ? ` ${unitText}` : ""}`
    : "";

  if (exactQuantity && quantityDescription) {
    return `${exactQuantity} (${quantityDescription})`;
  }

  return exactQuantity || quantityDescription || t.common.asNeeded;
}

export function formatRecipeTime(minutes: number | null, t: Dictionary = en) {
  if (!minutes) {
    return t.common.notSet;
  }

  if (minutes < 60) {
    return t.common.minutes(minutes);
  }

  return t.common.hours(Math.floor(minutes / 60), minutes % 60);
}

export function formatRecipeRating(
  rating: number | null | undefined,
  t: Dictionary = en
) {
  return rating ? t.common.rating(rating) : t.common.notRated;
}

export async function getRecipeReferenceData() {
  const [tags, groceryItems] = await Promise.all([
    prisma.recipeTag.findMany({
      orderBy: {
        name: "asc"
      }
    }),
    prisma.groceryItem.findMany({
      orderBy: {
        name: "asc"
      }
    })
  ]);

  return { groceryItems, tags };
}

export async function getRecipes(filters: RecipeFilters, locale: Locale = "en") {
  const where: Prisma.RecipeWhereInput = {};
  const status = filters.status ?? "active";

  if (status === "active") {
    where.isActive = true;
  } else if (status === "archived") {
    where.isActive = false;
  }

  if (filters.query) {
    const contains = { contains: filters.query, mode: "insensitive" as const };

    where.OR = [
      { nameEn: contains },
      { nameEs: contains },
      { descriptionEn: contains },
      { descriptionEs: contains },
      { source: contains },
      {
        ingredients: {
          some: {
            groceryItem: {
              OR: [{ name: contains }, { nameEn: contains }, { nameEs: contains }]
            }
          }
        }
      }
    ];
  }

  if (filters.tagId) {
    where.tags = {
      some: {
        tagId: filters.tagId
      }
    };
  }

  const recipes = await prisma.recipe.findMany({
    where,
    include: recipeListInclude
  });

  return recipes.sort(
    (a, b) =>
      Number(b.isActive) - Number(a.isActive) ||
      pickLocalized(locale, a.nameEn, a.nameEs).localeCompare(
        pickLocalized(locale, b.nameEn, b.nameEs),
        locale
      )
  );
}

export async function getRecipeById(id: string) {
  return prisma.recipe.findUnique({
    where: {
      id
    },
    include: recipeDetailInclude
  });
}

export async function getRecipeDashboardData() {
  const activeCount = await prisma.recipe.count({
    where: {
      isActive: true
    }
  });

  return { activeCount };
}

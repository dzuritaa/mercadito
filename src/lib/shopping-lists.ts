import { Prisma } from "@prisma/client";
import { formatQuantity, startOfToday } from "@/lib/inventory";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";
import { formatCalendarDate } from "@/lib/i18n/text";
import { prisma } from "@/lib/prisma";

export const shoppingUnitOptions = [
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

export const shoppingListInclude = Prisma.validator<Prisma.ShoppingListInclude>()({
  items: {
    include: {
      category: true,
      groceryItem: {
        include: {
          category: true
        }
      },
      preferredStore: true
    },
    orderBy: [{ checked: "asc" }, { createdAt: "asc" }]
  },
  mealPlan: true
});

const mealPlanForShoppingInclude = Prisma.validator<Prisma.MealPlanInclude>()({
  items: {
    where: {
      status: {
        in: ["approved", "planned"]
      }
    },
    include: {
      recipe: {
        include: {
          ingredients: {
            where: {
              optional: false
            },
            include: {
              groceryItem: {
                include: {
                  category: true
                }
              }
            },
            orderBy: {
              sortOrder: "asc"
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

export type ShoppingListDetail = Prisma.ShoppingListGetPayload<{
  include: typeof shoppingListInclude;
}>;

export type ShoppingReferenceData = Awaited<ReturnType<typeof getShoppingReferenceData>>;

type MealPlanForShopping = Prisma.MealPlanGetPayload<{
  include: typeof mealPlanForShoppingInclude;
}>;

type ShoppingIngredientGroup = {
  categoryId: string | null;
  groceryItemId: string;
  hasUnknownQuantity: boolean;
  itemName: string;
  neededQuantity: Prisma.Decimal | null;
  notes: Set<string>;
  unit: string | null;
};

function shoppingRedirectPath(message: string, type: "notice" | "error" = "notice") {
  return `/shopping-list?${type}=${encodeURIComponent(message)}`;
}

function exactInventoryKey(groceryItemId: string, unit: string | null) {
  return `${groceryItemId}:${unit ?? ""}`;
}

function addNote(notes: Set<string>, note: string) {
  if (note) {
    notes.add(note);
  }
}

function addIngredientToGroups(
  groups: Map<string, ShoppingIngredientGroup>,
  ingredient: MealPlanForShopping["items"][number]["recipe"]["ingredients"][number],
  t: Dictionary
) {
  const reviewNote = t.shopping.reviewAmountNote(
    formatQuantity(null, ingredient.unit, ingredient.quantityDescription, t)
  );
  const key = exactInventoryKey(ingredient.groceryItemId, ingredient.unit);
  const existing = groups.get(key);

  if (!existing) {
    groups.set(key, {
      categoryId: ingredient.groceryItem.categoryId,
      groceryItemId: ingredient.groceryItemId,
      hasUnknownQuantity: !ingredient.quantity,
      itemName: ingredient.groceryItem.name,
      neededQuantity: ingredient.quantity ?? null,
      notes: new Set(
        ingredient.quantity
          ? []
          : [reviewNote]
      ),
      unit: ingredient.unit
    });
    return;
  }

  if (existing.neededQuantity && ingredient.quantity && !existing.hasUnknownQuantity) {
    existing.neededQuantity = existing.neededQuantity.plus(ingredient.quantity);
  } else {
    existing.neededQuantity = null;
    existing.hasUnknownQuantity = true;
    addNote(existing.notes, reviewNote);
  }
}

async function getLatestApprovedMealPlan(mealPlanId?: string) {
  if (mealPlanId) {
    return prisma.mealPlan.findFirst({
      where: {
        id: mealPlanId,
        status: "approved"
      },
      include: mealPlanForShoppingInclude
    });
  }

  return prisma.mealPlan.findFirst({
    where: {
      status: "approved"
    },
    include: mealPlanForShoppingInclude,
    orderBy: {
      weekStartDate: "desc"
    }
  });
}

export async function getShoppingReferenceData() {
  const [categories, groceryItems, stores, approvedMealPlans] = await Promise.all([
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
    prisma.store.findMany({
      where: {
        active: true
      },
      orderBy: {
        name: "asc"
      }
    }),
    prisma.mealPlan.findMany({
      where: {
        status: "approved"
      },
      orderBy: {
        weekStartDate: "desc"
      },
      take: 8
    })
  ]);

  return { approvedMealPlans, categories, groceryItems, stores };
}

export async function getCurrentShoppingList() {
  return prisma.shoppingList.findFirst({
    where: {
      status: {
        in: ["active", "draft"]
      }
    },
    include: shoppingListInclude,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });
}

export async function getShoppingListPageData() {
  const [referenceData, currentList] = await Promise.all([
    getShoppingReferenceData(),
    getCurrentShoppingList()
  ]);

  return { currentList, referenceData };
}

export function groupShoppingItemsByCategory(list: ShoppingListDetail | null) {
  if (!list) {
    return [];
  }

  const groups = new Map<
    string,
    {
      categoryName: string;
      sortOrder: number;
      items: ShoppingListDetail["items"];
    }
  >();

  for (const item of list.items) {
    const category = item.category ?? item.groceryItem?.category ?? null;
    const key = category?.id ?? "uncategorized";
    const existing = groups.get(key) ?? {
      categoryName: category?.name ?? "Uncategorized",
      items: [],
      sortOrder: category?.sortOrder ?? 999
    };

    existing.items.push(item);
    groups.set(key, existing);
  }

  return Array.from(groups.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.categoryName.localeCompare(b.categoryName)
  );
}

export async function createShoppingListFromMealPlan(
  mealPlanId: string | undefined,
  locale: Locale
) {
  const t = getDictionary(locale);
  const mealPlan = await getLatestApprovedMealPlan(mealPlanId);

  if (!mealPlan) {
    return {
      error: "approvePlanFirst",
      redirectPath: shoppingRedirectPath("approvePlanFirst", "error")
    };
  }

  const existingList = await prisma.shoppingList.findFirst({
    where: {
      mealPlanId: mealPlan.id,
      status: {
        in: ["active", "draft"]
      }
    },
    select: {
      id: true
    }
  });

  if (existingList) {
    return {
      redirectPath: shoppingRedirectPath("shoppingListExists")
    };
  }

  const groups = new Map<string, ShoppingIngredientGroup>();

  for (const mealPlanItem of mealPlan.items) {
    for (const ingredient of mealPlanItem.recipe.ingredients) {
      addIngredientToGroups(groups, ingredient, t);
    }
  }

  if (groups.size === 0) {
    return {
      error: "planHasNoIngredients",
      redirectPath: shoppingRedirectPath("planHasNoIngredients", "error")
    };
  }

  const exactInventory = await prisma.inventoryItem.findMany({
    where: {
      status: "available"
    },
    include: {
      groceryItem: true
    }
  });
  const exactInventoryByKey = new Map<string, Prisma.Decimal>();
  const approximateInventoryByGroceryItem = new Set<string>();

  for (const item of exactInventory) {
    if (item.quantity) {
      const key = exactInventoryKey(item.groceryItemId, item.unit);
      const current = exactInventoryByKey.get(key) ?? new Prisma.Decimal(0);
      exactInventoryByKey.set(key, current.plus(item.quantity));
    }

    if (item.quantityDescription && !item.quantity) {
      approximateInventoryByGroceryItem.add(item.groceryItemId);
    }
  }

  const shoppingList = await prisma.shoppingList.create({
    data: {
      mealPlanId: mealPlan.id,
      name: t.shopping.listTitle(formatCalendarDate(locale, mealPlan.weekStartDate)),
      status: "active",
      targetStartDate: mealPlan.weekStartDate,
      targetEndDate: mealPlan.items.reduce(
        (latest, item) => (item.plannedDate > latest ? item.plannedDate : latest),
        mealPlan.weekStartDate
      ),
      items: {
        create: Array.from(groups.values()).map((group) => {
          const haveQuantity = exactInventoryByKey.get(
            exactInventoryKey(group.groceryItemId, group.unit)
          );
          const buyQuantity =
            group.neededQuantity && haveQuantity
              ? Prisma.Decimal.max(group.neededQuantity.minus(haveQuantity), 0)
              : group.neededQuantity;

          if (approximateInventoryByGroceryItem.has(group.groceryItemId)) {
            addNote(group.notes, t.shopping.approximateNote);
          }

          return {
            groceryItemId: group.groceryItemId,
            categoryId: group.categoryId,
            neededQuantity: group.neededQuantity,
            haveQuantity: haveQuantity ?? null,
            buyQuantity,
            unit: group.unit,
            notes: Array.from(group.notes).join(" ")
          };
        })
      }
    }
  });

  return {
    redirectPath: shoppingRedirectPath("shoppingListGenerated"),
    shoppingList
  };
}

export function getDefaultPurchaseDate() {
  return startOfToday().toISOString().slice(0, 10);
}

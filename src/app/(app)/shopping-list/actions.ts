"use server";

import { requireUser } from "@/lib/auth/session";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  inventoryLocationOptions,
  normalizeGroceryName,
  type InventoryLocationValue
} from "@/lib/inventory";
import { findOrCreateGroceryItemByName } from "@/lib/grocery-items";
import type { Locale } from "@/lib/i18n/config";
import { getI18n, getLocale } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { createShoppingListFromMealPlan } from "@/lib/shopping-lists";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function optionalString(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value.length > 0 ? value : undefined;
}

function optionalDecimal(formData: FormData, key: string) {
  const value = optionalString(formData, key);

  if (!value) {
    return undefined;
  }

  return value.replace(",", ".");
}

function optionalDate(formData: FormData, key: string) {
  const value = optionalString(formData, key);

  if (!value) {
    return undefined;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function optionalLocation(formData: FormData) {
  const value = optionalString(formData, "location");

  if (inventoryLocationOptions.some((option) => option.value === value)) {
    return value as InventoryLocationValue;
  }

  return undefined;
}

function shoppingRedirect(message: string, type: "notice" | "error" = "notice") {
  redirect(`/shopping-list?${type}=${encodeURIComponent(message)}`);
}

function revalidateShoppingPaths() {
  revalidatePath("/");
  revalidatePath("/inventory");
  revalidatePath("/reports");
  revalidatePath("/shopping-list");
}

async function findOrCreateGroceryItem(
  tx: Prisma.TransactionClient,
  name: string,
  locale: Locale,
  categoryId?: string
) {
  if (!name || !normalizeGroceryName(name)) {
    shoppingRedirect("itemNameRequired", "error");
  }

  return findOrCreateGroceryItemByName(tx, name, locale, { categoryId });
}

export async function generateShoppingListFromMealPlan(formData: FormData) {
  await requireUser();
  const mealPlanId = optionalString(formData, "mealPlanId");
  const result = await createShoppingListFromMealPlan(mealPlanId, await getLocale());

  revalidateShoppingPaths();
  redirect(result.redirectPath);
}

export async function addManualShoppingItem(formData: FormData) {
  await requireUser();
  const shoppingListId = readString(formData, "shoppingListId");
  const groceryItemId = optionalString(formData, "groceryItemId");
  const customItemName = optionalString(formData, "customItemName");
  const categoryId = optionalString(formData, "categoryId");
  const buyQuantity = optionalDecimal(formData, "buyQuantity");
  const unit = optionalString(formData, "unit");

  if (!shoppingListId) {
    shoppingRedirect("shoppingListMissing", "error");
  }

  if (!groceryItemId && !customItemName) {
    shoppingRedirect("chooseOrNameItem", "error");
  }

  let resolvedCategoryId = categoryId;

  if (groceryItemId && !resolvedCategoryId) {
    const groceryItem = await prisma.groceryItem.findUnique({
      where: {
        id: groceryItemId
      },
      select: {
        categoryId: true
      }
    });
    resolvedCategoryId = groceryItem?.categoryId ?? undefined;
  }

  await prisma.shoppingListItem.create({
    data: {
      shoppingListId,
      groceryItemId,
      customItemName: groceryItemId ? undefined : customItemName,
      categoryId: resolvedCategoryId,
      buyQuantity,
      unit,
      preferredStoreId: optionalString(formData, "preferredStoreId"),
      isExtraItem: true,
      notes: optionalString(formData, "notes")
    }
  });

  revalidateShoppingPaths();
  shoppingRedirect("extraItemAdded");
}

export async function updateShoppingItem(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");

  if (!id) {
    shoppingRedirect("shoppingItemMissing", "error");
  }

  await prisma.shoppingListItem.update({
    where: {
      id
    },
    data: {
      buyQuantity: optionalDecimal(formData, "buyQuantity") ?? null,
      unit: optionalString(formData, "unit") ?? null,
      categoryId: optionalString(formData, "categoryId") ?? null,
      preferredStoreId: optionalString(formData, "preferredStoreId") ?? null,
      notes: optionalString(formData, "notes") ?? null
    }
  });

  revalidateShoppingPaths();
  shoppingRedirect("shoppingItemUpdated");
}

export async function toggleShoppingItemChecked(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  const checked = readString(formData, "checked") === "true";

  if (!id) {
    shoppingRedirect("shoppingItemMissing", "error");
  }

  await prisma.shoppingListItem.update({
    where: {
      id
    },
    data: {
      checked
    }
  });

  revalidateShoppingPaths();
  redirect("/shopping-list");
}

export async function convertCheckedItemsToInventory(formData: FormData) {
  await requireUser();
  const shoppingListId = readString(formData, "shoppingListId");
  const { locale, t } = await getI18n();

  if (!shoppingListId) {
    shoppingRedirect("shoppingListMissing", "error");
  }

  const purchaseDate = optionalDate(formData, "purchaseDate") ?? new Date();
  const purchaseStoreId = optionalString(formData, "purchaseStoreId");
  const receiptTotal = optionalDecimal(formData, "receiptTotal");
  const receiptTotalNumber = receiptTotal ? Number(receiptTotal) : NaN;
  const expirationDate = optionalDate(formData, "expirationDate");
  const location = optionalLocation(formData);

  if (receiptTotal && (!Number.isFinite(receiptTotalNumber) || receiptTotalNumber <= 0)) {
    shoppingRedirect("receiptTotalPositive", "error");
  }

  const convertedCount = await prisma.$transaction(async (tx) => {
    const items = await tx.shoppingListItem.findMany({
      where: {
        shoppingListId,
        checked: true,
        convertedToInventoryAt: null,
        OR: [
          {
            buyQuantity: null
          },
          {
            buyQuantity: {
              gt: 0
            }
          }
        ]
      },
      include: {
        groceryItem: true
      }
    });

    const purchase =
      receiptTotal && items.length > 0
        ? await tx.purchase.create({
            data: {
              notes: optionalString(formData, "purchaseNotes"),
              purchaseDate,
              purchaseType: "grocery",
              storeId: purchaseStoreId,
              totalAmount: receiptTotal
            }
          })
        : null;
    let count = 0;

    for (const item of items) {
      const groceryItem =
        item.groceryItem ??
        (await findOrCreateGroceryItem(
          tx,
          item.customItemName ?? t.shopping.shoppingItem,
          locale,
          item.categoryId ?? undefined
        ));
      const quantity = item.buyQuantity ?? item.neededQuantity;
      const purchaseItem = purchase
        ? await tx.purchaseItem.create({
            data: {
              addedToInventory: true,
              categoryId: item.categoryId ?? groceryItem.categoryId,
              groceryItemId: groceryItem.id,
              itemName: item.customItemName,
              notes: item.notes,
              purchaseId: purchase.id,
              quantity,
              unit: item.unit
            }
          })
        : null;
      const inventoryItem = await tx.inventoryItem.create({
        data: {
          groceryItemId: groceryItem.id,
          quantity,
          unit: item.unit,
          quantityDescription: quantity ? null : t.shopping.purchasedFromList,
          location,
          purchaseDate,
          purchaseItemId: purchaseItem?.id,
          expirationDate,
          storeId: purchaseStoreId ?? item.preferredStoreId,
          status: "available",
          notes: item.notes
        }
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: inventoryItem.id,
          groceryItemId: groceryItem.id,
          transactionType: "added",
          quantity,
          unit: item.unit,
          source: "shopping_list",
          notes: "Converted from checked shopping list item"
        }
      });

      await tx.shoppingListItem.update({
        where: {
          id: item.id
        },
        data: {
          convertedToInventoryAt: new Date()
        }
      });

      count += 1;
    }

    return count;
  });

  revalidateShoppingPaths();
  shoppingRedirect(t.shopping.convertedCount(convertedCount));
}

export async function completeShoppingList(formData: FormData) {
  await requireUser();
  const shoppingListId = readString(formData, "shoppingListId");

  if (!shoppingListId) {
    shoppingRedirect("shoppingListMissing", "error");
  }

  await prisma.shoppingList.update({
    where: {
      id: shoppingListId
    },
    data: {
      status: "completed",
      completedAt: new Date()
    }
  });

  revalidateShoppingPaths();
  shoppingRedirect("shoppingListCompleted");
}

export async function archiveShoppingList(formData: FormData) {
  await requireUser();
  const shoppingListId = readString(formData, "shoppingListId");

  if (!shoppingListId) {
    shoppingRedirect("shoppingListMissing", "error");
  }

  await prisma.shoppingList.update({
    where: {
      id: shoppingListId
    },
    data: {
      status: "archived"
    }
  });

  revalidateShoppingPaths();
  shoppingRedirect("shoppingListArchived");
}

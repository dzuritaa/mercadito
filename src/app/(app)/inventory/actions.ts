"use server";

import { requireUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { findOrCreateGroceryItemByName } from "@/lib/grocery-items";
import { getI18n, getLocale } from "@/lib/i18n/server";
import { groceryName } from "@/lib/i18n/text";
import { prisma } from "@/lib/prisma";
import {
  inventoryLocationOptions,
  normalizeGroceryName,
  type InventoryLocationValue
} from "@/lib/inventory";

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

function optionalDate(formData: FormData, key: string) {
  const value = optionalString(formData, key);

  if (!value) {
    return undefined;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function optionalDecimal(formData: FormData, key: string) {
  const value = optionalString(formData, key);

  if (!value) {
    return undefined;
  }

  return value.replace(",", ".");
}

function optionalLocation(formData: FormData) {
  const value = optionalString(formData, "location");

  if (inventoryLocationOptions.some((option) => option.value === value)) {
    return value as InventoryLocationValue;
  }

  return undefined;
}

function inventoryRedirect(message: string, type: "notice" | "error" = "notice") {
  redirect(`/inventory?${type}=${encodeURIComponent(message)}`);
}

async function findOrCreateGroceryItem(formData: FormData) {
  const name = readString(formData, "name");
  const categoryId = optionalString(formData, "categoryId");
  const unit = optionalString(formData, "unit");
  const expirationDate = optionalDate(formData, "expirationDate");

  if (!name || !normalizeGroceryName(name)) {
    inventoryRedirect("itemNameRequired", "error");
  }

  return findOrCreateGroceryItemByName(prisma, name, await getLocale(), {
    categoryId,
    defaultUnit: unit,
    isPerishable: Boolean(expirationDate)
  });
}

export async function addInventoryItem(formData: FormData) {
  await requireUser();
  const quantity = optionalDecimal(formData, "quantity");
  const quantityDescription = optionalString(formData, "quantityDescription");

  if (!quantity && !quantityDescription) {
    inventoryRedirect("quantityOrApproxRequired", "error");
  }

  const unit = optionalString(formData, "unit");
  const groceryItem = await findOrCreateGroceryItem(formData);

  await prisma.$transaction(async (tx) => {
    const inventoryItem = await tx.inventoryItem.create({
      data: {
        groceryItemId: groceryItem.id,
        quantity,
        unit,
        quantityDescription,
        location: optionalLocation(formData),
        expirationDate: optionalDate(formData, "expirationDate"),
        purchaseDate: optionalDate(formData, "purchaseDate"),
        storeId: optionalString(formData, "storeId"),
        notes: optionalString(formData, "notes")
      }
    });

    await tx.inventoryTransaction.create({
      data: {
        inventoryItemId: inventoryItem.id,
        groceryItemId: groceryItem.id,
        transactionType: "added",
        quantity,
        unit,
        source: "manual",
        notes: "Added from inventory form"
      }
    });
  });

  revalidatePath("/");
  revalidatePath("/inventory");
  inventoryRedirect("inventoryAdded");
}

export async function updateInventoryItem(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  const quantity = optionalDecimal(formData, "quantity");
  const quantityDescription = optionalString(formData, "quantityDescription");

  if (!id) {
    inventoryRedirect("inventoryMissing", "error");
  }

  if (!quantity && !quantityDescription) {
    inventoryRedirect("quantityOrApproxRequired", "error");
  }

  const unit = optionalString(formData, "unit");
  const groceryItem = await findOrCreateGroceryItem(formData);

  await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.update({
      where: { id },
      data: {
        groceryItemId: groceryItem.id,
        quantity,
        unit,
        quantityDescription,
        location: optionalLocation(formData),
        expirationDate: optionalDate(formData, "expirationDate"),
        purchaseDate: optionalDate(formData, "purchaseDate"),
        storeId: optionalString(formData, "storeId"),
        notes: optionalString(formData, "notes")
      }
    });

    await tx.inventoryTransaction.create({
      data: {
        inventoryItemId: id,
        groceryItemId: groceryItem.id,
        transactionType: "adjusted",
        quantity,
        unit,
        source: "manual",
        notes: "Edited from inventory form"
      }
    });
  });

  revalidatePath("/");
  revalidatePath("/inventory");
  inventoryRedirect("inventoryUpdated");
}

export async function updateInventoryStatus(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  const status = readString(formData, "status");

  if (!id || !["used", "expired", "discarded"].includes(status)) {
    inventoryRedirect("inventoryStatusInvalid", "error");
  }

  const inventoryItem = await prisma.inventoryItem.update({
    where: { id },
    data: { status: status as "used" | "expired" | "discarded" },
    include: {
      groceryItem: true
    }
  });

  await prisma.inventoryTransaction.create({
    data: {
      inventoryItemId: inventoryItem.id,
      groceryItemId: inventoryItem.groceryItemId,
      transactionType: status as "used" | "expired" | "discarded",
      quantity: inventoryItem.quantity,
      unit: inventoryItem.unit,
      source: "manual",
      notes: `Marked ${status} from inventory list`
    }
  });

  revalidatePath("/");
  revalidatePath("/inventory");
  const { locale, t } = await getI18n();
  inventoryRedirect(
    t.inventory.markedStatus(
      groceryName(locale, inventoryItem.groceryItem),
      t.inventoryStatus[status] ?? status
    )
  );
}

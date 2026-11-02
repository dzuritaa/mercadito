"use server";

import { requireUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PurchaseType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { purchaseTypeOptions, type PurchaseTypeValue } from "@/lib/reports";

const RECEIPT_LINE_ITEM_COUNT = 5;

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

function isPurchaseType(value: string): value is PurchaseTypeValue {
  return purchaseTypeOptions.some((option) => option.value === value);
}

function readReceiptLineItems(formData: FormData) {
  const items = [];

  for (let index = 0; index < RECEIPT_LINE_ITEM_COUNT; index += 1) {
    const itemName = optionalString(formData, `lineItemName-${index}`);
    const groceryItemId = optionalString(formData, `lineGroceryItemId-${index}`);
    const categoryId = optionalString(formData, `lineCategoryId-${index}`);
    const quantity = optionalDecimal(formData, `lineQuantity-${index}`);
    const unit = optionalString(formData, `lineUnit-${index}`);
    const unitPrice = optionalDecimal(formData, `lineUnitPrice-${index}`);
    const totalPrice = optionalDecimal(formData, `lineTotalPrice-${index}`);
    const notes = optionalString(formData, `lineNotes-${index}`);
    const rowHasData =
      itemName ||
      groceryItemId ||
      categoryId ||
      quantity ||
      unit ||
      unitPrice ||
      totalPrice ||
      notes;

    if (!rowHasData) {
      continue;
    }

    const totalNumber = totalPrice ? Number(totalPrice) : NaN;

    if (!totalPrice || !Number.isFinite(totalNumber) || totalNumber <= 0) {
      reportsRedirect(
        "lineTotalRequired",
        "error",
        optionalString(formData, "month")
      );
    }

    items.push({
      categoryId,
      groceryItemId,
      itemName: groceryItemId ? itemName : itemName ?? "Receipt item",
      notes,
      quantity,
      totalPrice,
      unit,
      unitPrice
    });
  }

  return items;
}

function monthFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

function reportsRedirect(
  message: string,
  type: "notice" | "error" = "notice",
  month?: string
) {
  const params = new URLSearchParams();

  if (month) {
    params.set("month", month);
  }

  params.set(type, message);
  redirect(`/reports?${params.toString()}`);
}

export async function addPurchase(formData: FormData) {
  await requireUser();
  const totalAmount = optionalDecimal(formData, "totalAmount");
  const totalNumber = totalAmount ? Number(totalAmount) : NaN;
  const selectedMonth = optionalString(formData, "month");
  const purchaseDate = optionalDate(formData, "purchaseDate") ?? new Date();
  const purchaseType = readString(formData, "purchaseType");
  const redirectMonth = monthFromDate(purchaseDate) || selectedMonth;
  const lineItems = readReceiptLineItems(formData);

  if (!totalAmount || !Number.isFinite(totalNumber) || totalNumber <= 0) {
    reportsRedirect("purchaseTotalPositive", "error", selectedMonth);
  }

  if (!isPurchaseType(purchaseType)) {
    reportsRedirect("purchaseTypeInvalid", "error", selectedMonth);
  }

  await prisma.purchase.create({
    data: {
      items:
        lineItems.length > 0
          ? {
              create: lineItems
            }
          : undefined,
      notes: optionalString(formData, "notes"),
      purchaseDate,
      purchaseType: purchaseType as PurchaseType,
      storeId: optionalString(formData, "storeId"),
      totalAmount
    }
  });

  revalidatePath("/");
  revalidatePath("/reports");
  reportsRedirect("purchaseSaved", "notice", redirectMonth);
}

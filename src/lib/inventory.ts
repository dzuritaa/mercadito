import { Prisma } from "@prisma/client";
import { en, type Dictionary } from "@/lib/i18n/dictionaries/en";
import { getHouseholdSettings } from "@/lib/household";
import { prisma } from "@/lib/prisma";

async function expiringCutoff() {
  const { expiringSoonDays } = await getHouseholdSettings();
  return addDays(startOfToday(), expiringSoonDays);
}

export const inventoryLocationOptions = [
  { value: "pantry", label: "Pantry" },
  { value: "fridge", label: "Fridge" },
  { value: "freezer", label: "Freezer" },
  { value: "spices", label: "Spices" },
  { value: "cleaning", label: "Cleaning" },
  { value: "other", label: "Other" }
] as const;

export const inventoryStatusOptions = [
  { value: "available", label: "Available" },
  { value: "used", label: "Used" },
  { value: "expired", label: "Expired" },
  { value: "discarded", label: "Discarded" }
] as const;

export const inventoryRemovalOptions = [
  { value: "used", label: "Mark used" },
  { value: "expired", label: "Mark expired" },
  { value: "discarded", label: "Mark discarded" }
] as const;

export type InventoryLocationValue =
  (typeof inventoryLocationOptions)[number]["value"];

export type InventoryStatusValue =
  (typeof inventoryStatusOptions)[number]["value"];

export type InventoryFilters = {
  categoryId?: string;
  expiring?: boolean;
  location?: InventoryLocationValue;
  query?: string;
  status?: InventoryStatusValue | "all";
};

export function normalizeGroceryName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function formatDateInput(date: Date | null) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function formatQuantity(
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

  return exactQuantity || quantityDescription || t.common.notSet;
}

export function daysUntilLabel(date: Date | null, t: Dictionary = en) {
  if (!date) {
    return t.common.noDate;
  }

  const today = startOfToday();
  const expiration = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const days = Math.round(
    (expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (days < 0) {
    return t.common.daysOverdue(Math.abs(days));
  }

  if (days === 0) {
    return t.common.today;
  }

  return t.common.days(days);
}

export async function getInventoryReferenceData() {
  const [categories, stores] = await Promise.all([
    prisma.groceryCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    }),
    prisma.store.findMany({
      where: { active: true },
      orderBy: { name: "asc" }
    })
  ]);

  return { categories, stores };
}

export async function getInventoryItems(filters: InventoryFilters) {
  const where: Prisma.InventoryItemWhereInput = {};
  const status = filters.status ?? "available";

  if (status !== "all") {
    where.status = status;
  }

  if (filters.location) {
    where.location = filters.location;
  }

  if (filters.categoryId) {
    where.groceryItem = {
      categoryId: filters.categoryId
    };
  }

  if (filters.query) {
    where.groceryItem = {
      ...((where.groceryItem as Prisma.GroceryItemWhereInput) ?? {}),
      OR: [
        { name: { contains: filters.query, mode: "insensitive" } },
        { nameEn: { contains: filters.query, mode: "insensitive" } },
        { nameEs: { contains: filters.query, mode: "insensitive" } }
      ]
    };
  }

  if (filters.expiring) {
    where.expirationDate = {
      lte: await expiringCutoff()
    };
  }

  return prisma.inventoryItem.findMany({
    where,
    include: {
      groceryItem: {
        include: {
          category: true
        }
      },
      store: true
    },
    orderBy: [{ status: "asc" }, { expirationDate: "asc" }, { createdAt: "desc" }]
  });
}

export async function getExpiringInventoryItems(limit = 5) {
  return prisma.inventoryItem.findMany({
    where: {
      status: "available",
      expirationDate: {
        lte: await expiringCutoff()
      }
    },
    include: {
      groceryItem: true
    },
    orderBy: [{ expirationDate: "asc" }, { createdAt: "desc" }],
    take: limit
  });
}

export async function getInventoryDashboardData() {
  const cutoff = await expiringCutoff();
  const [expiringItems, availableCount, expiringCount] = await Promise.all([
    getExpiringInventoryItems(5),
    prisma.inventoryItem.count({
      where: {
        status: "available"
      }
    }),
    prisma.inventoryItem.count({
      where: {
        status: "available",
        expirationDate: { lte: cutoff }
      }
    })
  ]);

  return {
    availableCount,
    expiringCount,
    expiringItems
  };
}

export async function getRecentInventoryTransactions(limit = 8) {
  return prisma.inventoryTransaction.findMany({
    include: {
      groceryItem: true,
      inventoryItem: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });
}

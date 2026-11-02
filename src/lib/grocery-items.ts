import { Prisma, type PrismaClient } from "@prisma/client";
import type { Locale } from "@/lib/i18n/config";
import { normalizeGroceryName } from "@/lib/inventory";

type Db = Prisma.TransactionClient | PrismaClient;

type GroceryExtras = {
  categoryId?: string;
  defaultUnit?: string;
  isPerishable?: boolean;
};

function extrasUpdate(extras: GroceryExtras) {
  return {
    ...(extras.categoryId ? { categoryId: extras.categoryId } : {}),
    ...(extras.defaultUnit ? { defaultUnit: extras.defaultUnit } : {}),
    ...(extras.isPerishable ? { isPerishable: true } : {})
  };
}

/**
 * Finds a grocery item whose canonical, English, or Spanish name matches.
 * Matching is case-insensitive and whitespace-normalized for the canonical
 * name, and case-insensitive for the per-language names.
 */
export async function findGroceryItemByAnyName(db: Db, name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeGroceryName(trimmed);

  if (!normalizedName) {
    return null;
  }

  return db.groceryItem.findFirst({
    where: {
      OR: [
        { normalizedName },
        { nameEn: { equals: trimmed, mode: "insensitive" } },
        { nameEs: { equals: trimmed, mode: "insensitive" } }
      ]
    }
  });
}

/**
 * Reuses a grocery item by any of its names, or creates it. A newly typed
 * name is stored as the canonical name and as the name for the language the
 * person was using, so it displays correctly in that language.
 */
export async function findOrCreateGroceryItemByName(
  db: Db,
  name: string,
  locale: Locale,
  extras: GroceryExtras = {}
) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const existing = await findGroceryItemByAnyName(db, trimmed);

  if (existing) {
    const update = extrasUpdate(extras);

    return Object.keys(update).length > 0
      ? db.groceryItem.update({ where: { id: existing.id }, data: update })
      : existing;
  }

  return db.groceryItem.create({
    data: {
      name: trimmed,
      normalizedName: normalizeGroceryName(trimmed),
      ...(locale === "es" ? { nameEs: trimmed } : { nameEn: trimmed }),
      categoryId: extras.categoryId,
      defaultUnit: extras.defaultUnit,
      isPerishable: extras.isPerishable ?? false
    }
  });
}

/**
 * Recipe ingredients carry an English and/or Spanish name. Reuses the item
 * matched by either name and fills in whichever translation is provided.
 */
export async function upsertBilingualGroceryItem(
  db: Db,
  names: { en?: string; es?: string },
  extras: GroceryExtras = {}
) {
  const en = names.en?.trim().replace(/\s+/g, " ") || undefined;
  const es = names.es?.trim().replace(/\s+/g, " ") || undefined;
  const existing =
    (en ? await findGroceryItemByAnyName(db, en) : null) ??
    (es ? await findGroceryItemByAnyName(db, es) : null);

  if (existing) {
    return db.groceryItem.update({
      where: { id: existing.id },
      data: {
        ...(en ? { nameEn: en } : {}),
        ...(es ? { nameEs: es } : {}),
        ...extrasUpdate(extras)
      }
    });
  }

  const canonical = en ?? es ?? "";

  return db.groceryItem.create({
    data: {
      name: canonical,
      normalizedName: normalizeGroceryName(canonical),
      nameEn: en,
      nameEs: es,
      categoryId: extras.categoryId,
      defaultUnit: extras.defaultUnit,
      isPerishable: extras.isPerishable ?? false
    }
  });
}

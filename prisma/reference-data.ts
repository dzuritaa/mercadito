import type { PrismaClient } from "@prisma/client";

/**
 * Reference data every installation needs. Names are stored in English and
 * translated in the interface (see src/lib/i18n/dictionaries).
 */
export const categories = [
  { name: "Fruits and Vegetables", sortOrder: 1 },
  { name: "Meat and Seafood", sortOrder: 2 },
  { name: "Dairy and Eggs", sortOrder: 3 },
  { name: "Pantry", sortOrder: 4 },
  { name: "Frozen", sortOrder: 5 },
  { name: "Spices", sortOrder: 6 },
  { name: "Snacks", sortOrder: 7 },
  { name: "Drinks", sortOrder: 8 },
  { name: "Cleaning and Household", sortOrder: 9 },
  { name: "Other", sortOrder: 10 }
];

export const recipeTags = [
  { name: "Healthy", description: "Good everyday healthy option" },
  { name: "Moderate", description: "Acceptable but not ideal every day" },
  { name: "Treat Meal", description: "Higher calorie or less healthy meal" },
  { name: "Kid-Friendly", description: "Usually accepted by kids" },
  { name: "Vegetarian", description: "No meat or seafood" },
  { name: "Budget Meal", description: "Lower cost meal" },
  { name: "Fast Meal", description: "Can be prepared quickly" },
  { name: "High Protein", description: "Higher protein option" },
  {
    name: "Uses Expiring Items",
    description: "Good for ingredients close to expiration"
  },
  { name: "Freezer Friendly", description: "Can be frozen or batch cooked" },
  { name: "Lunchbox Friendly", description: "Works well for lunch" }
];

export async function seedReferenceData(prisma: PrismaClient) {
  for (const category of categories) {
    await prisma.groceryCategory.upsert({
      where: { name: category.name },
      update: { sortOrder: category.sortOrder },
      create: category
    });
  }

  for (const tag of recipeTags) {
    await prisma.recipeTag.upsert({
      where: { name: tag.name },
      update: { description: tag.description },
      create: tag
    });
  }
}

import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  findGroceryItemByAnyName,
  findOrCreateGroceryItemByName,
  upsertBilingualGroceryItem
} from "@/lib/grocery-items";

describe("grocery items in two languages", () => {
  it("creates a recipe ingredient with both names and reuses it in either language", async () => {
    const created = await upsertBilingualGroceryItem(prisma, { en: "Rice", es: "Arroz" });

    expect(created).toMatchObject({ name: "Rice", nameEn: "Rice", nameEs: "Arroz" });
    expect((await findGroceryItemByAnyName(prisma, "arroz"))?.id).toBe(created.id);
    expect((await findGroceryItemByAnyName(prisma, "  RICE "))?.id).toBe(created.id);
  });

  it("adds a missing translation to an existing item instead of duplicating it", async () => {
    const english = await upsertBilingualGroceryItem(prisma, { en: "Spinach" });
    const updated = await upsertBilingualGroceryItem(prisma, { en: "Spinach", es: "Espinaca" });

    expect(updated.id).toBe(english.id);
    expect(updated.nameEs).toBe("Espinaca");
    expect(await prisma.groceryItem.count()).toBe(1);
  });

  it("stores a newly typed name in the language the person was using", async () => {
    const spanish = await findOrCreateGroceryItemByName(prisma, "Plátano verde", "es");
    expect(spanish).toMatchObject({ name: "Plátano verde", nameEs: "Plátano verde", nameEn: null });

    const english = await findOrCreateGroceryItemByName(prisma, "Kale", "en");
    expect(english).toMatchObject({ nameEn: "Kale", nameEs: null });
  });

  it("matches the pantry entry typed in Spanish to the recipe ingredient in English", async () => {
    const recipeItem = await upsertBilingualGroceryItem(prisma, { en: "Carrots", es: "Zanahorias" });
    const pantryItem = await findOrCreateGroceryItemByName(prisma, "zanahorias", "es", {
      categoryId: (await prisma.groceryCategory.findFirstOrThrow()).id
    });

    expect(pantryItem.id).toBe(recipeItem.id);
    expect(pantryItem.categoryId).not.toBeNull();
  });
});

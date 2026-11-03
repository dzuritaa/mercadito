import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { markRecipeCooked } from "@/lib/cooking";
import { createHousehold, createRecipe, stock } from "./fixtures";

describe("cooking deducts from the pantry", () => {
  it("uses what expires first and marks emptied items as used", async () => {
    await createHousehold();
    const recipe = await createRecipe({
      nameEn: "Rice",
      servings: 4,
      ingredients: [{ item: "Rice", quantity: "3", unit: "cups" }]
    });
    const later = await stock("Rice", { quantity: "5", unit: "cups", expiresInDays: 30 });
    const sooner = await stock("Rice", { quantity: "2", unit: "cups", expiresInDays: 2 });

    const result = await markRecipeCooked({ recipeId: recipe.id, servingsCooked: 4 });
    expect(result).toMatchObject({ deductedCount: 1, partialCount: 0, manualReviewCount: 0 });

    const soonerAfter = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: sooner.id } });
    const laterAfter = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: later.id } });
    expect(soonerAfter.quantity?.toString()).toBe("0");
    expect(soonerAfter.status).toBe("used");
    expect(laterAfter.quantity?.toString()).toBe("4");
    expect(laterAfter.status).toBe("available");
    expect(await prisma.inventoryTransaction.count({ where: { source: "recipe_cooked" } })).toBe(2);
  });

  it("scales quantities by servings cooked", async () => {
    await createHousehold();
    const recipe = await createRecipe({
      nameEn: "Soup",
      servings: 4,
      ingredients: [{ item: "Lentils", quantity: "2", unit: "cups" }]
    });
    const lentils = await stock("Lentils", { quantity: "5", unit: "cups" });

    await markRecipeCooked({ recipeId: recipe.id, servingsCooked: 2 });
    const after = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: lentils.id } });
    expect(after.quantity?.toString()).toBe("4");
  });

  it("records partial deductions and items to review, in the active language", async () => {
    await createHousehold();
    const recipe = await createRecipe({
      nameEn: "Mixed",
      servings: 4,
      ingredients: [
        { item: "Rice", quantity: "3", unit: "cups" },
        { item: "Chicken", quantity: "1", unit: "lb" },
        { item: "Salt", quantityDescription: "to taste" },
        { item: "Lemon", quantity: "1", unit: "each", optional: true }
      ]
    });
    await stock("Rice", { quantity: "1", unit: "cups" });
    await stock("Chicken", { quantity: "500", unit: "g" }); // unit doesn't match
    await stock("Lemon", { quantity: "2", unit: "each" });

    const result = await markRecipeCooked({ recipeId: recipe.id, servingsCooked: 4, locale: "es" });
    expect(result).toMatchObject({ deductedCount: 0, partialCount: 1, manualReviewCount: 3 });

    const rows = await prisma.cookedMealIngredient.findMany();
    const byName = Object.fromEntries(rows.map((row) => [row.ingredientName, row]));
    expect(byName.Rice.deductionStatus).toBe("partial");
    expect(byName.Rice.notes).toBe("Solo había 1 tazas con la unidad exacta.");
    expect(byName.Chicken.deductionStatus).toBe("manual_review");
    expect(byName.Salt.notes).toMatch(/Sin cantidad y unidad exactas/);
    expect(byName.Lemon.notes).toMatch(/Ingrediente opcional/);

    // Optional ingredients are never deducted automatically.
    const lemon = await prisma.inventoryItem.findFirstOrThrow({ where: { unit: "each" } });
    expect(lemon.quantity?.toString()).toBe("2");
  });

  it("marks the linked meal plan item as cooked", async () => {
    await createHousehold();
    const recipe = await createRecipe({ nameEn: "R", ingredients: [{ item: "A", quantity: "1", unit: "each" }] });
    const plan = await prisma.mealPlan.create({
      data: {
        status: "approved",
        weekStartDate: new Date(Date.UTC(2026, 10, 2)),
        items: {
          create: [{ recipeId: recipe.id, plannedDate: new Date(Date.UTC(2026, 10, 2)), mealType: "lunch_and_dinner", servingsPlanned: 4, status: "planned" }]
        }
      },
      include: { items: true }
    });

    await markRecipeCooked({ recipeId: recipe.id, servingsCooked: 4, mealPlanItemId: plan.items[0].id });
    const item = await prisma.mealPlanItem.findUniqueOrThrow({ where: { id: plan.items[0].id } });
    expect(item.status).toBe("cooked");
  });

  it("rejects invalid input", async () => {
    await createHousehold();
    const recipe = await createRecipe({ nameEn: "R", ingredients: [{ item: "A", quantity: "1", unit: "each" }] });
    const other = await createRecipe({ nameEn: "Other", ingredients: [{ item: "B", quantity: "1", unit: "each" }] });
    const plan = await prisma.mealPlan.create({
      data: {
        weekStartDate: new Date(Date.UTC(2026, 10, 2)),
        items: { create: [{ recipeId: other.id, plannedDate: new Date(Date.UTC(2026, 10, 2)), mealType: "dinner", servingsPlanned: 4 }] }
      },
      include: { items: true }
    });

    await expect(markRecipeCooked({ recipeId: recipe.id, servingsCooked: 0 })).rejects.toThrow("servingsCookedMin");
    await expect(
      markRecipeCooked({ recipeId: recipe.id, servingsCooked: 1, mealPlanItemId: plan.items[0].id })
    ).rejects.toThrow("mealPlanItemMismatch");
    expect(await prisma.cookedMeal.count()).toBe(0);
  });
});

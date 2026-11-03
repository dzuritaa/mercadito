import { describe, expect, it } from "vitest";
import { getRecipeMatches, getRecipeMatchForRecipe } from "@/lib/recipe-matching";
import { createHousehold, createRecipe, stock } from "./fixtures";

describe("recipe matching", () => {
  it("marks ingredients available, unverified, substituted, or missing", async () => {
    await createHousehold();
    const recipe = await createRecipe({
      nameEn: "Bowl",
      ingredients: [
        { item: "Rice", quantity: "2", unit: "cups" },
        { item: "Chicken", quantity: "1", unit: "lb" },
        { item: "Spinach", quantity: "1", unit: "cups" },
        { item: "Carrots", quantity: "2", unit: "each" }
      ],
      substitutions: [{ original: "Spinach", substitute: "Kale" }]
    });
    await stock("Rice", { quantity: "4", unit: "cups" });
    await stock("Chicken", { quantity: "500", unit: "g" }); // different unit
    await stock("Kale", { quantity: "2", unit: "cups" }); // substitute only

    const match = await getRecipeMatchForRecipe(recipe.id, "en");
    const status = Object.fromEntries(
      match!.ingredients.map((ingredient) => [ingredient.ingredientName, ingredient.status])
    );

    expect(status).toEqual({
      Rice: "available",
      Chicken: "available_unverified_quantity",
      Spinach: "substituted",
      Carrots: "missing"
    });
    expect(match!.missingRequiredCount).toBe(1);
    expect(match!.availableRequiredCount).toBe(3);
  });

  it("treats not enough of the same unit as missing", async () => {
    await createHousehold();
    const recipe = await createRecipe({
      nameEn: "Rice",
      ingredients: [{ item: "Rice", quantity: "3", unit: "cups" }]
    });
    await stock("Rice", { quantity: "1", unit: "cups" });
    await stock("Rice", { quantity: "1", unit: "cups" });

    const match = await getRecipeMatchForRecipe(recipe.id, "en");
    expect(match!.ingredients[0].status).toBe("missing");
  });

  it("ignores optional ingredients when counting what's missing", async () => {
    await createHousehold();
    const recipe = await createRecipe({
      nameEn: "Soup",
      ingredients: [
        { item: "Lentils", quantity: "1", unit: "cups" },
        { item: "Lemon", quantity: "1", unit: "each", optional: true }
      ]
    });
    await stock("Lentils", { quantity: "2", unit: "cups" });

    const match = await getRecipeMatchForRecipe(recipe.id, "en");
    expect(match!.missingRequiredCount).toBe(0);
    expect(match!.optionalMissingCount).toBe(1);
  });

  it("ranks ready recipes first and rewards expiring ingredients", async () => {
    await createHousehold({ expiringSoonDays: 3 });
    await createRecipe({
      nameEn: "Needs shopping",
      ingredients: [
        { item: "A", quantity: "1", unit: "each" },
        { item: "B", quantity: "1", unit: "each" },
        { item: "C", quantity: "1", unit: "each" }
      ]
    });
    await createRecipe({ nameEn: "Ready", ingredients: [{ item: "D", quantity: "1", unit: "each" }] });
    await createRecipe({
      nameEn: "Ready and expiring",
      ingredients: [{ item: "E", quantity: "1", unit: "each" }]
    });
    await stock("D", { quantity: "1", unit: "each", expiresInDays: 10 });
    await stock("E", { quantity: "1", unit: "each", expiresInDays: 2 });

    const matches = await getRecipeMatches({ locale: "en" });
    expect(matches.map((match) => match.recipe.name)).toEqual([
      "Ready and expiring",
      "Ready",
      "Needs shopping"
    ]);
    expect(matches[0].expiringMatchedCount).toBe(1);
    expect(matches[1].expiringMatchedCount).toBe(0); // 10 days is beyond the 3-day window
  });

  it("only includes active recipes and uses the requested language", async () => {
    await createHousehold();
    await createRecipe({
      nameEn: "Lentil soup",
      nameEs: "Sopa de lentejas",
      ingredients: [{ item: "Lentils", quantity: "1", unit: "cups" }]
    });
    const archived = await createRecipe({
      nameEn: "Old recipe",
      ingredients: [{ item: "X", quantity: "1", unit: "each" }]
    });
    const { prisma } = await import("@/lib/prisma");
    await prisma.recipe.update({ where: { id: archived.id }, data: { isActive: false } });

    const spanish = await getRecipeMatches({ locale: "es" });
    expect(spanish.map((match) => match.recipe.name)).toEqual(["Sopa de lentejas"]);
    expect(spanish[0].explanations[0]).toMatch(/Falta 1 ingrediente obligatorio/);
  });
});

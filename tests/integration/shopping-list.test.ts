import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createShoppingListFromMealPlan } from "@/lib/shopping-lists";
import { approvedPlan, createHousehold, createRecipe, stock } from "./fixtures";

const WEEK = new Date(Date.UTC(2026, 10, 2));

async function listItems() {
  const list = await prisma.shoppingList.findFirstOrThrow({
    include: { items: { include: { groceryItem: true } } }
  });

  return {
    list,
    byName: Object.fromEntries(list.items.map((item) => [item.groceryItem!.name, item]))
  };
}

describe("shopping list from an approved plan", () => {
  it("adds up repeated ingredients and subtracts exact inventory", async () => {
    await createHousehold();
    const first = await createRecipe({
      nameEn: "First",
      ingredients: [
        { item: "Rice", quantity: "2", unit: "cups" },
        { item: "Carrots", quantity: "3", unit: "each" }
      ]
    });
    const second = await createRecipe({
      nameEn: "Second",
      ingredients: [{ item: "Rice", quantity: "1", unit: "cups" }]
    });
    await stock("Rice", { quantity: "1", unit: "cups" });
    await stock("Carrots", { quantity: "5", unit: "each" });
    const plan = await approvedPlan(WEEK, [first.id, second.id]);

    const result = await createShoppingListFromMealPlan(plan.id, "en");
    expect(result.redirectPath).toContain("notice=shoppingListGenerated");

    const { list, byName } = await listItems();
    expect(byName.Rice.neededQuantity?.toString()).toBe("3");
    expect(byName.Rice.haveQuantity?.toString()).toBe("1");
    expect(byName.Rice.buyQuantity?.toString()).toBe("2");
    expect(byName.Carrots.buyQuantity?.toString()).toBe("0"); // already have enough
    expect(list.targetEndDate?.toISOString().slice(0, 10)).toBe("2026-11-03");
  });

  it("leaves out optional ingredients and skipped meals", async () => {
    await createHousehold();
    const recipe = await createRecipe({
      nameEn: "Soup",
      ingredients: [
        { item: "Lentils", quantity: "1", unit: "cups" },
        { item: "Lemon", quantity: "1", unit: "each", optional: true }
      ]
    });
    const skipped = await createRecipe({
      nameEn: "Skipped",
      ingredients: [{ item: "Fish", quantity: "1", unit: "lb" }]
    });
    const plan = await approvedPlan(WEEK, [recipe.id]);
    await prisma.mealPlanItem.create({
      data: {
        mealPlanId: plan.id,
        recipeId: skipped.id,
        plannedDate: new Date(Date.UTC(2026, 10, 4)),
        mealType: "lunch_and_dinner",
        servingsPlanned: 4,
        status: "skipped"
      }
    });

    await createShoppingListFromMealPlan(plan.id, "en");
    const { byName } = await listItems();
    expect(Object.keys(byName)).toEqual(["Lentils"]);
  });

  it("flags amounts that need review, in the active language", async () => {
    await createHousehold();
    const recipe = await createRecipe({
      nameEn: "Salad",
      ingredients: [{ item: "Lettuce", quantityDescription: "1 head" }]
    });
    await stock("Lettuce", { quantityDescription: "half a head" });
    const plan = await approvedPlan(WEEK, [recipe.id]);

    await createShoppingListFromMealPlan(plan.id, "es");
    const { list, byName } = await listItems();
    expect(byName.Lettuce.buyQuantity).toBeNull();
    expect(byName.Lettuce.notes).toContain("Revisar cantidad: 1 head.");
    expect(byName.Lettuce.notes).toContain("Hay una cantidad aproximada en la despensa");
    expect(list.name).toMatch(/^Lista de compras, semana del/);
  });

  it("does not create a second active list for the same plan", async () => {
    await createHousehold();
    const recipe = await createRecipe({ nameEn: "R", ingredients: [{ item: "A", quantity: "1", unit: "each" }] });
    const plan = await approvedPlan(WEEK, [recipe.id]);

    await createShoppingListFromMealPlan(plan.id, "en");
    const second = await createShoppingListFromMealPlan(plan.id, "en");
    expect(second.redirectPath).toContain("notice=shoppingListExists");
    expect(await prisma.shoppingList.count()).toBe(1);
  });

  it("requires an approved plan", async () => {
    await createHousehold();
    const result = await createShoppingListFromMealPlan(undefined, "en");
    expect(result.redirectPath).toContain("error=approvePlanFirst");
  });
});

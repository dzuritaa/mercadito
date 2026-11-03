import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { generateWeeklyMealPlan, getMealPlannerPageData } from "@/lib/meal-planner";
import { createHousehold, createRecipe } from "./fixtures";

const WEEK = "2026-11-02"; // a Monday

async function recipes(count: number, tags: string[] = []) {
  const created = [];

  for (let index = 0; index < count; index += 1) {
    created.push(
      await createRecipe({
        nameEn: `Recipe ${index + 1}${tags.length ? ` (${tags.join(",")})` : ""}`,
        tags,
        ingredients: [{ item: `Item ${tags.join("")}${index}`, quantity: "1", unit: "each" }]
      })
    );
  }

  return created;
}

async function generatedItems() {
  const plan = await prisma.mealPlan.findFirstOrThrow({
    where: { weekStartDate: new Date(`${WEEK}T00:00:00Z`) },
    include: { items: { include: { recipe: { include: { tags: { include: { tag: true } } } } }, orderBy: [{ plannedDate: "asc" }, { mealType: "asc" }] } }
  });

  return plan.items;
}

describe("weekly meal plan generation", () => {
  it("fills Monday to Friday with one shared meal per day by default", async () => {
    await createHousehold();
    await recipes(6);

    const result = await generateWeeklyMealPlan(WEEK, "en");
    expect(result.redirectPath).toContain("notice=draftGenerated");

    const items = await generatedItems();
    expect(items).toHaveLength(5);
    expect(items.every((item) => item.mealType === "lunch_and_dinner")).toBe(true);
    expect(items.map((item) => item.plannedDate.toISOString().slice(0, 10))).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06"
    ]);
    expect(new Set(items.map((item) => item.recipeId)).size).toBe(5);
    expect(items.every((item) => item.status === "suggested")).toBe(true);
  });

  it("plans separate lunch and dinner on the chosen days", async () => {
    await createHousehold({ planDays: [6, 7], mealPattern: "separate_lunch_dinner" });
    await recipes(4);

    await generateWeeklyMealPlan(WEEK, "en");
    const items = await generatedItems();

    expect(items.map((item) => `${item.plannedDate.toISOString().slice(0, 10)} ${item.mealType}`)).toEqual([
      "2026-11-07 lunch",
      "2026-11-07 dinner",
      "2026-11-08 lunch",
      "2026-11-08 dinner"
    ]);
  });

  it("repeats recipes when there are fewer than the slots, and warns", async () => {
    await createHousehold();
    await recipes(2);

    await generateWeeklyMealPlan(WEEK, "en");
    const items = await generatedItems();
    expect(items).toHaveLength(5);
    expect(new Set(items.map((item) => item.recipeId)).size).toBe(2);

    const page = await getMealPlannerPageData(WEEK, "en");
    expect(page.warnings).toContain("recipesRepeat");
  });

  it("includes a vegetarian meal when the household wants one", async () => {
    await createHousehold({ includeVegetarian: true });
    await recipes(6);
    await recipes(1, ["Vegetarian"]);

    await generateWeeklyMealPlan(WEEK, "en");
    const items = await generatedItems();
    expect(
      items.some((item) => item.recipe.tags.some((tagMap) => tagMap.tag.name === "Vegetarian"))
    ).toBe(true);
  });

  it("uses only vegetarian recipes when every member is vegetarian or vegan", async () => {
    await createHousehold({
      members: [
        { name: "A", dietaryRestrictions: ["vegetarian"] },
        { name: "B", dietaryRestrictions: ["vegan"] }
      ]
    });
    await recipes(4);
    await recipes(2, ["Vegetarian"]);

    await generateWeeklyMealPlan(WEEK, "en");
    const items = await generatedItems();
    expect(
      items.every((item) => item.recipe.tags.some((tagMap) => tagMap.tag.name === "Vegetarian"))
    ).toBe(true);
  });

  it("warns when no vegetarian recipe exists", async () => {
    await createHousehold({ includeVegetarian: true });
    await recipes(5);

    await generateWeeklyMealPlan(WEEK, "en");
    const page = await getMealPlannerPageData(WEEK, "en");
    expect(page.warnings).toContain("noVegetarianAvailable");
  });

  it("refuses to replace an approved week and replaces a draft", async () => {
    await createHousehold();
    await recipes(5);

    await generateWeeklyMealPlan(WEEK, "en");
    await generateWeeklyMealPlan(WEEK, "en");
    expect(await prisma.mealPlan.count()).toBe(1);

    await prisma.mealPlan.updateMany({ data: { status: "approved" } });
    const result = await generateWeeklyMealPlan(WEEK, "en");
    expect(result.redirectPath).toContain("error=weekAlreadyApproved");
    expect(await prisma.mealPlan.count()).toBe(1);
  });

  it("asks for recipes when there are none", async () => {
    await createHousehold();
    const result = await generateWeeklyMealPlan(WEEK, "en");
    expect(result.redirectPath).toContain("error=addRecipesFirst");
  });
});

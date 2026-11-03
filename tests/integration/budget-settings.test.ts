import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getHouseholdSettings, householdDefaults } from "@/lib/household";
import { getDashboardSpendingData } from "@/lib/reports";
import { createHousehold } from "./fixtures";

async function purchase(type: "grocery" | "online_delivery" | "eating_out" | "household", amount: string) {
  await prisma.purchase.create({
    data: { purchaseDate: new Date(), purchaseType: type, totalAmount: amount }
  });
}

describe("household settings", () => {
  it("uses safe defaults before setup", async () => {
    const settings = await getHouseholdSettings();
    expect(settings).toMatchObject({
      currency: householdDefaults.currency,
      monthlyBudget: null,
      planDays: [1, 2, 3, 4, 5],
      expiringSoonDays: 5,
      allVegetarian: false
    });
  });

  it("turns a weekly budget into a monthly one", async () => {
    await createHousehold({ budgetAmount: 1200, budgetPeriod: "weekly" });
    expect((await getHouseholdSettings()).monthlyBudget).toBe(5200);
  });

  it("knows when the whole household is vegetarian", async () => {
    await createHousehold({
      members: [
        { name: "A", dietaryRestrictions: ["vegan", "nut_allergy"] },
        { name: "B", dietaryRestrictions: ["vegetarian"] }
      ]
    });
    expect((await getHouseholdSettings()).allVegetarian).toBe(true);
  });
});

describe("monthly spending", () => {
  it("counts grocery and delivery against the budget, and the rest separately", async () => {
    await createHousehold({ budgetAmount: 300 });
    await purchase("grocery", "100.50");
    await purchase("online_delivery", "20");
    await purchase("eating_out", "45");
    await purchase("household", "12");

    const { budget, totals } = await getDashboardSpendingData("en");
    expect(budget).toEqual({ grocerySpent: 120.5, target: 300, remaining: 179.5, usedPercent: 40 });
    expect(totals.eatingOutSpent).toBe(45);
    expect(totals.householdSpent).toBe(12);
  });

  it("has no target when the household has no budget", async () => {
    await createHousehold({ budgetAmount: null });
    await purchase("grocery", "50");

    const { budget } = await getDashboardSpendingData("en");
    expect(budget).toMatchObject({ grocerySpent: 50, target: null, remaining: null });
  });
});

import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { addDays, daysUntilLabel, formatQuantity, startOfToday } from "@/lib/inventory";
import { parseWeekStartDate, planSlots, weekEndDate } from "@/lib/meal-planner";
import {
  cleanIdParam,
  formatRecipeQuantity,
  formatRecipeRating,
  formatRecipeTime
} from "@/lib/recipes";

const es = getDictionary("es");
const monday = new Date(Date.UTC(2026, 10, 2));

describe("planSlots", () => {
  it("makes one shared slot per planned day", () => {
    const slots = planSlots(monday, [1, 2, 3, 4, 5], "shared_lunch_dinner");
    expect(slots).toHaveLength(5);
    expect(slots.every((slot) => slot.mealType === "lunch_and_dinner")).toBe(true);
    expect(slots[4].date.toISOString().slice(0, 10)).toBe("2026-11-06");
  });

  it("makes lunch and dinner slots for separate meals", () => {
    const slots = planSlots(monday, [6, 7], "separate_lunch_dinner");
    expect(slots.map((slot) => [slot.date.toISOString().slice(0, 10), slot.mealType])).toEqual([
      ["2026-11-07", "lunch"],
      ["2026-11-07", "dinner"],
      ["2026-11-08", "lunch"],
      ["2026-11-08", "dinner"]
    ]);
  });

  it("supports lunch-only and dinner-only households", () => {
    expect(planSlots(monday, [1], "lunch_only")[0].mealType).toBe("lunch");
    expect(planSlots(monday, [1], "dinner_only")[0].mealType).toBe("dinner");
  });

  it("ends the week on the last planned day", () => {
    expect(weekEndDate(monday, [1, 3, 6]).toISOString().slice(0, 10)).toBe("2026-11-07");
  });
});

describe("parseWeekStartDate", () => {
  it("snaps any date to that week's Monday", () => {
    expect(parseWeekStartDate("2026-11-05").toISOString().slice(0, 10)).toBe("2026-11-02");
    expect(parseWeekStartDate("2026-11-08").toISOString().slice(0, 10)).toBe("2026-11-02");
  });

  it("falls back to the current week for invalid input", () => {
    expect(parseWeekStartDate("not-a-date").getUTCDay()).toBe(1);
  });
});

describe("quantities and dates", () => {
  it("formats exact and approximate amounts with translated units", () => {
    expect(formatQuantity(new Prisma.Decimal("1.5"), "cups", null, es)).toBe("1.5 tazas");
    expect(formatQuantity(new Prisma.Decimal("2"), "each", "grandes", es)).toBe("2 unid. (grandes)");
    expect(formatQuantity(null, null, "media funda", es)).toBe("media funda");
    expect(formatQuantity(null, null, null, es)).toBe("Sin definir");
    expect(formatRecipeQuantity(null, null, null, es)).toBe("Al gusto");
  });

  it("labels days until expiry", () => {
    const today = startOfToday();
    expect(daysUntilLabel(today, es)).toBe("Hoy");
    expect(daysUntilLabel(addDays(today, 1), es)).toBe("1 día");
    expect(daysUntilLabel(addDays(today, -2), es)).toBe("vencido hace 2 días");
    expect(daysUntilLabel(null, es)).toBe("Sin fecha");
  });

  it("formats times and ratings", () => {
    expect(formatRecipeTime(45, es)).toBe("45 min");
    expect(formatRecipeTime(90, es)).toBe("1 h 30 min");
    expect(formatRecipeTime(null, es)).toBe("Sin definir");
    expect(formatRecipeRating(4, es)).toBe("4/5");
    expect(formatRecipeRating(null, es)).toBe("Sin calificar");
  });
});

describe("cleanIdParam", () => {
  it("accepts UUIDs and ignores anything else", () => {
    expect(cleanIdParam("9affe45b-4356-4339-bfb7-2e0094ff1730")).toBe(
      "9affe45b-4356-4339-bfb7-2e0094ff1730"
    );
    expect(cleanIdParam("x")).toBeUndefined();
    expect(cleanIdParam("1; drop table recipes")).toBeUndefined();
    expect(cleanIdParam(undefined)).toBeUndefined();
  });
});

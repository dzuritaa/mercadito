import { describe, expect, it } from "vitest";
import { hasLocalized, intlLocale, isLocale, pickLocalized } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  categoryName,
  cookingNoteText,
  formatCurrency,
  groceryName,
  messageText,
  recipeLanguages,
  tagName,
  unitLabel,
  weekdayName
} from "@/lib/i18n/text";

const en = getDictionary("en");
const es = getDictionary("es");

describe("pickLocalized", () => {
  it("uses the requested language when it has text", () => {
    expect(pickLocalized("es", "Rice", "Arroz")).toBe("Arroz");
    expect(pickLocalized("en", "Rice", "Arroz")).toBe("Rice");
  });

  it("falls back to the other language when the text is missing or blank", () => {
    expect(pickLocalized("es", "Rice", null)).toBe("Rice");
    expect(pickLocalized("en", "   ", "Arroz")).toBe("Arroz");
  });

  it("returns an empty string when neither language has text", () => {
    expect(pickLocalized("es", null, undefined)).toBe("");
  });

  it("hasLocalized only counts the requested language", () => {
    expect(hasLocalized("es", "Rice", null)).toBe(false);
    expect(hasLocalized("en", "Rice", null)).toBe(true);
  });
});

describe("locale helpers", () => {
  it("accepts only supported locales", () => {
    expect(isLocale("es")).toBe(true);
    expect(isLocale("pt")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("maps locales to Intl tags", () => {
    expect(intlLocale("es")).toBe("es-EC");
    expect(intlLocale("en")).toBe("en-US");
  });
});

describe("messageText", () => {
  it("translates known message keys", () => {
    expect(messageText(es, "recipeAdded")).toBe("Receta agregada.");
    expect(messageText(en, "recipeAdded")).toBe("Recipe added.");
  });

  it("shows unknown text as-is and ignores empty values", () => {
    expect(messageText(es, "Algo pasó")).toBe("Algo pasó");
    expect(messageText(es, undefined)).toBeNull();
  });
});

describe("reference names", () => {
  it("translates seeded categories, tags, and units, and keeps custom ones", () => {
    expect(categoryName(es, "Fruits and Vegetables")).toBe("Frutas y verduras");
    expect(categoryName(es, "Mi categoría")).toBe("Mi categoría");
    expect(categoryName(es, null)).toBe("Sin categoría");
    expect(tagName(es, "Vegetarian")).toBe("Vegetariana");
    expect(unitLabel(es, "cups")).toBe("tazas");
    expect(unitLabel(en, "cups")).toBe("cups");
  });

  it("chooses grocery names by language with the canonical name as fallback", () => {
    const item = { name: "Rice", nameEn: "Rice", nameEs: "Arroz" };
    expect(groceryName("es", item)).toBe("Arroz");
    expect(groceryName("es", { name: "Quinoa", nameEn: null, nameEs: null })).toBe("Quinoa");
  });

  it("reports which recipe languages exist", () => {
    expect(recipeLanguages({ nameEn: "Soup", nameEs: null })).toEqual({ en: true, es: false });
  });
});

describe("formatCurrency", () => {
  it("follows the household's region when a country is given", () => {
    expect(formatCurrency("es", 5200, "MXN", "MX")).toBe("$5,200.00");
    expect(formatCurrency("es", 5200, "USD", "EC")).toBe("$5.200,00");
  });

  it("falls back to the language default without a country", () => {
    expect(formatCurrency("en", 12.5, "USD")).toBe("$12.50");
  });
});

describe("weekdayName", () => {
  it("names calendar dates in UTC, regardless of the server time zone", () => {
    // 2026-11-02 is a Monday; stored as UTC midnight like @db.Date values.
    const monday = new Date(Date.UTC(2026, 10, 2));
    expect(weekdayName("es", monday)).toBe("Lunes");
    expect(weekdayName("en", monday)).toBe("Monday");
  });
});

describe("cookingNoteText", () => {
  it("shows stored system notes in the current language", () => {
    expect(cookingNoteText(es, en.cooking.noteOptional)).toBe(es.cooking.noteOptional);
    expect(cookingNoteText(en, es.cooking.noteNoExact)).toBe(en.cooking.noteNoExact);
  });

  it("keeps notes people typed", () => {
    expect(cookingNoteText(es, "Usé la mitad")).toBe("Usé la mitad");
  });
});

describe("dictionaries", () => {
  it("pluralize counted phrases", () => {
    expect(es.match.missingRequired(1)).toBe("Falta 1 ingrediente obligatorio.");
    expect(es.match.missingRequired(3)).toBe("Faltan 3 ingredientes obligatorios.");
    expect(en.common.days(1)).toBe("1 day");
    expect(en.common.days(2)).toBe("2 days");
  });
});

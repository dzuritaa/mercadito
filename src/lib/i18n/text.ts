import { intlLocale, pickLocalized, type Locale } from "./config";
import { getDictionary, type Dictionary } from "./dictionaries";

type MessageKey = keyof Dictionary["messages"];

/** Flash messages arrive as keys; unknown values are shown as-is. */
export function messageText(t: Dictionary, value: string | undefined) {
  if (!value) {
    return null;
  }

  return value in t.messages ? t.messages[value as MessageKey] : value;
}

export function unitLabel(t: Dictionary, unit: string | null | undefined) {
  if (!unit) {
    return "";
  }

  return t.units[unit] ?? unit;
}

export function categoryName(t: Dictionary, name: string | null | undefined) {
  if (!name) {
    return t.common.uncategorized;
  }

  return t.categories[name] ?? name;
}

export function tagName(t: Dictionary, name: string) {
  return t.tags[name] ?? name;
}

export function storeName(t: Dictionary, name: string) {
  return t.stores[name] ?? name;
}

export function locationLabel(t: Dictionary, location: string | null | undefined) {
  return location ? t.locations[location] ?? location : t.common.noLocation;
}

type GroceryNames = {
  name: string;
  nameEn?: string | null;
  nameEs?: string | null;
};

/** Grocery item display name for the active language. */
export function groceryName(locale: Locale, item: GroceryNames) {
  return pickLocalized(locale, item.nameEn ?? item.name, item.nameEs ?? item.name);
}

type RecipeNames = {
  nameEn: string | null;
  nameEs: string | null;
};

export function recipeName(locale: Locale, recipe: RecipeNames) {
  return pickLocalized(locale, recipe.nameEn, recipe.nameEs);
}

type RecipeDescriptions = {
  descriptionEn: string | null;
  descriptionEs: string | null;
};

export function recipeDescription(locale: Locale, recipe: RecipeDescriptions) {
  return pickLocalized(locale, recipe.descriptionEn, recipe.descriptionEs);
}

/** Which language versions a recipe has. */
export function recipeLanguages(recipe: RecipeNames) {
  return {
    en: Boolean(recipe.nameEn?.trim()),
    es: Boolean(recipe.nameEs?.trim())
  };
}

/**
 * Money in the household's currency. With a country, numbers follow that
 * region's conventions (es-MX: $5,200.00, es-EC: $5.200,00).
 */
export function formatCurrency(
  locale: Locale,
  value: number,
  currency = "USD",
  countryCode?: string
) {
  const tag =
    countryCode && countryCode !== "ZZ" ? `${locale}-${countryCode}` : intlLocale(locale);
  let formatterLocale = tag;

  try {
    Intl.NumberFormat.supportedLocalesOf([tag]);
  } catch {
    formatterLocale = intlLocale(locale);
  }

  return new Intl.NumberFormat(formatterLocale, {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

/** Short date for values stored as UTC calendar dates (Prisma @db.Date). */
export function formatCalendarDate(
  locale: Locale,
  date: Date,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
) {
  return date.toLocaleDateString(intlLocale(locale), { ...options, timeZone: "UTC" });
}

/** Date for timestamps; shown in the server's local time zone. */
export function formatTimestampDate(
  locale: Locale,
  date: Date,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
) {
  return date.toLocaleDateString(intlLocale(locale), options);
}

export function weekdayName(locale: Locale, date: Date) {
  const label = date.toLocaleDateString(intlLocale(locale), {
    timeZone: "UTC",
    weekday: "long"
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

const cookingNoteKeys = ["noteOptional", "noteNoExact", "noteNoInventory"] as const;

/**
 * Cooked-ingredient review notes are stored as text in the language active
 * when the meal was cooked. Known system notes are shown in the current
 * language; anything else (typed by a person) is shown as-is.
 */
export function cookingNoteText(t: Dictionary, note: string | null | undefined) {
  if (!note) {
    return null;
  }

  for (const key of cookingNoteKeys) {
    if (note === getDictionary("en").cooking[key] || note === getDictionary("es").cooking[key]) {
      return t.cooking[key];
    }
  }

  return note;
}

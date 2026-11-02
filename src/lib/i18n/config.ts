export const locales = ["es", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "es";

export const LOCALE_COOKIE = "mercadito_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** BCP 47 tag used for Intl date, number, and currency formatting. */
export function intlLocale(locale: Locale) {
  return locale === "es" ? "es-EC" : "en-US";
}

/**
 * Returns the text for the requested language, falling back to the other
 * language when the translation is missing.
 */
export function pickLocalized(
  locale: Locale,
  en: string | null | undefined,
  es: string | null | undefined
) {
  const primary = locale === "es" ? es : en;
  const fallback = locale === "es" ? en : es;

  return (primary?.trim() ? primary : fallback?.trim() ? fallback : "") ?? "";
}

/** True when the requested language has its own text (no fallback used). */
export function hasLocalized(
  locale: Locale,
  en: string | null | undefined,
  es: string | null | undefined
) {
  const value = locale === "es" ? es : en;
  return Boolean(value?.trim());
}

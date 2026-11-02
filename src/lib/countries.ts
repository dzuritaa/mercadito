import type { Locale } from "@/lib/i18n/config";
import { intlLocale } from "@/lib/i18n/config";

export type UnitSystemValue = "metric" | "imperial";

export type CountryDefaults = {
  code: string;
  currency: string;
  locale: Locale;
  unitSystem: UnitSystemValue;
};

/**
 * Starting defaults per country. People can change the currency, language,
 * and units afterwards; this only fills the setup form sensibly.
 */
export const countries: CountryDefaults[] = [
  { code: "AR", currency: "ARS", locale: "es", unitSystem: "metric" },
  { code: "BO", currency: "BOB", locale: "es", unitSystem: "metric" },
  { code: "BR", currency: "BRL", locale: "en", unitSystem: "metric" },
  { code: "CA", currency: "CAD", locale: "en", unitSystem: "metric" },
  { code: "CL", currency: "CLP", locale: "es", unitSystem: "metric" },
  { code: "CO", currency: "COP", locale: "es", unitSystem: "metric" },
  { code: "CR", currency: "CRC", locale: "es", unitSystem: "metric" },
  { code: "CU", currency: "CUP", locale: "es", unitSystem: "metric" },
  { code: "DO", currency: "DOP", locale: "es", unitSystem: "metric" },
  { code: "EC", currency: "USD", locale: "es", unitSystem: "metric" },
  { code: "SV", currency: "USD", locale: "es", unitSystem: "metric" },
  { code: "ES", currency: "EUR", locale: "es", unitSystem: "metric" },
  { code: "US", currency: "USD", locale: "en", unitSystem: "imperial" },
  { code: "GT", currency: "GTQ", locale: "es", unitSystem: "metric" },
  { code: "HN", currency: "HNL", locale: "es", unitSystem: "metric" },
  { code: "MX", currency: "MXN", locale: "es", unitSystem: "metric" },
  { code: "NI", currency: "NIO", locale: "es", unitSystem: "metric" },
  { code: "PA", currency: "USD", locale: "es", unitSystem: "metric" },
  { code: "PY", currency: "PYG", locale: "es", unitSystem: "metric" },
  { code: "PE", currency: "PEN", locale: "es", unitSystem: "metric" },
  { code: "PR", currency: "USD", locale: "es", unitSystem: "imperial" },
  { code: "GB", currency: "GBP", locale: "en", unitSystem: "metric" },
  { code: "UY", currency: "UYU", locale: "es", unitSystem: "metric" },
  { code: "VE", currency: "VES", locale: "es", unitSystem: "metric" },
  { code: "AU", currency: "AUD", locale: "en", unitSystem: "metric" },
  { code: "IE", currency: "EUR", locale: "en", unitSystem: "metric" },
  { code: "NZ", currency: "NZD", locale: "en", unitSystem: "metric" },
  { code: "ZZ", currency: "USD", locale: "en", unitSystem: "metric" }
];

/** "ZZ" is the "other country" option. */
export const OTHER_COUNTRY = "ZZ";

export const currencies = Array.from(
  new Set([...countries.map((country) => country.currency), "EUR", "USD"])
).sort();

export function findCountry(code: string | null | undefined) {
  return countries.find((country) => country.code === code);
}

export function countryName(locale: Locale, code: string, otherLabel: string) {
  if (code === OTHER_COUNTRY) {
    return otherLabel;
  }

  try {
    return new Intl.DisplayNames([intlLocale(locale)], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function currencyName(locale: Locale, code: string) {
  try {
    const name = new Intl.DisplayNames([intlLocale(locale)], { type: "currency" }).of(code);
    return name ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

/** Countries sorted by their name in the active language, "other" last. */
export function countryOptions(locale: Locale, otherLabel: string) {
  return countries
    .map((country) => ({ ...country, label: countryName(locale, country.code, otherLabel) }))
    .sort((a, b) =>
      a.code === OTHER_COUNTRY
        ? 1
        : b.code === OTHER_COUNTRY
          ? -1
          : a.label.localeCompare(b.label, locale)
    );
}

/** Best guess from an Accept-Language header such as "es-EC,es;q=0.9". */
export function countryFromAcceptLanguage(header: string | null) {
  if (!header) {
    return undefined;
  }

  for (const part of header.split(",")) {
    const region = part.trim().split(";")[0]?.split("-")[1]?.toUpperCase();

    if (region && findCountry(region)) {
      return region;
    }
  }

  return undefined;
}

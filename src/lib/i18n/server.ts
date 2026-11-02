import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { getHousehold } from "@/lib/household";
import { getDictionary } from "./dictionaries";

/** Cookie choice first, then the household default, then Spanish. */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(LOCALE_COOKIE)?.value;

  if (isLocale(value)) {
    return value;
  }

  const household = await getHousehold();
  return isLocale(household?.defaultLocale) ? household.defaultLocale : defaultLocale;
}

export async function getI18n() {
  const locale = await getLocale();

  return { locale, t: getDictionary(locale) };
}

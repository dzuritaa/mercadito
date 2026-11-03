import { describe, expect, it } from "vitest";
import {
  countries,
  countryFromAcceptLanguage,
  countryOptions,
  currencies,
  findCountry,
  OTHER_COUNTRY
} from "@/lib/countries";
import { memberAge } from "@/lib/household";
import { unitOptionsFor } from "@/lib/units";

describe("countries", () => {
  it("guesses the country from Accept-Language", () => {
    expect(countryFromAcceptLanguage("es-EC,es;q=0.9,en;q=0.8")).toBe("EC");
    expect(countryFromAcceptLanguage("en;q=0.9,es-MX;q=0.8")).toBe("MX");
    expect(countryFromAcceptLanguage("es")).toBeUndefined();
    expect(countryFromAcceptLanguage(null)).toBeUndefined();
  });

  it("has defaults for every listed country and lists their currencies", () => {
    expect(findCountry("EC")).toMatchObject({ currency: "USD", locale: "es" });
    expect(findCountry("US")).toMatchObject({ unitSystem: "imperial" });

    for (const country of countries) {
      expect(currencies).toContain(country.currency);
    }
  });

  it("sorts options by name and keeps 'other country' last", () => {
    const options = countryOptions("es", "Otro país");
    expect(options.at(-1)?.code).toBe(OTHER_COUNTRY);
    expect(options.find((option) => option.code === "MX")?.label).toBe("México");
  });
});

describe("units", () => {
  it("keeps every unit and only changes the order", () => {
    const metric = unitOptionsFor("metric");
    const imperial = unitOptionsFor("imperial");

    expect([...metric].sort()).toEqual([...imperial].sort());
    expect(metric.indexOf("g")).toBeLessThan(metric.indexOf("oz"));
    expect(imperial.indexOf("oz")).toBeLessThan(imperial.indexOf("g"));
  });
});

describe("memberAge", () => {
  it("derives age from the birth year", () => {
    expect(memberAge(2016, new Date(2026, 5, 1))).toBe(10);
    expect(memberAge(null)).toBeNull();
  });
});

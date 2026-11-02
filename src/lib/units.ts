import type { UnitSystemValue } from "@/lib/countries";

/** Stored unit codes. Labels come from the dictionary (t.units). */
const metricFirst = [
  "each",
  "g",
  "kg",
  "ml",
  "l",
  "cups",
  "tbsp",
  "tsp",
  "packs",
  "cans",
  "oz",
  "lb"
] as const;

const imperialFirst = [
  "each",
  "oz",
  "lb",
  "cups",
  "tbsp",
  "tsp",
  "packs",
  "cans",
  "g",
  "kg",
  "ml",
  "l"
] as const;

export type UnitCode = (typeof metricFirst)[number];

/** Every unit stays available; the household's system decides the order. */
export function unitOptionsFor(system: UnitSystemValue): readonly UnitCode[] {
  return system === "imperial" ? imperialFirst : metricFirst;
}

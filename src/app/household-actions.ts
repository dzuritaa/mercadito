"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { currencies, findCountry } from "@/lib/countries";
import {
  dietaryRestrictionOptions,
  getHousehold,
  isoWeekdays,
  mealPatternOptions
} from "@/lib/household";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { prisma } from "@/lib/prisma";

const MAX_MEMBER_ROWS = 20;

type Mode = "setup" | "settings";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(mode: Mode, message: string): never {
  redirect(`/${mode}?error=${encodeURIComponent(message)}`);
}

function parseHousehold(formData: FormData, mode: Mode) {
  const name = readString(formData, "name");
  const countryCode = readString(formData, "countryCode");
  const country = findCountry(countryCode);

  if (!name) {
    fail(mode, "householdNameRequired");
  }

  if (!country) {
    fail(mode, "countryRequired");
  }

  // Empty selects mean "automatic from the country".
  const currencyValue = readString(formData, "currency");
  const currency = currencyValue || country.currency;

  if (!currencies.includes(currency)) {
    fail(mode, "currencyInvalid");
  }

  const localeValue = readString(formData, "defaultLocale");
  const defaultLocale = isLocale(localeValue) ? localeValue : country.locale;

  const unitValue = readString(formData, "unitSystem");
  const unitSystem =
    unitValue === "metric" || unitValue === "imperial" ? unitValue : country.unitSystem;

  const budgetValue = readString(formData, "budgetAmount").replace(",", ".");
  const budgetAmount = budgetValue ? Number(budgetValue) : null;

  if (budgetAmount !== null && (!Number.isFinite(budgetAmount) || budgetAmount < 0)) {
    fail(mode, "budgetInvalid");
  }

  const budgetPeriod = readString(formData, "budgetPeriod") === "weekly" ? "weekly" : "monthly";

  const planDays = formData
    .getAll("planDays")
    .map((value) => Number(value))
    .filter((day): day is (typeof isoWeekdays)[number] =>
      (isoWeekdays as readonly number[]).includes(day)
    );

  if (planDays.length === 0) {
    fail(mode, "planDaysRequired");
  }

  const patternValue = readString(formData, "mealPattern");
  const mealPattern = (mealPatternOptions as readonly string[]).includes(patternValue)
    ? (patternValue as (typeof mealPatternOptions)[number])
    : "shared_lunch_dinner";

  const expiringSoonDays = Number(readString(formData, "expiringSoonDays") || "5");

  if (!Number.isInteger(expiringSoonDays) || expiringSoonDays < 1 || expiringSoonDays > 30) {
    fail(mode, "expiringDaysInvalid");
  }

  return {
    name,
    countryCode: country.code,
    city: readString(formData, "city") || null,
    currency,
    defaultLocale,
    unitSystem,
    budgetAmount,
    budgetPeriod,
    planDays: Array.from(new Set(planDays)).sort((a, b) => a - b),
    mealPattern,
    includeVegetarian: formData.get("includeVegetarian") === "on",
    expiringSoonDays
  } as const;
}

function parseMembers(formData: FormData) {
  const rowCount = Math.min(Number(readString(formData, "memberCount")) || 0, MAX_MEMBER_ROWS);
  const currentYear = new Date().getFullYear();
  const rows = [];

  for (let index = 0; index < rowCount; index += 1) {
    const id = readString(formData, `memberId_${index}`) || null;
    const name = readString(formData, `memberName_${index}`);
    const remove = formData.get(`memberRemove_${index}`) === "on";
    const ageValue = readString(formData, `memberAge_${index}`);
    const age = ageValue ? Number(ageValue) : null;
    const dietaryRestrictions = formData
      .getAll(`memberDiet_${index}`)
      .filter(
        (value): value is (typeof dietaryRestrictionOptions)[number] =>
          typeof value === "string" &&
          (dietaryRestrictionOptions as readonly string[]).includes(value)
      );

    rows.push({
      id,
      // An emptied name also removes an existing member.
      remove: remove || !name,
      name,
      birthYear:
        age !== null && Number.isInteger(age) && age >= 0 && age <= 120
          ? currentYear - age
          : null,
      dietaryRestrictions,
      dislikes: readString(formData, `memberDislikes_${index}`) || null,
      sortOrder: index
    });
  }

  return rows;
}

export async function saveHouseholdAction(formData: FormData) {
  const user = await requireUser();
  const mode: Mode = readString(formData, "mode") === "setup" ? "setup" : "settings";
  const existing = await getHousehold();

  if (mode === "setup" && existing?.setupCompletedAt) {
    redirect("/settings");
  }

  const data = parseHousehold(formData, mode);
  const members = parseMembers(formData);
  const removedStoreIds = formData
    .getAll("storeRemove")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const newStoreNames = Array.from(
    new Set(
      readString(formData, "newStores")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    )
  );

  await prisma.$transaction(async (tx) => {
    const household = existing
      ? await tx.household.update({
          where: { id: existing.id },
          data: {
            ...data,
            ...(mode === "setup" ? { setupCompletedAt: new Date() } : {})
          }
        })
      : await tx.household.create({
          data: { ...data, setupCompletedAt: new Date() }
        });

    // Link the account to its household (one household per installation).
    await tx.user.update({ where: { id: user.id }, data: { householdId: household.id } });

    const ownMemberIds = new Set(existing?.members.map((member) => member.id) ?? []);

    for (const member of members) {
      const isOwn = member.id !== null && ownMemberIds.has(member.id);

      if (member.remove) {
        if (isOwn) {
          await tx.householdMember.delete({ where: { id: member.id! } });
        }
        continue;
      }

      const memberData = {
        name: member.name,
        birthYear: member.birthYear,
        dietaryRestrictions: member.dietaryRestrictions,
        dislikes: member.dislikes,
        sortOrder: member.sortOrder
      };

      if (isOwn) {
        await tx.householdMember.update({ where: { id: member.id! }, data: memberData });
      } else {
        await tx.householdMember.create({
          data: { ...memberData, householdId: household.id }
        });
      }
    }

    // Removing a store hides it; past purchases and inventory keep their link.
    if (removedStoreIds.length > 0) {
      await tx.store.updateMany({
        where: { id: { in: removedStoreIds } },
        data: { active: false }
      });
    }

    for (const storeName of newStoreNames) {
      await tx.store.upsert({
        where: { name: storeName },
        update: { active: true },
        create: { name: storeName }
      });
    }
  });

  if (mode === "setup") {
    // The language chosen during setup becomes this browser's language too.
    const cookieStore = await cookies();
    cookieStore.set(LOCALE_COOKIE, data.defaultLocale, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax"
    });
  }

  revalidatePath("/", "layout");
  redirect(mode === "setup" ? "/?notice=setupCompleted" : "/settings?notice=settingsSaved");
}

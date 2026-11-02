"use server";

import { requireUser } from "@/lib/auth/session";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { markRecipeCooked } from "@/lib/cooking";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function optionalString(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value.length > 0 ? value : undefined;
}

function optionalInt(formData: FormData, key: string) {
  const value = optionalString(formData, key);

  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safeReturnPath(returnTo: string | undefined, recipeId: string) {
  if (!recipeId) {
    return "/recipes";
  }

  if (returnTo === "/cook-now" || returnTo === "/" || returnTo === "/inventory") {
    return returnTo;
  }

  if (returnTo === `/recipes/${recipeId}`) {
    return returnTo;
  }

  return `/recipes/${recipeId}`;
}

function withMessage(path: string, message: string, type: "notice" | "error") {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${type}=${encodeURIComponent(message)}`;
}

function revalidateCookingPaths(recipeId: string) {
  revalidatePath("/");
  revalidatePath("/cook-now");
  revalidatePath("/inventory");
  revalidatePath("/meal-planner");
  revalidatePath(`/recipes/${recipeId}`);
}

function cookedMessage(
  result: Awaited<ReturnType<typeof markRecipeCooked>>,
  t: Dictionary
) {
  return t.cooking.cookedResult(
    result.deductedCount,
    result.manualReviewCount + result.partialCount
  );
}

export async function markRecipeCookedAction(formData: FormData) {
  await requireUser();
  const recipeId = readString(formData, "recipeId");
  const returnTo = safeReturnPath(optionalString(formData, "returnTo"), recipeId);
  const { locale, t } = await getI18n();
  let result: Awaited<ReturnType<typeof markRecipeCooked>>;

  try {
    result = await markRecipeCooked({
      mealPlanItemId: optionalString(formData, "mealPlanItemId"),
      notes: optionalString(formData, "notes"),
      recipeId,
      servingsCooked: optionalInt(formData, "servingsCooked") ?? 1,
      locale
    });
  } catch (error) {
    redirect(
      withMessage(
        returnTo,
        error instanceof Error ? error.message : "recipeCookFailed",
        "error"
      )
    );
  }

  revalidateCookingPaths(recipeId);
  redirect(withMessage(returnTo, cookedMessage(result, t), "notice"));
}

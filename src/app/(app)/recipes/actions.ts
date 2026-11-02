"use server";

import { requireUser } from "@/lib/auth/session";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeGroceryName } from "@/lib/inventory";
import {
  MAX_RECIPE_INGREDIENTS,
  MAX_RECIPE_STEPS,
  MAX_RECIPE_SUBSTITUTIONS
} from "@/lib/recipes";
import {
  findOrCreateGroceryItemByName,
  upsertBilingualGroceryItem
} from "@/lib/grocery-items";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";

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

function optionalDecimal(formData: FormData, key: string) {
  const value = optionalString(formData, key);

  if (!value) {
    return undefined;
  }

  return value.replace(",", ".");
}

function optionalBoolean(formData: FormData, key: string) {
  const value = optionalString(formData, key);

  if (value === "yes") {
    return true;
  }

  if (value === "no") {
    return false;
  }

  return undefined;
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function recipeRedirect(message: string, type: "notice" | "error" = "notice") {
  redirect(`/recipes?${type}=${encodeURIComponent(message)}`);
}

function recipeCoreData(formData: FormData) {
  const nameEn = optionalString(formData, "nameEn") ?? null;
  const nameEs = optionalString(formData, "nameEs") ?? null;
  const servings = optionalInt(formData, "servings") ?? 4;

  if (!nameEn && !nameEs) {
    recipeRedirect("recipeNameRequired", "error");
  }

  if (servings < 1) {
    recipeRedirect("servingsMin", "error");
  }

  return {
    nameEn,
    nameEs,
    descriptionEn: optionalString(formData, "descriptionEn") ?? null,
    descriptionEs: optionalString(formData, "descriptionEs") ?? null,
    servings,
    prepTimeMinutes: optionalInt(formData, "prepTimeMinutes") ?? null,
    cookTimeMinutes: optionalInt(formData, "cookTimeMinutes") ?? null,
    source: optionalString(formData, "source") ?? null,
    instructionsSummaryEn: optionalString(formData, "instructionsSummaryEn") ?? null,
    instructionsSummaryEs: optionalString(formData, "instructionsSummaryEs") ?? null,
    caloriesPerServing: optionalDecimal(formData, "caloriesPerServing") ?? null,
    proteinGPerServing: optionalDecimal(formData, "proteinGPerServing") ?? null,
    carbsGPerServing: optionalDecimal(formData, "carbsGPerServing") ?? null,
    fatGPerServing: optionalDecimal(formData, "fatGPerServing") ?? null,
    estimatedCost: optionalDecimal(formData, "estimatedCost") ?? null
  };
}

async function ingredientData(formData: FormData, tx: Prisma.TransactionClient) {
  const ingredients = [];

  for (let index = 0; index < MAX_RECIPE_INGREDIENTS; index += 1) {
    const nameEn = optionalString(formData, `ingredientNameEn_${index}`);
    const nameEs = optionalString(formData, `ingredientNameEs_${index}`);

    if (!nameEn && !nameEs) {
      continue;
    }

    if (!normalizeGroceryName(nameEn ?? nameEs ?? "")) {
      recipeRedirect("ingredientNameRequired", "error");
    }

    const unit = optionalString(formData, `ingredientUnit_${index}`);
    const groceryItem = await upsertBilingualGroceryItem(
      tx,
      { en: nameEn, es: nameEs },
      { defaultUnit: unit }
    );

    ingredients.push({
      groceryItemId: groceryItem.id,
      quantity: optionalDecimal(formData, `ingredientQuantity_${index}`),
      unit,
      quantityDescription: optionalString(
        formData,
        `ingredientQuantityDescription_${index}`
      ),
      optional: checked(formData, `ingredientOptional_${index}`),
      notesEn: optionalString(formData, `ingredientNotesEn_${index}`),
      notesEs: optionalString(formData, `ingredientNotesEs_${index}`),
      sortOrder: ingredients.length + 1
    });
  }

  if (ingredients.length === 0) {
    recipeRedirect("ingredientsRequired", "error");
  }

  return ingredients;
}

function stepData(formData: FormData) {
  const steps = [];

  for (let index = 0; index < MAX_RECIPE_STEPS; index += 1) {
    const instructionEn = optionalString(formData, `stepInstructionEn_${index}`);
    const instructionEs = optionalString(formData, `stepInstructionEs_${index}`);

    if (!instructionEn && !instructionEs) {
      continue;
    }

    steps.push({
      stepNumber: steps.length + 1,
      instructionEn: instructionEn ?? null,
      instructionEs: instructionEs ?? null
    });
  }

  if (steps.length === 0) {
    recipeRedirect("stepsRequired", "error");
  }

  return steps;
}

async function substitutionData(
  formData: FormData,
  tx: Prisma.TransactionClient,
  locale: Locale
) {
  const substitutions = [];

  for (let index = 0; index < MAX_RECIPE_SUBSTITUTIONS; index += 1) {
    const originalName = readString(formData, `substitutionOriginal_${index}`);
    const substituteName = readString(formData, `substitutionSubstitute_${index}`);

    if (!originalName && !substituteName) {
      continue;
    }

    if (!originalName || !substituteName) {
      recipeRedirect("substitutionIncomplete", "error");
    }

    const originalGroceryItem = await findOrCreateGroceryItemByName(
      tx,
      originalName,
      locale
    );
    const substituteGroceryItem = await findOrCreateGroceryItemByName(
      tx,
      substituteName,
      locale
    );

    substitutions.push({
      originalGroceryItemId: originalGroceryItem.id,
      substituteGroceryItemId: substituteGroceryItem.id,
      substitutionNoteEn: optionalString(formData, `substitutionNoteEn_${index}`),
      substitutionNoteEs: optionalString(formData, `substitutionNoteEs_${index}`),
      healthImprovement: checked(formData, `substitutionHealth_${index}`)
    });
  }

  return substitutions;
}

function ratingData(formData: FormData) {
  const rating = optionalInt(formData, "rating");
  const wouldCookAgain = optionalBoolean(formData, "wouldCookAgain");
  const notes = optionalString(formData, "ratingNotes");

  if (rating && (rating < 1 || rating > 5)) {
    recipeRedirect("ratingRange", "error");
  }

  if (!rating && wouldCookAgain === undefined && !notes) {
    return undefined;
  }

  return {
    rating: rating ?? null,
    wouldCookAgain: wouldCookAgain ?? null,
    notes: notes ?? null
  };
}

function tagData(formData: FormData) {
  return formData
    .getAll("tagIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((tagId) => ({
      tagId
    }));
}

function revalidateRecipePaths(recipeId?: string) {
  revalidatePath("/");
  revalidatePath("/recipes");

  if (recipeId) {
    revalidatePath(`/recipes/${recipeId}`);
    revalidatePath(`/recipes/${recipeId}/edit`);
  }
}

export async function createRecipe(formData: FormData) {
  await requireUser();
  const locale = await getLocale();
  const recipeData = recipeCoreData(formData);
  const steps = stepData(formData);
  const tags = tagData(formData);
  const rating = ratingData(formData);

  const recipe = await prisma.$transaction(async (tx) => {
    const ingredients = await ingredientData(formData, tx);
    const substitutions = await substitutionData(formData, tx, locale);

    return tx.recipe.create({
      data: {
        ...recipeData,
        ingredients: {
          create: ingredients
        },
        rating: rating
          ? {
              create: rating
            }
          : undefined,
        steps: {
          create: steps
        },
        substitutions:
          substitutions.length > 0
            ? {
                create: substitutions
              }
            : undefined,
        tags:
          tags.length > 0
            ? {
                create: tags
              }
            : undefined
      }
    });
  });

  revalidateRecipePaths(recipe.id);
  redirect(`/recipes/${recipe.id}?notice=${encodeURIComponent("recipeAdded")}`);
}

export async function updateRecipe(formData: FormData) {
  await requireUser();
  const locale = await getLocale();
  const id = readString(formData, "id");

  if (!id) {
    recipeRedirect("recipeMissing", "error");
  }

  const recipeData = recipeCoreData(formData);
  const steps = stepData(formData);
  const tags = tagData(formData);
  const rating = ratingData(formData);

  await prisma.$transaction(async (tx) => {
    const ingredients = await ingredientData(formData, tx);
    const substitutions = await substitutionData(formData, tx, locale);

    await tx.recipe.update({
      where: {
        id
      },
      data: recipeData
    });

    await Promise.all([
      tx.recipeIngredient.deleteMany({
        where: {
          recipeId: id
        }
      }),
      tx.recipeStep.deleteMany({
        where: {
          recipeId: id
        }
      }),
      tx.recipeTagMap.deleteMany({
        where: {
          recipeId: id
        }
      }),
      tx.recipeSubstitution.deleteMany({
        where: {
          recipeId: id
        }
      })
    ]);

    await Promise.all([
      tx.recipeIngredient.createMany({
        data: ingredients.map((ingredient) => ({
          ...ingredient,
          recipeId: id
        }))
      }),
      tx.recipeStep.createMany({
        data: steps.map((step) => ({
          ...step,
          recipeId: id
        }))
      })
    ]);

    if (tags.length > 0) {
      await tx.recipeTagMap.createMany({
        data: tags.map((tag) => ({
          ...tag,
          recipeId: id
        }))
      });
    }

    if (substitutions.length > 0) {
      await tx.recipeSubstitution.createMany({
        data: substitutions.map((substitution) => ({
          ...substitution,
          recipeId: id
        }))
      });
    }

    if (rating) {
      await tx.recipeRating.upsert({
        where: {
          recipeId: id
        },
        update: rating,
        create: {
          ...rating,
          recipeId: id
        }
      });
    } else {
      await tx.recipeRating.deleteMany({
        where: {
          recipeId: id
        }
      });
    }
  });

  revalidateRecipePaths(id);
  redirect(`/recipes/${id}?notice=${encodeURIComponent("recipeUpdated")}`);
}

export async function updateRecipeActiveStatus(formData: FormData) {
  await requireUser();
  const id = readString(formData, "id");
  const isActive = readString(formData, "isActive") === "true";

  if (!id) {
    recipeRedirect("recipeMissing", "error");
  }

  await prisma.recipe.update({
    where: {
      id
    },
    data: {
      isActive
    }
  });

  revalidateRecipePaths(id);
  redirect(
    `/recipes/${id}?notice=${encodeURIComponent(
      isActive ? "recipeReactivated" : "recipeArchived"
    )}`
  );
}

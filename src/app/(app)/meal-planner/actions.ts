"use server";

import { requireUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatDateInput } from "@/lib/inventory";
import {
  generateWeeklyMealPlan,
  getMealPlanById,
  mealPlannerRedirectPath,
  parseWeekStartDate
} from "@/lib/meal-planner";
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

function revalidateMealPlannerPaths() {
  revalidatePath("/");
  revalidatePath("/meal-planner");
  revalidatePath("/shopping-list");
}

async function mealPlanRedirectForPlan(
  planId: string,
  message: string,
  type: "notice" | "error" = "notice"
) {
  const plan = await prisma.mealPlan.findUnique({
    where: {
      id: planId
    },
    select: {
      weekStartDate: true
    }
  });

  redirect(
    mealPlannerRedirectPath(
      message,
      type,
      plan?.weekStartDate ?? parseWeekStartDate()
    )
  );
}

async function mealPlanRedirectForItem(
  itemId: string,
  message: string,
  type: "notice" | "error" = "notice"
) {
  const item = await prisma.mealPlanItem.findUnique({
    where: {
      id: itemId
    },
    select: {
      mealPlan: {
        select: {
          weekStartDate: true
        }
      }
    }
  });

  redirect(
    mealPlannerRedirectPath(
      message,
      type,
      item?.mealPlan.weekStartDate ?? parseWeekStartDate()
    )
  );
}

export async function generateMealPlanAction(formData: FormData) {
  await requireUser();
  const result = await generateWeeklyMealPlan(
    optionalString(formData, "weekStart"),
    await getLocale()
  );

  revalidateMealPlannerPaths();
  redirect(result.redirectPath);
}

export async function approveMealPlanAction(formData: FormData) {
  await requireUser();
  const planId = readString(formData, "planId");

  if (!planId) {
    redirect(
      mealPlannerRedirectPath("mealPlanMissing", "error", parseWeekStartDate())
    );
  }

  const plan = await getMealPlanById(planId);

  if (!plan) {
    redirect(
      mealPlannerRedirectPath("mealPlanNotFound", "error", parseWeekStartDate())
    );
  }

  if (plan.status === "approved") {
    await mealPlanRedirectForPlan(plan.id, "mealPlanAlreadyApproved");
  }

  const activeItemCount = plan.items.filter(
    (item) => item.status !== "rejected" && item.status !== "skipped"
  ).length;

  if (activeItemCount === 0) {
    await mealPlanRedirectForPlan(
      plan.id,
      "approveOneMeal",
      "error"
    );
  }

  await prisma.$transaction([
    prisma.mealPlan.update({
      where: {
        id: plan.id
      },
      data: {
        status: "approved"
      }
    }),
    prisma.mealPlanItem.updateMany({
      where: {
        mealPlanId: plan.id,
        status: {
          in: ["suggested", "planned"]
        }
      },
      data: {
        status: "approved"
      }
    })
  ]);

  revalidateMealPlannerPaths();
  await mealPlanRedirectForPlan(plan.id, "mealPlanApproved");
}

export async function archiveMealPlanAction(formData: FormData) {
  await requireUser();
  const planId = readString(formData, "planId");

  if (!planId) {
    redirect(
      mealPlannerRedirectPath("mealPlanMissing", "error", parseWeekStartDate())
    );
  }

  await prisma.mealPlan.update({
    where: {
      id: planId
    },
    data: {
      status: "archived"
    }
  });

  revalidateMealPlannerPaths();
  redirect(
    `/meal-planner?weekStart=${formatDateInput(parseWeekStartDate(optionalString(formData, "weekStart")))}&notice=${encodeURIComponent(
      "mealPlanArchived"
    )}`
  );
}

export async function updateMealPlanItemStatusAction(formData: FormData) {
  await requireUser();
  const itemId = readString(formData, "itemId");
  const status = readString(formData, "status");

  if (!itemId) {
    redirect(
      mealPlannerRedirectPath("mealItemMissing", "error", parseWeekStartDate())
    );
  }

  if (!["approved", "planned", "rejected", "skipped"].includes(status)) {
    await mealPlanRedirectForItem(itemId, "mealStatusUnsupported", "error");
  }

  await prisma.mealPlanItem.update({
    where: {
      id: itemId
    },
    data: {
      status: status as "approved" | "planned" | "rejected" | "skipped"
    }
  });

  revalidateMealPlannerPaths();
  await mealPlanRedirectForItem(itemId, "mealUpdated");
}

export async function swapMealPlanItemAction(formData: FormData) {
  await requireUser();
  const itemId = readString(formData, "itemId");
  const recipeId = readString(formData, "recipeId");

  if (!itemId || !recipeId) {
    redirect(
      mealPlannerRedirectPath("chooseSwap", "error", parseWeekStartDate())
    );
  }

  const recipe = await prisma.recipe.findFirst({
    where: {
      id: recipeId,
      isActive: true
    },
    select: {
      servings: true
    }
  });

  if (!recipe) {
    await mealPlanRedirectForItem(itemId, "chooseActiveRecipe", "error");
    return;
  }

  await prisma.mealPlanItem.update({
    where: {
      id: itemId
    },
    data: {
      notes: null,
      recipeId,
      servingsPlanned: recipe.servings,
      status: "suggested"
    }
  });

  revalidateMealPlannerPaths();
  await mealPlanRedirectForItem(itemId, "mealSwapped");
}

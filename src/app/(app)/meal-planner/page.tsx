import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import {
  formatCalendarDate,
  messageText,
  recipeDescription,
  recipeName,
  tagName
} from "@/lib/i18n/text";
import { formatDateInput } from "@/lib/inventory";
import {
  getMealPlannerPageData,
  weekdayLabel,
  weekEndDate,
  VEGETARIAN_TAG,
  type MealPlannerPageData
} from "@/lib/meal-planner";
import { generateShoppingListFromMealPlan } from "@/app/(app)/shopping-list/actions";
import {
  approveMealPlanAction,
  archiveMealPlanAction,
  generateMealPlanAction,
  swapMealPlanItemAction,
  updateMealPlanItemStatusAction
} from "./actions";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

type MealPlannerPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
    weekStart?: string;
  }>;
};

type Plan = NonNullable<MealPlannerPageData["plan"]>;
type PlanItem = Plan["items"][number];

function mealStatusBadgeClass(status: PlanItem["status"]) {
  if (status === "approved" || status === "cooked") {
    return "badge badge-good badge-dot";
  }

  if (status === "rejected") {
    return "badge badge-bad";
  }

  if (status === "suggested") {
    return "badge badge-warn";
  }

  return "badge badge-quiet";
}

function weekRange(
  locale: Locale,
  t: Dictionary,
  weekStartDate: Date,
  planDays: number[]
) {
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

  return t.shopping.dateRange(
    formatCalendarDate(locale, weekStartDate, options),
    formatCalendarDate(locale, weekEndDate(weekStartDate, planDays), {
      ...options,
      year: "numeric"
    })
  );
}

function hasVegetarianTag(item: PlanItem) {
  return item.recipe.tags.some((tagMap) => tagMap.tag.name === VEGETARIAN_TAG);
}

function matchForItem(
  item: PlanItem,
  matches: MealPlannerPageData["matches"]
) {
  return matches.find((match) => match.recipe.id === item.recipeId);
}

function StatusAction({
  item,
  label,
  status
}: {
  item: PlanItem;
  label: string;
  status: "approved" | "planned" | "rejected" | "skipped";
}) {
  return (
    <form action={updateMealPlanItemStatusAction}>
      <input name="itemId" type="hidden" value={item.id} />
      <input name="status" type="hidden" value={status} />
      <button className="secondary-button" type="submit">
        {label}
      </button>
    </form>
  );
}

function MealPlanItemCard({
  activeRecipes,
  item,
  locale,
  matches,
  plan,
  t
}: {
  activeRecipes: MealPlannerPageData["activeRecipes"];
  item: PlanItem;
  locale: Locale;
  matches: MealPlannerPageData["matches"];
  plan: Plan;
  t: Dictionary;
}) {
  const m = t.mealPlanner;
  const name = recipeName(locale, item.recipe);
  const match = matchForItem(item, matches);
  const canEdit = plan.status !== "archived" && item.status !== "cooked";

  return (
    <article className={`panel meal-plan-card meal-plan-card-${item.status}`}>
      <div className="recipe-card-header">
        <div>
          <p className="eyebrow">
            {weekdayLabel(item.plannedDate, locale)} · {t.mealTypes[item.mealType]}
          </p>
          <h2>
            <Link href={`/recipes/${item.recipeId}`}>{name}</Link>
          </h2>
          <p className="muted">
            {recipeDescription(locale, item.recipe) || t.recipes.noDescription}
          </p>
        </div>
        <span className={mealStatusBadgeClass(item.status)}>
          {m.itemStatus[item.status]}
        </span>
      </div>

      <dl className="inventory-meta meal-plan-meta">
        <div>
          <dt>{m.date}</dt>
          <dd>{formatCalendarDate(locale, item.plannedDate)}</dd>
        </div>
        <div>
          <dt>{t.common.servings}</dt>
          <dd>{item.servingsPlanned}</dd>
        </div>
        <div>
          <dt>{m.score}</dt>
          <dd>{match?.score ?? m.newSwap}</dd>
        </div>
        <div>
          <dt>{m.missing}</dt>
          <dd>{match?.missingRequiredCount ?? m.review}</dd>
        </div>
      </dl>

      <div className="recipe-tags">
        {item.recipe.tags.map((tagMap) => (
          <span className="badge badge-quiet" key={tagMap.tagId}>
            {tagName(t, tagMap.tag.name)}
          </span>
        ))}
      </div>

      {item.notes ? <p className="muted">{item.notes}</p> : null}

      {canEdit ? (
        <div className="meal-item-actions print-hidden">
          <StatusAction item={item} label={m.approve} status="approved" />
          <StatusAction item={item} label={m.plan} status="planned" />
          <StatusAction item={item} label={m.skip} status="skipped" />
          <StatusAction item={item} label={m.reject} status="rejected" />
          <form action={swapMealPlanItemAction} className="swap-form">
            <input name="itemId" type="hidden" value={item.id} />
            <select aria-label={m.swapLabel(name)} defaultValue={item.recipeId} name="recipeId">
              {activeRecipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.displayName}
                </option>
              ))}
            </select>
            <button className="secondary-button" type="submit">
              {m.swap}
            </button>
          </form>
        </div>
      ) : null}
    </article>
  );
}

export default async function MealPlannerPage({
  searchParams
}: MealPlannerPageProps) {
  const params = (await searchParams) ?? {};
  const { locale, t } = await getI18n();
  const m = t.mealPlanner;
  const { activeRecipes, matches, plan, settings, warnings, weekStartDate } =
    await getMealPlannerPageData(params.weekStart, locale);
  const notice = messageText(t, params.notice);
  const error = messageText(t, params.error);
  const activeItems =
    plan?.items.filter((item) => item.status !== "rejected" && item.status !== "skipped") ??
    [];

  return (
    <>
      <header className="page-header inventory-header">
        <div>
          <h1>{m.title}</h1>
          <p className="lead">{m.lead}</p>
        </div>
        <form action={generateMealPlanAction} className="header-action print-hidden">
          <label>
            {m.week}
            <input
              defaultValue={formatDateInput(weekStartDate)}
              name="weekStart"
              type="date"
            />
          </label>
          <button className="button" type="submit">
            {m.generateWeek}
          </button>
        </form>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}
      {warnings.map((warning) => (
        <p className="notice notice-warning" key={warning}>
          {m.warnings[warning]}
        </p>
      ))}

      {plan ? (
        <section className="meal-planner-layout">
          <aside className="meal-planner-sidebar print-hidden">
            <section className="panel form-panel">
              <div>
                <p className="eyebrow">{m.planStatus[plan.status]}</p>
                <h2>{m.weekOf(formatCalendarDate(locale, plan.weekStartDate))}</h2>
                <p className="muted">{weekRange(locale, t, plan.weekStartDate, settings.planDays)}</p>
              </div>

              <dl className="inventory-meta shopping-summary">
                <div>
                  <dt>{m.meals}</dt>
                  <dd>{activeItems.length}</dd>
                </div>
                <div>
                  <dt>{m.vegetarian}</dt>
                  <dd>{activeItems.some(hasVegetarianTag) ? t.common.yes : t.common.no}</dd>
                </div>
                <div>
                  <dt>{m.recipes}</dt>
                  <dd>{activeRecipes.length}</dd>
                </div>
              </dl>

              <div className="planner-actions">
                {plan.status !== "approved" ? (
                  <form action={approveMealPlanAction}>
                    <input name="planId" type="hidden" value={plan.id} />
                    <button className="button" type="submit">
                      {m.approveWeek}
                    </button>
                  </form>
                ) : (
                  <form action={generateShoppingListFromMealPlan}>
                    <input name="mealPlanId" type="hidden" value={plan.id} />
                    <button className="button" type="submit">
                      {m.generateShoppingList}
                    </button>
                  </form>
                )}
                <PrintButton label={m.print} />
                <form action={archiveMealPlanAction}>
                  <input name="planId" type="hidden" value={plan.id} />
                  <input
                    name="weekStart"
                    type="hidden"
                    value={formatDateInput(plan.weekStartDate)}
                  />
                  <button className="secondary-button" type="submit">
                    {t.common.archive}
                  </button>
                </form>
              </div>
            </section>
          </aside>

          <main className="meal-plan-grid">
            <section className="print-plan-title">
              <p className="eyebrow">{m.printTitle}</p>
              <h2>{weekRange(locale, t, plan.weekStartDate, settings.planDays)}</h2>
            </section>
            {plan.items.map((item) => (
              <MealPlanItemCard
                activeRecipes={activeRecipes}
                item={item}
                key={item.id}
                locale={locale}
                matches={matches}
                plan={plan}
                t={t}
              />
            ))}
          </main>
        </section>
      ) : (
        <article className="panel empty-state">
          <h2>{m.emptyTitle}</h2>
          <p className="muted">{m.emptyBody}</p>
        </article>
      )}
    </>
  );
}

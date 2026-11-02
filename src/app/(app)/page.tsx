import Link from "next/link";
import { getHouseholdSettings } from "@/lib/household";
import { daysUntilLabel, getInventoryDashboardData } from "@/lib/inventory";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import {
  formatCurrency,
  groceryName,
  locationLabel,
  messageText,
  recipeName
} from "@/lib/i18n/text";
import { intlLocale } from "@/lib/i18n/config";
import { getDashboardMealPlan, weekdayLabel } from "@/lib/meal-planner";
import { getRecipeMatches, type RecipeMatch } from "@/lib/recipe-matching";
import { getDashboardSpendingData } from "@/lib/reports";

export const dynamic = "force-dynamic";

function greeting(date: Date, t: Dictionary) {
  const hour = date.getHours();

  if (hour < 12) {
    return t.dashboard.greetingMorning;
  }

  if (hour < 19) {
    return t.dashboard.greetingAfternoon;
  }

  return t.dashboard.greetingEvening;
}

function readinessBadge(match: RecipeMatch, t: Dictionary) {
  if (match.missingRequiredCount === 0) {
    return { className: "badge badge-good badge-dot", label: t.dashboard.ready };
  }

  return {
    className: match.missingRequiredCount <= 2 ? "badge badge-warn" : "badge badge-quiet",
    label: t.dashboard.missing(match.missingRequiredCount)
  };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

type DashboardPageProps = {
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const { locale, t } = await getI18n();
  const [inventory, recipeMatches, mealPlan, spending, settings] = await Promise.all([
    getInventoryDashboardData(),
    getRecipeMatches({ locale }),
    getDashboardMealPlan(),
    getDashboardSpendingData(locale),
    getHouseholdSettings()
  ]);
  const money = (value: number) => formatCurrency(locale, value, settings.currency, settings.countryCode);
  const expiringDays = settings.expiringSoonDays;
  const showMealType = settings.mealPattern === "separate_lunch_dinner";

  const now = new Date();
  const todayKey = localDateKey(now);
  const topMatches = recipeMatches.slice(0, 4);
  const readyCount = recipeMatches.filter(
    (match) => match.missingRequiredCount === 0
  ).length;
  const plannedMeals =
    mealPlan?.items.filter(
      (item) => item.status !== "rejected" && item.status !== "skipped"
    ) ?? [];
  const { budget } = spending;
  const budgetTone =
    budget.remaining === null
      ? ""
      : budget.remaining < 0
        ? "is-over"
        : budget.usedPercent >= 85
          ? "is-warn"
          : "";

  return (
    <>
      <header className="page-header dash-header">
        <div>
          <p className="dash-date">
            {capitalize(
              now.toLocaleDateString(intlLocale(locale), {
                weekday: "long",
                month: "long",
                day: "numeric"
              })
            )}
          </p>
          <h1>{greeting(now, t)}</h1>
          <p className="lead">{t.dashboard.lead}</p>
        </div>
        <Link className="button" href="/cook-now">
          {t.dashboard.cta}
        </Link>
      </header>

      {messageText(t, params.notice) ? (
        <p className="notice">{messageText(t, params.notice)}</p>
      ) : null}
      {messageText(t, params.error) ? (
        <p className="notice notice-error">{messageText(t, params.error)}</p>
      ) : null}

      <section aria-label={t.dashboard.keyNumbers} className="kpi-row">
        <article className="panel kpi">
          <p className="kpi-label">
            <span>{t.dashboard.budgetLabel(spending.month.label)}</span>
            <Link className="text-link" href="/reports">
              {t.dashboard.reportsLink}
            </Link>
          </p>
          <p className="metric">
            {money(budget.grocerySpent)}{" "}
            {budget.target !== null ? (
              <span className="metric-unit">{t.dashboard.ofAmount(money(budget.target))}</span>
            ) : null}
          </p>
          {budget.target !== null && budget.remaining !== null ? (
            <>
              <div
                aria-label={t.dashboard.budgetUsed(Math.round(budget.usedPercent))}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(budget.usedPercent)}
                className="progress-track"
                role="progressbar"
              >
                <span
                  className={`progress-fill ${budgetTone}`}
                  style={{ width: `${Math.min(budget.usedPercent, 100)}%` }}
                />
              </div>
              <p className={`kpi-foot ${budget.remaining < 0 ? "over-budget" : "muted"}`}>
                {budget.remaining >= 0
                  ? t.dashboard.leftThisMonth(money(budget.remaining))
                  : t.dashboard.overBudget(money(Math.abs(budget.remaining)))}
              </p>
            </>
          ) : (
            <>
              <span />
              <p className="kpi-foot muted">
                {t.dashboard.noBudget} ·{" "}
                <Link className="text-link" href="/settings">
                  {t.dashboard.setBudget}
                </Link>
              </p>
            </>
          )}
        </article>

        <article
          className={`panel kpi ${inventory.expiringCount > 0 ? "kpi-alert" : ""}`}
        >
          <p className="kpi-label">
            <span>{t.dashboard.expiringSoon}</span>
            <Link className="text-link" href="/inventory?expiring=1">
              {t.dashboard.viewLink}
            </Link>
          </p>
          <p className="metric">
            {inventory.expiringCount}{" "}
            <span className="metric-unit">{t.dashboard.items(inventory.expiringCount)}</span>
          </p>
          <span />
          <p className="kpi-foot muted">{t.dashboard.dueWithin(expiringDays)}</p>
        </article>

        <article className="panel kpi">
          <p className="kpi-label">
            <span>{t.dashboard.readyToCook}</span>
            <Link className="text-link" href="/cook-now">
              {t.dashboard.cookNowLink}
            </Link>
          </p>
          <p className="metric">
            {readyCount}{" "}
            <span className="metric-unit">{t.dashboard.ofRecipes(recipeMatches.length)}</span>
          </p>
          <span />
          <p className="kpi-foot muted">{t.dashboard.readyFoot}</p>
        </article>
      </section>

      <section aria-label={t.dashboard.overview} className="dashboard-grid">
        <article className="panel panel-large dash-panel">
          <div className="section-heading">
            <div>
              <h2>{t.dashboard.weekPlan}</h2>
              <p className="muted">{t.household.mealPatterns[settings.mealPattern]}</p>
            </div>
            <Link className="secondary-button" href="/meal-planner">
              {mealPlan ? t.dashboard.openPlanner : t.dashboard.planTheWeek}
            </Link>
          </div>
          {plannedMeals.length > 0 ? (
            <ol className="week-strip">
              {plannedMeals.map((item) => {
                const isToday =
                  item.plannedDate.toISOString().slice(0, 10) === todayKey;

                return (
                  <li
                    className={`day-card ${isToday ? "is-today" : ""}`}
                    key={item.id}
                  >
                    <span className="day-name">
                      {isToday ? t.common.today : weekdayLabel(item.plannedDate, locale)}
                      {showMealType ? ` · ${t.mealTypes[item.mealType]}` : ""}
                    </span>
                    <Link className="day-recipe" href={`/recipes/${item.recipeId}`}>
                      {recipeName(locale, item.recipe)}
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="muted">{t.dashboard.noPlan}</p>
          )}
        </article>

        <article className="panel dash-panel">
          <div>
            <h2>{t.dashboard.useFirst}</h2>
            <p className="muted">{t.dashboard.useFirstSub}</p>
          </div>
          {inventory.expiringItems.length > 0 ? (
            <ul className="status-list">
              {inventory.expiringItems.map((item) => (
                <li className="status-item" key={item.id}>
                  <span>
                    <strong>{groceryName(locale, item.groceryItem)}</strong>
                    <br />
                    <span className="muted">{locationLabel(t, item.location)}</span>
                  </span>
                  <span className="badge badge-warn">
                    {daysUntilLabel(item.expirationDate, t)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t.dashboard.nothingExpiring(expiringDays)}</p>
          )}
        </article>

        <article className="panel panel-large dash-panel">
          <div className="section-heading">
            <div>
              <h2>{t.dashboard.suggested}</h2>
              <p className="muted">{t.dashboard.suggestedSub}</p>
            </div>
            <Link className="secondary-button" href="/cook-now">
              {t.dashboard.seeAll}
            </Link>
          </div>
          {topMatches.length > 0 ? (
            <ul className="status-list">
              {topMatches.map((match) => {
                const badge = readinessBadge(match, t);

                return (
                  <li className="status-item" key={match.recipe.id}>
                    <span>
                      <Link
                        className="suggestion-name"
                        href={`/recipes/${match.recipe.id}`}
                      >
                        {match.recipe.name}
                      </Link>
                      <span className="muted">
                        {t.dashboard.inStock(
                          match.availableRequiredCount,
                          match.availableRequiredCount + match.missingRequiredCount
                        )}
                      </span>
                    </span>
                    <span className={badge.className}>{badge.label}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">{t.dashboard.noSuggestions}</p>
          )}
        </article>

        <article className="panel dash-panel">
          <div>
            <h2>{t.dashboard.quickActions}</h2>
            <p className="muted">{t.dashboard.quickActionsSub}</p>
          </div>
          <div className="planner-actions">
            <Link className="secondary-button" href="/inventory#add-inventory">
              {t.dashboard.addToInventory}
            </Link>
            <Link className="secondary-button" href="/shopping-list">
              {t.dashboard.openShoppingList}
            </Link>
            <Link className="secondary-button" href="/reports#add-purchase">
              {t.dashboard.logReceipt}
            </Link>
          </div>
        </article>
      </section>
    </>
  );
}

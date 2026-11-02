import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import {
  categoryName,
  formatCalendarDate,
  formatCurrency,
  groceryName,
  locationLabel,
  messageText,
  recipeName,
  storeName,
  unitLabel
} from "@/lib/i18n/text";
import { getHouseholdSettings } from "@/lib/household";
import { getReportsPageData, purchaseTypeOptions } from "@/lib/reports";
import { unitOptionsFor } from "@/lib/units";
import { addPurchase } from "./actions";

export const dynamic = "force-dynamic";

const receiptLineIndexes = [0, 1, 2, 3, 4];

type ReportsPageProps = {
  searchParams?: Promise<{
    error?: string;
    month?: string;
    notice?: string;
  }>;
};

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatGrams(value: number) {
  return `${value} g`;
}

function lineItemName(
  item: Awaited<ReturnType<typeof getReportsPageData>>["purchases"][number]["items"][number],
  locale: Locale,
  t: Dictionary
) {
  if (item.groceryItem) {
    return groceryName(locale, item.groceryItem);
  }

  if (item.itemName) {
    return item.itemName;
  }

  return item.category ? categoryName(t, item.category.name) : t.reports.receiptItem;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = (await searchParams) ?? {};
  const [{ locale, t }, settings] = await Promise.all([getI18n(), getHouseholdSettings()]);
  const r = t.reports;
  const money = (value: number) => formatCurrency(locale, value, settings.currency, settings.countryCode);
  const receiptUnitOptions = unitOptionsFor(settings.unitSystem);
  const shortDate = (date: Date) => formatCalendarDate(locale, date);
  const purchaseTypeLabel = (type: string) => t.purchaseTypes[type] ?? type;
  const notice = messageText(t, params.notice);
  const error = messageText(t, params.error);
  const data = await getReportsPageData(params.month, locale);
  const groceryItems = data.groceryItems
    .map((item) => ({ id: item.id, label: groceryName(locale, item) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  const defaultPurchaseDate = dateInputValue(data.month.start);

  return (
    <>
      <header className="page-header reports-header">
        <div>
          <h1>{r.title}</h1>
          <p className="lead">{r.lead}</p>
        </div>
        <a className="button" href="#add-purchase">
          {r.addReceipt}
        </a>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <section className="reports-layout">
        <aside className="reports-sidebar">
          <form action="/reports" className="panel form-panel">
            <div>
              <p className="eyebrow">{r.month}</p>
              <h2>{data.month.label}</h2>
            </div>
            <label>
              {r.reportMonth}
              <input
                defaultValue={data.month.inputValue}
                name="month"
                type="month"
              />
            </label>
            <button className="button" type="submit">
              {r.viewMonth}
            </button>
          </form>

          <form action={addPurchase} className="panel form-panel" id="add-purchase">
            <div>
              <p className="eyebrow">{r.quickEntry}</p>
              <h2>{r.addReceiptTotal}</h2>
            </div>

            <input name="month" type="hidden" value={data.month.inputValue} />

            <label>
              {r.purchaseDate}
              <input
                defaultValue={defaultPurchaseDate}
                name="purchaseDate"
                required
                type="date"
              />
            </label>

            <label>
              {r.type}
              <select defaultValue="grocery" name="purchaseType">
                {purchaseTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {purchaseTypeLabel(option.value)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {t.common.store}
              <select name="storeId">
                <option value="">{t.common.noStore}</option>
                {data.stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {storeName(t, store.name)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {r.total}
              <input
                inputMode="decimal"
                min="0"
                name="totalAmount"
                placeholder="42.75"
                required
                step="0.01"
                type="number"
              />
            </label>

            <label>
              {t.common.notes}
              <textarea name="notes" rows={3} />
            </label>

            <details className="receipt-lines-panel">
              <summary>{r.optionalLines}</summary>
              <div className="receipt-lines">
                {receiptLineIndexes.map((index) => (
                  <fieldset className="receipt-line" key={index}>
                    <legend>{r.line(index + 1)}</legend>
                    <div className="form-grid">
                      <label>
                        {r.existingItem}
                        <select defaultValue="" name={`lineGroceryItemId-${index}`}>
                          <option value="">{r.customOrCategory}</option>
                          {groceryItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {r.itemName}
                        <input name={`lineItemName-${index}`} placeholder={r.itemPlaceholder} />
                      </label>
                    </div>
                    <div className="form-grid">
                      <label>
                        {t.common.category}
                        <select defaultValue="" name={`lineCategoryId-${index}`}>
                          <option value="">{t.common.noCategory}</option>
                          {data.categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {categoryName(t, category.name)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {r.lineTotal}
                        <input
                          inputMode="decimal"
                          min="0"
                          name={`lineTotalPrice-${index}`}
                          placeholder="8.25"
                          step="0.01"
                          type="number"
                        />
                      </label>
                    </div>
                    <div className="form-grid">
                      <label>
                        {t.common.quantity}
                        <input
                          inputMode="decimal"
                          name={`lineQuantity-${index}`}
                          placeholder="2"
                          step="0.01"
                          type="number"
                        />
                      </label>
                      <label>
                        {t.common.unit}
                        <select defaultValue="" name={`lineUnit-${index}`}>
                          <option value="">{t.common.noUnit}</option>
                          {receiptUnitOptions.map((unit) => (
                            <option key={unit} value={unit}>
                              {unitLabel(t, unit)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="form-grid">
                      <label>
                        {r.unitPrice}
                        <input
                          inputMode="decimal"
                          min="0"
                          name={`lineUnitPrice-${index}`}
                          placeholder="4.12"
                          step="0.01"
                          type="number"
                        />
                      </label>
                      <label>
                        {r.lineNotes}
                        <input name={`lineNotes-${index}`} />
                      </label>
                    </div>
                  </fieldset>
                ))}
              </div>
            </details>

            <button className="button" type="submit">
              {r.savePurchase}
            </button>
          </form>
        </aside>

        <main className="reports-main">
          <section className="reports-summary" aria-label={r.summary}>
            <article className="panel report-budget">
              <h2>{r.groceryBudget}</h2>
              <p className="metric">
                {money(data.budget.grocerySpent)}{" "}
                {data.budget.target !== null ? (
                  <span className="metric-unit">{r.ofAmount(money(data.budget.target))}</span>
                ) : null}
              </p>
              {data.budget.target !== null && data.budget.remaining !== null ? (
                <>
                  <div className="progress-track" aria-hidden="true">
                    <span
                      className={`progress-fill ${
                        data.budget.remaining < 0
                          ? "is-over"
                          : data.budget.usedPercent >= 85
                            ? "is-warn"
                            : ""
                      }`}
                      style={{ width: `${Math.min(data.budget.usedPercent, 100)}%` }}
                    />
                  </div>
                  <p className={data.budget.remaining < 0 ? "over-budget" : "muted"}>
                    {data.budget.remaining >= 0
                      ? r.left(money(data.budget.remaining))
                      : r.over(money(Math.abs(data.budget.remaining)))}
                  </p>
                </>
              ) : (
                <p className="muted">
                  {t.dashboard.noBudget} ·{" "}
                  <a className="text-link" href="/settings">
                    {t.dashboard.setBudget}
                  </a>
                </p>
              )}
            </article>

            <article className="panel">
              <h2>{r.totalSpend}</h2>
              <p className="metric">{money(data.totals.totalSpent)}</p>
              <p className="muted">{r.purchasesLogged(data.purchases.length)}</p>
            </article>

            <article className="panel">
              <h2>{r.eatingOut}</h2>
              <p className="metric">
                {money(data.totals.eatingOutSpent)}
              </p>
              <p className="muted">
                {r.household(money(data.totals.householdSpent))}
              </p>
            </article>
          </section>

          <section className="report-grid" aria-label={r.details}>
            <article className="panel report-panel">
              <div className="section-heading">
                <h2>{r.recentPurchases}</h2>
                <span className="badge">{data.month.label}</span>
              </div>
              {data.purchases.length > 0 ? (
                <ul className="status-list">
                  {data.purchases.map((purchase) => (
                    <li className="status-item purchase-row" key={purchase.id}>
                      <span>
                        <strong>
                          {purchase.store
                            ? storeName(t, purchase.store.name)
                            : purchaseTypeLabel(purchase.purchaseType)}
                        </strong>
                        <br />
                        <span className="muted">
                          {shortDate(purchase.purchaseDate)} ·{" "}
                          {purchaseTypeLabel(purchase.purchaseType)}
                          {purchase.notes ? ` · ${purchase.notes}` : ""}
                          {purchase.items.length > 0
                            ? ` · ${r.lineItems(purchase.items.length)}`
                            : ""}
                        </span>
                        {purchase.items.length > 0 ? (
                          <ul className="purchase-line-list">
                            {purchase.items.map((item) => (
                              <li key={item.id}>
                                <span>{lineItemName(item, locale, t)}</span>
                                <span>
                                  {money(item.totalPrice?.toNumber() ?? 0)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </span>
                      <span className="purchase-amount">
                        {money(purchase.totalAmount?.toNumber() ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">{r.noPurchases}</p>
              )}
            </article>

            <article className="panel report-panel">
              <div className="section-heading">
                <h2>{r.byCategory}</h2>
                <span className="badge">{data.categoryTotals.length}</span>
              </div>
              {data.categoryTotals.length > 0 ? (
                <ul className="status-list">
                  {data.categoryTotals.map((category) => (
                    <li className="status-item" key={category.categoryName}>
                      <strong>{categoryName(t, category.categoryName)}</strong>
                      <span>{money(category.total)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">{r.noCategories}</p>
              )}
            </article>

            <article className="panel report-panel">
              <div className="section-heading">
                <h2>{r.recipeUsage}</h2>
                <span className="badge">{data.recipeUsage.length}</span>
              </div>
              {data.recipeUsage.length > 0 ? (
                <ul className="status-list">
                  {data.recipeUsage.map((usage) => (
                    <li
                      className="status-item"
                      key={usage.recipe?.id ?? "missing-recipe"}
                    >
                      <strong>
                        {usage.recipe
                          ? recipeName(locale, usage.recipe)
                          : r.recipeRemoved}
                      </strong>
                      <span>{r.cooked(usage.count)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">{r.noUsage}</p>
              )}
            </article>

            <article className="panel report-panel">
              <div className="section-heading">
                <h2>{r.nutrition}</h2>
                <span className="badge">
                  {r.servingsTracked(
                    data.nutritionSummary.trackedServings,
                    data.nutritionSummary.totalServings
                  )}
                </span>
              </div>
              {data.nutritionSummary.averages ? (
                <>
                  <ul className="status-list">
                    <li className="status-item">
                      <strong>{r.avgCalories}</strong>
                      <span>{data.nutritionSummary.averages.calories}</span>
                    </li>
                    <li className="status-item">
                      <strong>{r.protein}</strong>
                      <span>{formatGrams(data.nutritionSummary.averages.proteinG)}</span>
                    </li>
                    <li className="status-item">
                      <strong>{r.carbs}</strong>
                      <span>{formatGrams(data.nutritionSummary.averages.carbsG)}</span>
                    </li>
                    <li className="status-item">
                      <strong>{r.fat}</strong>
                      <span>{formatGrams(data.nutritionSummary.averages.fatG)}</span>
                    </li>
                  </ul>
                  {data.nutritionSummary.missingNutritionCount > 0 ? (
                    <p className="muted">
                      {r.missingNutrition(data.nutritionSummary.missingNutritionCount)}
                    </p>
                  ) : null}
                  <ul className="purchase-line-list">
                    {data.nutritionSummary.topRecipes.map((recipe) => (
                      <li key={recipe.name}>
                        <span>
                          {recipe.name}
                          {!recipe.hasNutrition ? r.missingNutritionTag : ""}
                        </span>
                        <span>{r.cooked(recipe.cookedCount)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted">{r.noNutrition}</p>
              )}
            </article>

            <article className="panel report-panel">
              <div className="section-heading">
                <h2>{r.expiringThisMonth}</h2>
                <span className="badge">{data.expiringItems.length}</span>
              </div>
              {data.expiringItems.length > 0 ? (
                <ul className="status-list">
                  {data.expiringItems.map((item) => (
                    <li className="status-item" key={item.id}>
                      <span>
                        <strong>{groceryName(locale, item.groceryItem)}</strong>
                        <br />
                        <span className="muted">{locationLabel(t, item.location)}</span>
                      </span>
                      <span className="muted">
                        {item.expirationDate
                          ? shortDate(item.expirationDate)
                          : t.common.noDate}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">{r.noExpiring}</p>
              )}
            </article>
          </section>
        </main>
      </section>
    </>
  );
}

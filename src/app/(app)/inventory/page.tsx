import {
  addDays,
  daysUntilLabel,
  formatDateInput,
  formatQuantity,
  getInventoryItems,
  getInventoryReferenceData,
  getRecentInventoryTransactions,
  inventoryLocationOptions,
  inventoryRemovalOptions,
  inventoryStatusOptions,
  startOfToday,
  type InventoryFilters,
  type InventoryLocationValue,
  type InventoryStatusValue
} from "@/lib/inventory";
import { getHouseholdSettings } from "@/lib/household";
import { cleanIdParam } from "@/lib/recipes";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { unitOptionsFor } from "@/lib/units";
import { getI18n } from "@/lib/i18n/server";
import {
  categoryName,
  formatCalendarDate,
  formatTimestampDate,
  groceryName,
  locationLabel,
  messageText,
  storeName,
  unitLabel
} from "@/lib/i18n/text";
import {
  addInventoryItem,
  updateInventoryItem,
  updateInventoryStatus
} from "./actions";

export const dynamic = "force-dynamic";

type InventoryPageProps = {
  searchParams?: Promise<{
    category?: string;
    error?: string;
    expiring?: string;
    location?: string;
    notice?: string;
    q?: string;
    status?: string;
  }>;
};

function expiringCutoff(expiringDays: number) {
  return addDays(startOfToday(), expiringDays + 1);
}

function statusBadgeClass(status: string) {
  if (status === "available") {
    return "badge badge-good badge-dot";
  }

  if (status === "expired" || status === "discarded") {
    return "badge badge-bad";
  }

  return "badge badge-quiet";
}

function expiryBadgeClass(date: Date, expiringDays: number) {
  if (date < startOfToday()) {
    return "badge badge-bad";
  }

  return date < expiringCutoff(expiringDays) ? "badge badge-warn" : "badge badge-quiet";
}

function cleanSearchParam(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isInventoryLocation(value: string | undefined): value is InventoryLocationValue {
  return inventoryLocationOptions.some((option) => option.value === value);
}

function isInventoryStatus(
  value: string | undefined
): value is InventoryStatusValue | "all" {
  return (
    value === "all" ||
    inventoryStatusOptions.some((option) => option.value === value)
  );
}

function inventoryFiltersFromParams(
  searchParams: Awaited<NonNullable<InventoryPageProps["searchParams"]>>
): InventoryFilters {
  const location = cleanSearchParam(searchParams.location);
  const status = cleanSearchParam(searchParams.status);

  return {
    categoryId: cleanIdParam(searchParams.category),
    expiring: searchParams.expiring === "1",
    location: isInventoryLocation(location) ? location : undefined,
    query: cleanSearchParam(searchParams.q),
    status: isInventoryStatus(status) ? status : "available"
  };
}

function LocationSelect({
  defaultValue,
  emptyLabel,
  name = "location",
  t
}: {
  defaultValue?: string | null;
  emptyLabel: string;
  name?: string;
  t: Dictionary;
}) {
  return (
    <select defaultValue={defaultValue ?? ""} name={name}>
      <option value="">{emptyLabel}</option>
      {inventoryLocationOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {t.locations[option.value]}
        </option>
      ))}
    </select>
  );
}

function CategorySelect({
  categories,
  defaultValue,
  emptyLabel,
  t
}: {
  categories: Awaited<ReturnType<typeof getInventoryReferenceData>>["categories"];
  defaultValue?: string | null;
  emptyLabel: string;
  t: Dictionary;
}) {
  return (
    <select defaultValue={defaultValue ?? ""} name="categoryId">
      <option value="">{emptyLabel}</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {categoryName(t, category.name)}
        </option>
      ))}
    </select>
  );
}

function UnitSelect({
  defaultValue,
  t,
  units
}: {
  defaultValue?: string | null;
  t: Dictionary;
  units: readonly string[];
}) {
  return (
    <select defaultValue={defaultValue ?? ""} name="unit">
      <option value="">{t.common.noUnit}</option>
      {units.map((unit) => (
        <option key={unit} value={unit}>
          {unitLabel(t, unit)}
        </option>
      ))}
    </select>
  );
}

function StoreSelect({
  defaultValue,
  stores,
  t
}: {
  defaultValue?: string | null;
  stores: Awaited<ReturnType<typeof getInventoryReferenceData>>["stores"];
  t: Dictionary;
}) {
  return (
    <select defaultValue={defaultValue ?? ""} name="storeId">
      <option value="">{t.common.noStore}</option>
      {stores.map((store) => (
        <option key={store.id} value={store.id}>
          {storeName(t, store.name)}
        </option>
      ))}
    </select>
  );
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const params = (await searchParams) ?? {};
  const [{ locale, t }, settings] = await Promise.all([getI18n(), getHouseholdSettings()]);
  const expiringDays = settings.expiringSoonDays;
  const units = unitOptionsFor(settings.unitSystem);
  const filters = inventoryFiltersFromParams(params);
  const notice = messageText(t, params.notice);
  const error = messageText(t, params.error);
  const [{ categories, stores }, inventoryItems, recentTransactions] =
    await Promise.all([
      getInventoryReferenceData(),
      getInventoryItems(filters),
      getRecentInventoryTransactions()
    ]);

  const activeFilterCount = [
    filters.query,
    filters.categoryId,
    filters.location,
    filters.expiring,
    filters.status && filters.status !== "available"
  ].filter(Boolean).length;
  const expiringShownCount = inventoryItems.filter(
    (item) =>
      item.status === "available" &&
      item.expirationDate !== null &&
      item.expirationDate < expiringCutoff(expiringDays)
  ).length;

  return (
    <>
      <header className="page-header inventory-header">
        <div>
          <h1>{t.inventory.title}</h1>
          <p className="lead">{t.inventory.lead(expiringDays)}</p>
        </div>
        <a className="button" href="#add-inventory">
          {t.inventory.addItem}
        </a>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <section className="inventory-layout">
        <aside className="inventory-sidebar" id="add-inventory">
          <form action={addInventoryItem} className="panel form-panel">
            <div>
              <p className="eyebrow">{t.inventory.quickEntry}</p>
              <h2>{t.inventory.addInventory}</h2>
            </div>

            <label>
              {t.inventory.itemName}
              <input
                autoComplete="off"
                name="name"
                placeholder={t.inventory.itemNamePlaceholder}
                required
              />
            </label>

            <div className="form-grid">
              <label>
                {t.common.quantity}
                <input
                  inputMode="decimal"
                  name="quantity"
                  placeholder={t.inventory.quantityPlaceholder}
                />
              </label>
              <label>
                {t.common.unit}
                <UnitSelect t={t} units={units} />
              </label>
            </div>

            <label>
              {t.common.approximateAmount}
              <input name="quantityDescription" placeholder={t.inventory.approxPlaceholder} />
            </label>

            <div className="form-grid">
              <label>
                {t.common.category}
                <CategorySelect
                  categories={categories}
                  emptyLabel={t.common.noCategory}
                  t={t}
                />
              </label>
              <label>
                {t.common.location}
                <LocationSelect emptyLabel={t.common.noLocation} t={t} />
              </label>
            </div>

            <div className="form-grid">
              <label>
                {t.common.expires}
                <input name="expirationDate" type="date" />
              </label>
              <label>
                {t.common.purchased}
                <input name="purchaseDate" type="date" />
              </label>
            </div>

            <label>
              {t.common.store}
              <StoreSelect stores={stores} t={t} />
            </label>

            <label>
              {t.common.notes}
              <textarea name="notes" rows={3} />
            </label>

            <button className="button" type="submit">
              {t.inventory.saveInventory}
            </button>
          </form>

          <section className="panel transaction-panel">
            <h2>{t.inventory.recentActivity}</h2>
            {recentTransactions.length > 0 ? (
              <ul className="status-list">
                {recentTransactions.map((transaction) => (
                  <li className="status-item compact" key={transaction.id}>
                    <span>
                      <strong>{groceryName(locale, transaction.groceryItem)}</strong>
                      <br />
                      <span className="muted">
                        {t.transactionTypes[transaction.transactionType] ??
                          transaction.transactionType}{" "}
                        {transaction.quantity
                          ? formatQuantity(transaction.quantity, transaction.unit, null, t)
                          : ""}
                      </span>
                    </span>
                    <span className="muted">
                      {formatTimestampDate(locale, transaction.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t.inventory.noActivity}</p>
            )}
          </section>
        </aside>

        <main className="inventory-main">
          <form className="panel filters-panel" action="/inventory">
            <label>
              {t.common.search}
              <input
                defaultValue={filters.query ?? ""}
                name="q"
                placeholder={t.inventory.searchPlaceholder}
              />
            </label>
            <label>
              {t.common.category}
              <CategorySelect
                categories={categories}
                defaultValue={filters.categoryId}
                emptyLabel={t.common.anyCategory}
                t={t}
              />
            </label>
            <label>
              {t.common.location}
              <LocationSelect
                defaultValue={filters.location}
                emptyLabel={t.common.anyLocation}
                t={t}
              />
            </label>
            <label>
              {t.common.status}
              <select defaultValue={filters.status ?? "available"} name="status">
                <option value="available">{t.inventoryStatus.available}</option>
                <option value="all">{t.inventory.allStatuses}</option>
                {inventoryStatusOptions
                  .filter((option) => option.value !== "available")
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {t.inventoryStatus[option.value]}
                    </option>
                  ))}
              </select>
            </label>
            <label className="checkbox-label">
              <input
                defaultChecked={filters.expiring}
                name="expiring"
                type="checkbox"
                value="1"
              />
              {t.inventory.expiringSoon}
            </label>
            <div className="filter-actions">
              <button className="button" type="submit">
                {t.common.apply}
              </button>
              {activeFilterCount > 0 ? (
                <a className="secondary-button" href="/inventory">
                  {t.common.clear}
                </a>
              ) : null}
            </div>
          </form>

          <section className="inventory-summary" aria-label={t.inventory.summary}>
            <span className="stat-inline">
              <strong>{inventoryItems.length}</strong>
              {t.inventory.itemsShown(inventoryItems.length)}
            </span>
            <span className="stat-inline">
              <strong>{expiringShownCount}</strong>
              {t.inventory.expiringWithin(expiringDays)}
            </span>
            <span className="stat-inline">
              <strong>{recentTransactions.length}</strong>
              {t.inventory.recentChanges}
            </span>
          </section>

          <section className="inventory-list" aria-label={t.inventory.listLabel}>
            {inventoryItems.length > 0 ? (
              inventoryItems.map((item) => (
                <article className="panel inventory-card" key={item.id}>
                  <div className="inventory-card-main">
                    <div>
                      <p className="eyebrow">
                        {categoryName(t, item.groceryItem.category?.name)}
                      </p>
                      <h2>{groceryName(locale, item.groceryItem)}</h2>
                      <p className="muted">
                        {formatQuantity(
                          item.quantity,
                          item.unit,
                          item.quantityDescription,
                          t
                        )}
                      </p>
                    </div>
                    <div className="inventory-badges">
                      <span className={statusBadgeClass(item.status)}>
                        {t.inventoryStatus[item.status]}
                      </span>
                      {item.location ? (
                        <span className="badge badge-quiet">
                          {locationLabel(t, item.location)}
                        </span>
                      ) : null}
                      {item.expirationDate ? (
                        <span className={expiryBadgeClass(item.expirationDate, expiringDays)}>
                          {t.inventory.expiresIn(daysUntilLabel(item.expirationDate, t))}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <dl className="inventory-meta">
                    <div>
                      <dt>{t.common.purchased}</dt>
                      <dd>
                        {item.purchaseDate
                          ? formatCalendarDate(locale, item.purchaseDate, {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })
                          : t.common.notSet}
                      </dd>
                    </div>
                    <div>
                      <dt>{t.common.store}</dt>
                      <dd>{item.store ? storeName(t, item.store.name) : t.common.notSet}</dd>
                    </div>
                    <div>
                      <dt>{t.common.notes}</dt>
                      <dd>{item.notes || t.common.none}</dd>
                    </div>
                  </dl>

                  {item.status === "available" ? (
                    <div className="status-actions">
                      {inventoryRemovalOptions.map((option) => (
                        <form action={updateInventoryStatus} key={option.value}>
                          <input name="id" type="hidden" value={item.id} />
                          <input name="status" type="hidden" value={option.value} />
                          <button className="secondary-button" type="submit">
                            {t.inventoryRemoval[option.value]}
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : null}

                  <details className="edit-panel">
                    <summary>{t.inventory.editItem}</summary>
                    <form action={updateInventoryItem} className="edit-form">
                      <input name="id" type="hidden" value={item.id} />

                      <label>
                        {t.inventory.itemName}
                        <input
                          defaultValue={groceryName(locale, item.groceryItem)}
                          name="name"
                          required
                        />
                      </label>

                      <div className="form-grid">
                        <label>
                          {t.common.quantity}
                          <input
                            defaultValue={item.quantity?.toString() ?? ""}
                            inputMode="decimal"
                            name="quantity"
                          />
                        </label>
                        <label>
                          {t.common.unit}
                          <UnitSelect defaultValue={item.unit} t={t} units={units} />
                        </label>
                      </div>

                      <label>
                        {t.common.approximateAmount}
                        <input
                          defaultValue={item.quantityDescription ?? ""}
                          name="quantityDescription"
                        />
                      </label>

                      <div className="form-grid">
                        <label>
                          {t.common.category}
                          <CategorySelect
                            categories={categories}
                            defaultValue={item.groceryItem.categoryId}
                            emptyLabel={t.common.noCategory}
                            t={t}
                          />
                        </label>
                        <label>
                          {t.common.location}
                          <LocationSelect
                            defaultValue={item.location}
                            emptyLabel={t.common.noLocation}
                            t={t}
                          />
                        </label>
                      </div>

                      <div className="form-grid">
                        <label>
                          {t.common.expires}
                          <input
                            defaultValue={formatDateInput(item.expirationDate)}
                            name="expirationDate"
                            type="date"
                          />
                        </label>
                        <label>
                          {t.common.purchased}
                          <input
                            defaultValue={formatDateInput(item.purchaseDate)}
                            name="purchaseDate"
                            type="date"
                          />
                        </label>
                      </div>

                      <label>
                        {t.common.store}
                        <StoreSelect defaultValue={item.storeId} stores={stores} t={t} />
                      </label>

                      <label>
                        {t.common.notes}
                        <textarea
                          defaultValue={item.notes ?? ""}
                          name="notes"
                          rows={3}
                        />
                      </label>

                      <button className="button" type="submit">
                        {t.inventory.saveChanges}
                      </button>
                    </form>
                  </details>
                </article>
              ))
            ) : (
              <article className="panel empty-state">
                <h2>{t.inventory.emptyTitle}</h2>
                <p className="muted">{t.inventory.emptyBody}</p>
              </article>
            )}
          </section>
        </main>
      </section>
    </>
  );
}

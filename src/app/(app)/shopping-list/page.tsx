import type { Locale } from "@/lib/i18n/config";
import { getHouseholdSettings } from "@/lib/household";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { unitOptionsFor } from "@/lib/units";
import { getI18n } from "@/lib/i18n/server";
import {
  categoryName,
  formatCalendarDate,
  groceryName,
  messageText,
  storeName,
  unitLabel
} from "@/lib/i18n/text";
import { formatQuantity, inventoryLocationOptions } from "@/lib/inventory";
import {
  getDefaultPurchaseDate,
  getShoppingListPageData,
  groupShoppingItemsByCategory,
  type ShoppingReferenceData
} from "@/lib/shopping-lists";
import {
  addManualShoppingItem,
  archiveShoppingList,
  completeShoppingList,
  convertCheckedItemsToInventory,
  generateShoppingListFromMealPlan,
  toggleShoppingItemChecked,
  updateShoppingItem
} from "./actions";

export const dynamic = "force-dynamic";

type ShoppingListPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
  }>;
};

type ReferenceSelectProps = {
  defaultValue?: string | null;
  name?: string;
  referenceData: ShoppingReferenceData;
  t: Dictionary;
};

type ShoppingItem = NonNullable<
  Awaited<ReturnType<typeof getShoppingListPageData>>["currentList"]
>["items"][number];

function CategorySelect({ defaultValue, referenceData, t }: ReferenceSelectProps) {
  return (
    <select defaultValue={defaultValue ?? ""} name="categoryId">
      <option value="">{t.common.noCategory}</option>
      {referenceData.categories.map((category) => (
        <option key={category.id} value={category.id}>
          {categoryName(t, category.name)}
        </option>
      ))}
    </select>
  );
}

function GroceryItemSelect({
  locale,
  referenceData,
  t
}: {
  locale: Locale;
  referenceData: ShoppingReferenceData;
  t: Dictionary;
}) {
  const items = referenceData.groceryItems
    .map((item) => ({ id: item.id, label: groceryName(locale, item) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

  return (
    <select defaultValue="" name="groceryItemId">
      <option value="">{t.shopping.customItem}</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

function StoreSelect({
  defaultValue,
  name = "preferredStoreId",
  referenceData,
  t
}: ReferenceSelectProps) {
  return (
    <select defaultValue={defaultValue ?? ""} name={name}>
      <option value="">{t.common.noStore}</option>
      {referenceData.stores.map((store) => (
        <option key={store.id} value={store.id}>
          {storeName(t, store.name)}
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

function itemDisplayName(item: ShoppingItem, locale: Locale, t: Dictionary) {
  if (item.groceryItem) {
    return groceryName(locale, item.groceryItem);
  }

  return item.customItemName ?? t.shopping.shoppingItem;
}

function itemQuantityLabel(item: ShoppingItem, t: Dictionary) {
  if (item.buyQuantity && item.buyQuantity.isZero()) {
    return t.shopping.haveEnough;
  }

  if (item.buyQuantity) {
    return formatQuantity(item.buyQuantity, item.unit, null, t);
  }

  if (item.neededQuantity) {
    return t.shopping.review(formatQuantity(item.neededQuantity, item.unit, null, t));
  }

  return t.shopping.reviewAmount;
}

export default async function ShoppingListPage({
  searchParams
}: ShoppingListPageProps) {
  const params = (await searchParams) ?? {};
  const [{ locale, t }, settings] = await Promise.all([getI18n(), getHouseholdSettings()]);
  const units = unitOptionsFor(settings.unitSystem);
  const sh = t.shopping;
  const notice = messageText(t, params.notice);
  const error = messageText(t, params.error);
  const { currentList, referenceData } = await getShoppingListPageData();
  const categoryGroups = groupShoppingItemsByCategory(currentList);
  const checkedCount =
    currentList?.items.filter(
      (item) => item.checked && !item.convertedToInventoryAt
    ).length ?? 0;

  return (
    <>
      <header className="page-header inventory-header">
        <div>
          <h1>{sh.title}</h1>
          <p className="lead">{sh.lead}</p>
        </div>
        <form action={generateShoppingListFromMealPlan} className="header-action">
          <select
            aria-label={sh.approvedPlan}
            disabled={referenceData.approvedMealPlans.length === 0}
            name="mealPlanId"
          >
            {referenceData.approvedMealPlans.length === 0 ? (
              <option value="">{sh.noApprovedPlans}</option>
            ) : (
              referenceData.approvedMealPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {sh.weekOf(formatCalendarDate(locale, plan.weekStartDate))}
                </option>
              ))
            )}
          </select>
          <button
            className="button"
            disabled={referenceData.approvedMealPlans.length === 0}
            type="submit"
          >
            {sh.generate}
          </button>
        </form>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      {currentList ? (
        <section className="shopping-layout">
          <aside className="shopping-sidebar">
            <section className="panel form-panel">
              <div>
                <p className="eyebrow">{sh.listStatus[currentList.status]}</p>
                <h2>
                  {currentList.targetStartDate
                    ? sh.listTitle(formatCalendarDate(locale, currentList.targetStartDate))
                    : currentList.name}
                </h2>
                {currentList.targetStartDate && currentList.targetEndDate ? (
                  <p className="muted">
                    {sh.dateRange(
                      formatCalendarDate(locale, currentList.targetStartDate),
                      formatCalendarDate(locale, currentList.targetEndDate)
                    )}
                  </p>
                ) : null}
              </div>

              <dl className="inventory-meta shopping-summary">
                <div>
                  <dt>{sh.total}</dt>
                  <dd>{currentList.items.length}</dd>
                </div>
                <div>
                  <dt>{sh.checked}</dt>
                  <dd>{currentList.items.filter((item) => item.checked).length}</dd>
                </div>
                <div>
                  <dt>{sh.ready}</dt>
                  <dd>{checkedCount}</dd>
                </div>
              </dl>

              <form action={convertCheckedItemsToInventory} className="convert-form">
                <input name="shoppingListId" type="hidden" value={currentList.id} />
                <div className="form-grid">
                  <label>
                    {t.common.purchased}
                    <input
                      defaultValue={getDefaultPurchaseDate()}
                      name="purchaseDate"
                      type="date"
                    />
                  </label>
                  <label>
                    {t.common.expires}
                    <input name="expirationDate" type="date" />
                  </label>
                </div>
                <label>
                  {t.common.location}
                  <select defaultValue="" name="location">
                    <option value="">{t.common.noLocation}</option>
                    {inventoryLocationOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t.locations[option.value]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid">
                  <label>
                    {sh.receiptTotal}
                    <input
                      inputMode="decimal"
                      min="0"
                      name="receiptTotal"
                      placeholder="84.20"
                      step="0.01"
                      type="number"
                    />
                  </label>
                  <label>
                    {sh.receiptStore}
                    <StoreSelect
                      name="purchaseStoreId"
                      referenceData={referenceData}
                      t={t}
                    />
                  </label>
                </div>
                <label>
                  {sh.receiptNotes}
                  <textarea name="purchaseNotes" rows={2} />
                </label>
                <button className="button" disabled={checkedCount === 0} type="submit">
                  {sh.addChecked}
                </button>
              </form>

              <div className="filter-actions">
                <form action={completeShoppingList}>
                  <input name="shoppingListId" type="hidden" value={currentList.id} />
                  <button className="secondary-button" type="submit">
                    {t.common.complete}
                  </button>
                </form>
                <form action={archiveShoppingList}>
                  <input name="shoppingListId" type="hidden" value={currentList.id} />
                  <button className="secondary-button" type="submit">
                    {t.common.archive}
                  </button>
                </form>
              </div>
            </section>

            <form action={addManualShoppingItem} className="panel form-panel">
              <input name="shoppingListId" type="hidden" value={currentList.id} />
              <div>
                <p className="eyebrow">{sh.extraItem}</p>
                <h2>{sh.addToList}</h2>
              </div>
              <label>
                {sh.existingItem}
                <GroceryItemSelect locale={locale} referenceData={referenceData} t={t} />
              </label>
              <label>
                {sh.customItemName}
                <input name="customItemName" placeholder={sh.customPlaceholder} />
              </label>
              <div className="form-grid">
                <label>
                  {t.common.quantity}
                  <input inputMode="decimal" name="buyQuantity" placeholder="2" />
                </label>
                <label>
                  {t.common.unit}
                  <UnitSelect t={t} units={units} />
                </label>
              </div>
              <div className="form-grid">
                <label>
                  {t.common.category}
                  <CategorySelect referenceData={referenceData} t={t} />
                </label>
                <label>
                  {t.common.store}
                  <StoreSelect referenceData={referenceData} t={t} />
                </label>
              </div>
              <label>
                {t.common.notes}
                <textarea name="notes" rows={3} />
              </label>
              <button className="button" type="submit">
                {sh.addExtra}
              </button>
            </form>
          </aside>

          <main className="shopping-main">
            {categoryGroups.map((group) => (
              <section className="panel shopping-category" key={group.categoryName}>
                <h2>{categoryName(t, group.categoryName)}</h2>
                <div className="shopping-item-list">
                  {group.items.map((item) => {
                    const displayName = itemDisplayName(item, locale, t);

                    return (
                    <article
                      className={`shopping-item ${item.checked ? "shopping-item-checked" : ""}`}
                      key={item.id}
                    >
                      <form action={toggleShoppingItemChecked}>
                        <input name="id" type="hidden" value={item.id} />
                        <input
                          name="checked"
                          type="hidden"
                          value={item.checked ? "false" : "true"}
                        />
                        <button
                          aria-label={
                            item.checked
                              ? sh.markNotPurchased(displayName)
                              : sh.markPurchased(displayName)
                          }
                          className="check-button"
                          type="submit"
                        >
                          {item.checked ? "OK" : ""}
                        </button>
                      </form>
                      <div className="shopping-item-main">
                        <div>
                          <h3>{displayName}</h3>
                          <p className="muted">
                            {itemQuantityLabel(item, t)}
                            {item.haveQuantity ? (
                              <>
                                {" · "}
                                {sh.have(formatQuantity(item.haveQuantity, item.unit, null, t))}
                              </>
                            ) : null}
                          </p>
                        </div>
                        <div className="inventory-badges">
                          {item.isExtraItem ? <span className="badge badge-warn">{sh.extra}</span> : null}
                          {item.convertedToInventoryAt ? (
                            <span className="badge badge-good">{sh.inInventory}</span>
                          ) : null}
                          {item.preferredStore ? (
                            <span className="badge badge-quiet">
                              {storeName(t, item.preferredStore.name)}
                            </span>
                          ) : null}
                        </div>
                        {item.notes ? <p className="muted">{item.notes}</p> : null}
                        <details className="edit-panel">
                          <summary>{t.common.edit}</summary>
                          <form action={updateShoppingItem} className="edit-form">
                            <input name="id" type="hidden" value={item.id} />
                            <div className="form-grid">
                              <label>
                                {t.common.quantity}
                                <input
                                  defaultValue={item.buyQuantity?.toString() ?? ""}
                                  inputMode="decimal"
                                  name="buyQuantity"
                                />
                              </label>
                              <label>
                                {t.common.unit}
                                <UnitSelect defaultValue={item.unit} t={t} units={units} />
                              </label>
                            </div>
                            <div className="form-grid">
                              <label>
                                {t.common.category}
                                <CategorySelect
                                  defaultValue={
                                    item.categoryId ?? item.groceryItem?.categoryId
                                  }
                                  referenceData={referenceData}
                                  t={t}
                                />
                              </label>
                              <label>
                                {t.common.store}
                                <StoreSelect
                                  defaultValue={item.preferredStoreId}
                                  referenceData={referenceData}
                                  t={t}
                                />
                              </label>
                            </div>
                            <label>
                              {t.common.notes}
                              <textarea
                                defaultValue={item.notes ?? ""}
                                name="notes"
                                rows={3}
                              />
                            </label>
                            <button className="button" type="submit">
                              {sh.saveItem}
                            </button>
                          </form>
                        </details>
                      </div>
                    </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </main>
        </section>
      ) : (
        <article className="panel empty-state">
          <h2>{sh.emptyTitle}</h2>
          <p className="muted">{sh.emptyBody}</p>
        </article>
      )}
    </>
  );
}

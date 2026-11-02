import type { Store } from "@prisma/client";
import { countryOptions, currencies, currencyName } from "@/lib/countries";
import {
  dietaryRestrictionOptions,
  isoWeekdays,
  mealPatternOptions,
  memberAge,
  type HouseholdWithMembers
} from "@/lib/household";
import { intlLocale, locales, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { storeName } from "@/lib/i18n/text";
import { saveHouseholdAction } from "./household-actions";

type HouseholdFormProps = {
  household: HouseholdWithMembers | null;
  locale: Locale;
  mode: "setup" | "settings";
  stores: Store[];
  suggestedCountry?: string;
  t: Dictionary;
};

function weekdayLabel(locale: Locale, isoDay: number) {
  // 2024-01-01 was a Monday.
  const date = new Date(Date.UTC(2024, 0, isoDay));
  const label = date.toLocaleDateString(intlLocale(locale), {
    timeZone: "UTC",
    weekday: "long"
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function serverTimeZone() {
  return process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function HouseholdForm({
  household,
  locale,
  mode,
  stores,
  suggestedCountry,
  t
}: HouseholdFormProps) {
  const h = t.household;
  const members = household?.members ?? [];
  const memberRows = Math.max(members.length + 2, mode === "setup" ? 4 : 3);
  const isSetup = mode === "setup";
  const planDays = new Set(household?.planDays ?? [1, 2, 3, 4, 5]);
  const allVegetarian =
    members.length > 0 &&
    members.every((member) =>
      member.dietaryRestrictions.some((r) => r === "vegetarian" || r === "vegan")
    );

  return (
    <form action={saveHouseholdAction} className="recipe-form household-form">
      <input name="mode" type="hidden" value={mode} />
      <input name="memberCount" type="hidden" value={memberRows} />

      <section className="panel form-panel">
        <h2>{h.sectionHousehold}</h2>
        <label>
          {h.householdName}
          <input
            autoComplete="off"
            defaultValue={household?.name ?? ""}
            name="name"
            placeholder={h.householdNamePlaceholder}
            required
          />
        </label>
      </section>

      <section className="panel form-panel">
        <div>
          <h2>{h.sectionMembers}</h2>
          <p className="form-hint">{h.membersHint}</p>
        </div>

        <div className="recipe-row-list">
          {Array.from({ length: memberRows }, (_, index) => {
            const member = members[index];

            return (
              <fieldset className="ingredient-row receipt-line" key={member?.id ?? `new-${index}`}>
                <legend>{h.member(index + 1)}</legend>
                {member ? (
                  <input name={`memberId_${index}`} type="hidden" value={member.id} />
                ) : null}
                <div className="member-row-grid">
                  <label>
                    {h.memberName}
                    <input
                      autoComplete="off"
                      defaultValue={member?.name ?? ""}
                      name={`memberName_${index}`}
                    />
                  </label>
                  <label>
                    {h.memberAge}
                    <input
                      defaultValue={memberAge(member?.birthYear ?? null) ?? ""}
                      inputMode="numeric"
                      max={120}
                      min={0}
                      name={`memberAge_${index}`}
                      type="number"
                    />
                  </label>
                  <label>
                    {h.dislikes}
                    <input
                      defaultValue={member?.dislikes ?? ""}
                      name={`memberDislikes_${index}`}
                      placeholder={h.dislikesPlaceholder}
                    />
                  </label>
                </div>
                <details
                  className="edit-panel diet-details"
                  open={Boolean(member?.dietaryRestrictions.length)}
                >
                  <summary>
                    {h.dietary}
                    {member?.dietaryRestrictions.length
                      ? ` · ${member.dietaryRestrictions.map((r) => t.dietary[r] ?? r).join(", ")}`
                      : ""}
                  </summary>
                  <div className="tag-checkbox-grid">
                    {dietaryRestrictionOptions.map((option) => (
                      <label className="checkbox-label" key={option}>
                        <input
                          defaultChecked={member?.dietaryRestrictions.includes(option) ?? false}
                          name={`memberDiet_${index}`}
                          type="checkbox"
                          value={option}
                        />
                        {t.dietary[option]}
                      </label>
                    ))}
                  </div>
                </details>
                {member ? (
                  <label className="checkbox-label remove-label">
                    <input name={`memberRemove_${index}`} type="checkbox" />
                    {h.removeMember}
                  </label>
                ) : null}
              </fieldset>
            );
          })}
        </div>
      </section>

      <section className="panel form-panel">
        <h2>{h.sectionLocation}</h2>
        <div className="form-grid">
          <label>
            {h.country}
            <select
              defaultValue={household?.countryCode ?? suggestedCountry ?? ""}
              name="countryCode"
              required
            >
              <option disabled value="">
                —
              </option>
              {countryOptions(locale, h.otherCountry).map((country) => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {h.city}
            <input defaultValue={household?.city ?? ""} name="city" />
          </label>
        </div>
        <div className="form-grid three">
          <label>
            {h.currency}
            <select defaultValue={isSetup ? "" : household?.currency ?? ""} name="currency">
              <option value="">{h.automatic}</option>
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {currencyName(locale, code)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {h.language}
            <select
              defaultValue={isSetup ? locale : household?.defaultLocale ?? locale}
              name="defaultLocale"
            >
              {locales.map((option) => (
                <option key={option} lang={option} value={option}>
                  {t.locale[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {h.units}
            <select defaultValue={isSetup ? "" : household?.unitSystem ?? ""} name="unitSystem">
              <option value="">{h.automatic}</option>
              <option value="metric">{h.unitSystems.metric}</option>
              <option value="imperial">{h.unitSystems.imperial}</option>
            </select>
          </label>
        </div>
        <p className="form-hint">{h.timezoneNote(serverTimeZone())}</p>
      </section>

      <section className="panel form-panel">
        <div>
          <h2>{h.sectionBudget}</h2>
          <p className="form-hint">{h.budgetHint}</p>
        </div>
        <div className="form-grid">
          <label>
            {h.budgetAmount}
            <input
              defaultValue={household?.budgetAmount?.toString() ?? ""}
              inputMode="decimal"
              min="0"
              name="budgetAmount"
              placeholder="300"
              step="0.01"
              type="number"
            />
          </label>
          <label>
            {h.budgetPeriod}
            <select defaultValue={household?.budgetPeriod ?? "monthly"} name="budgetPeriod">
              <option value="monthly">{h.budgetPeriods.monthly}</option>
              <option value="weekly">{h.budgetPeriods.weekly}</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel form-panel">
        <h2>{h.sectionMeals}</h2>

        <fieldset className="chip-group">
          <legend>{h.planDays}</legend>
          <div className="tag-checkbox-grid weekday-grid">
            {isoWeekdays.map((day) => (
              <label className="checkbox-label" key={day}>
                <input
                  defaultChecked={planDays.has(day)}
                  name="planDays"
                  type="checkbox"
                  value={day}
                />
                {weekdayLabel(locale, day)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="chip-group">
          <legend>{h.mealPattern}</legend>
          <div className="choice-list">
            {mealPatternOptions.map((pattern) => (
              <label className="choice" key={pattern}>
                <input
                  defaultChecked={(household?.mealPattern ?? "shared_lunch_dinner") === pattern}
                  name="mealPattern"
                  type="radio"
                  value={pattern}
                />
                {h.mealPatterns[pattern]}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="checkbox-label">
          <input
            defaultChecked={household?.includeVegetarian ?? true}
            name="includeVegetarian"
            type="checkbox"
          />
          {h.includeVegetarian}
        </label>
        {allVegetarian ? <p className="form-hint">{h.allVegetarianNote}</p> : null}

        <label className="narrow-field">
          {h.expiringDays}
          <input
            defaultValue={household?.expiringSoonDays ?? 5}
            inputMode="numeric"
            max={30}
            min={1}
            name="expiringSoonDays"
            type="number"
          />
        </label>
      </section>

      <section className="panel form-panel">
        <div>
          <h2>{h.sectionStores}</h2>
          <p className="form-hint">{h.storesHint}</p>
        </div>
        {stores.length > 0 ? (
          <fieldset className="chip-group">
            <legend>{h.markStoresToRemove}</legend>
            <div className="tag-checkbox-grid store-grid">
              {stores.map((store) => (
                <label
                  className="checkbox-label remove-label"
                  key={store.id}
                  title={h.removeStore(storeName(t, store.name))}
                >
                  <input name="storeRemove" type="checkbox" value={store.id} />
                  {storeName(t, store.name)}
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="muted">{h.noStores}</p>
        )}
        <label>
          {h.newStores}
          <textarea name="newStores" placeholder={h.newStoresPlaceholder} rows={3} />
        </label>
      </section>

      <div className="form-actions">
        <button className="button" type="submit">
          {isSetup ? h.saveSetup : h.saveSettings}
        </button>
      </div>
    </form>
  );
}

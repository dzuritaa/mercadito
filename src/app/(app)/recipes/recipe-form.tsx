import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { groceryName, tagName, unitLabel } from "@/lib/i18n/text";
import {
  formatDecimalInput,
  MAX_RECIPE_INGREDIENTS,
  MAX_RECIPE_STEPS,
  MAX_RECIPE_SUBSTITUTIONS,
  type RecipeDetail
} from "@/lib/recipes";

type RecipeReferenceData = {
  groceryItems: {
    id: string;
    name: string;
    nameEn: string | null;
    nameEs: string | null;
  }[];
  tags: { id: string; name: string; description: string | null }[];
};

type RecipeFormProps = {
  action: (formData: FormData) => Promise<void>;
  locale: Locale;
  recipe?: RecipeDetail;
  referenceData: RecipeReferenceData;
  t: Dictionary;
  units: readonly string[];
};

function rowCount(existingCount: number, blankRows: number, maxRows: number) {
  return Math.min(Math.max(existingCount + blankRows, blankRows), maxRows);
}

function LangTag({ code }: { code: "EN" | "ES" }) {
  return (
    <span aria-hidden="true" className="lang-tag">
      {code}
    </span>
  );
}

function UnitSelect({
  defaultValue,
  name,
  t,
  units
}: {
  defaultValue?: string | null;
  name: string;
  t: Dictionary;
  units: readonly string[];
}) {
  return (
    <select defaultValue={defaultValue ?? ""} name={name}>
      <option value="">{t.common.noUnit}</option>
      {units.map((unit) => (
        <option key={unit} value={unit}>
          {unitLabel(t, unit)}
        </option>
      ))}
    </select>
  );
}

function GroceryNameInput({
  defaultValue,
  lang,
  listId,
  name,
  placeholder
}: {
  defaultValue?: string | null;
  lang?: string;
  listId: string;
  name: string;
  placeholder: string;
}) {
  return (
    <input
      autoComplete="off"
      defaultValue={defaultValue ?? ""}
      lang={lang}
      list={listId}
      name={name}
      placeholder={placeholder}
    />
  );
}

/** Every known name (canonical, English, Spanish) for autocomplete. */
function groceryNameOptions(items: RecipeReferenceData["groceryItems"]) {
  const names = new Set<string>();

  for (const item of items) {
    for (const value of [item.name, item.nameEn, item.nameEs]) {
      if (value?.trim()) {
        names.add(value.trim());
      }
    }
  }

  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export function RecipeForm({
  action,
  locale,
  recipe,
  referenceData,
  t,
  units
}: RecipeFormProps) {
  const f = t.recipeForm;
  const groceryListId = `grocery-items-${recipe?.id ?? "new"}`;
  const selectedTagIds = new Set(recipe?.tags.map((tagMap) => tagMap.tagId) ?? []);
  const ingredientRows = rowCount(
    recipe?.ingredients.length ?? 0,
    4,
    MAX_RECIPE_INGREDIENTS
  );
  const stepRows = rowCount(recipe?.steps.length ?? 0, 4, MAX_RECIPE_STEPS);
  const substitutionRows = rowCount(
    recipe?.substitutions.length ?? 0,
    2,
    MAX_RECIPE_SUBSTITUTIONS
  );

  return (
    <form action={action} className="recipe-form">
      {recipe ? <input name="id" type="hidden" value={recipe.id} /> : null}

      <datalist id={groceryListId}>
        {groceryNameOptions(referenceData.groceryItems).map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <section className="panel form-panel">
        <div>
          <p className="eyebrow">{f.basicsEyebrow}</p>
          <h2>{f.details}</h2>
        </div>

        <div className="lang-pair">
          <label>
            <span>
              {f.recipeName}
              <LangTag code="ES" />
            </span>
            <input
              autoComplete="off"
              defaultValue={recipe?.nameEs ?? ""}
              lang="es"
              name="nameEs"
              placeholder={f.recipeNamePlaceholderEs}
            />
          </label>
          <label>
            <span>
              {f.recipeName}
              <LangTag code="EN" />
            </span>
            <input
              autoComplete="off"
              defaultValue={recipe?.nameEn ?? ""}
              lang="en"
              name="nameEn"
              placeholder={f.recipeNamePlaceholderEn}
            />
          </label>
        </div>

        <div className="lang-pair">
          <label>
            <span>
              {f.description}
              <LangTag code="ES" />
            </span>
            <textarea
              defaultValue={recipe?.descriptionEs ?? ""}
              lang="es"
              name="descriptionEs"
              rows={3}
            />
          </label>
          <label>
            <span>
              {f.description}
              <LangTag code="EN" />
            </span>
            <textarea
              defaultValue={recipe?.descriptionEn ?? ""}
              lang="en"
              name="descriptionEn"
              rows={3}
            />
          </label>
        </div>

        <div className="form-grid">
          <label>
            {t.common.servings}
            <input
              defaultValue={recipe?.servings ?? 4}
              inputMode="numeric"
              min={1}
              name="servings"
              type="number"
            />
          </label>
          <label>
            {f.estimatedCost}
            <input
              defaultValue={formatDecimalInput(recipe?.estimatedCost ?? null)}
              inputMode="decimal"
              name="estimatedCost"
              placeholder="8.50"
            />
          </label>
        </div>

        <div className="form-grid">
          <label>
            {f.prepMinutes}
            <input
              defaultValue={recipe?.prepTimeMinutes ?? ""}
              inputMode="numeric"
              min={0}
              name="prepTimeMinutes"
              type="number"
            />
          </label>
          <label>
            {f.cookMinutes}
            <input
              defaultValue={recipe?.cookTimeMinutes ?? ""}
              inputMode="numeric"
              min={0}
              name="cookTimeMinutes"
              type="number"
            />
          </label>
        </div>

        <label>
          {f.source}
          <input
            defaultValue={recipe?.source ?? ""}
            name="source"
            placeholder={f.sourcePlaceholder}
          />
        </label>

        <div className="lang-pair">
          <label>
            <span>
              {f.instructionsSummary}
              <LangTag code="ES" />
            </span>
            <textarea
              defaultValue={recipe?.instructionsSummaryEs ?? ""}
              lang="es"
              name="instructionsSummaryEs"
              rows={3}
            />
          </label>
          <label>
            <span>
              {f.instructionsSummary}
              <LangTag code="EN" />
            </span>
            <textarea
              defaultValue={recipe?.instructionsSummaryEn ?? ""}
              lang="en"
              name="instructionsSummaryEn"
              rows={3}
            />
          </label>
        </div>
      </section>

      <section className="panel form-panel">
        <div>
          <p className="eyebrow">{f.ingredientsEyebrow}</p>
          <h2>{f.ingredients}</h2>
        </div>
        <p className="form-hint">{f.ingredientsHint}</p>

        <div className="recipe-row-list">
          {Array.from({ length: ingredientRows }, (_, index) => {
            const ingredient = recipe?.ingredients[index];
            const item = ingredient?.groceryItem;

            return (
              <fieldset className="ingredient-row receipt-line" key={index}>
                <legend>{f.ingredientRow(index + 1)}</legend>
                <div className="ingredient-row-grid">
                  <label>
                    {f.itemEs}
                    <GroceryNameInput
                      defaultValue={item ? item.nameEs ?? (item.nameEn ? null : item.name) : null}
                      lang="es"
                      listId={groceryListId}
                      name={`ingredientNameEs_${index}`}
                      placeholder={f.itemPlaceholderEs}
                    />
                  </label>
                  <label>
                    {f.itemEn}
                    <GroceryNameInput
                      defaultValue={item ? item.nameEn ?? (item.nameEs ? null : item.name) : null}
                      lang="en"
                      listId={groceryListId}
                      name={`ingredientNameEn_${index}`}
                      placeholder={f.itemPlaceholderEn}
                    />
                  </label>
                  <label>
                    {f.qty}
                    <input
                      defaultValue={formatDecimalInput(ingredient?.quantity ?? null)}
                      inputMode="decimal"
                      name={`ingredientQuantity_${index}`}
                      placeholder="1"
                    />
                  </label>
                  <label>
                    {t.common.unit}
                    <UnitSelect
                      defaultValue={ingredient?.unit}
                      name={`ingredientUnit_${index}`}
                      t={t}
                      units={units}
                    />
                  </label>
                  <label>
                    {f.approx}
                    <input
                      defaultValue={ingredient?.quantityDescription ?? ""}
                      name={`ingredientQuantityDescription_${index}`}
                      placeholder={f.approxPlaceholder}
                    />
                  </label>
                </div>
                <div className="ingredient-row-grid secondary">
                  <label>
                    {f.notesEs}
                    <input
                      defaultValue={ingredient?.notesEs ?? ""}
                      lang="es"
                      name={`ingredientNotesEs_${index}`}
                      placeholder={f.notesPlaceholderEs}
                    />
                  </label>
                  <label>
                    {f.notesEn}
                    <input
                      defaultValue={ingredient?.notesEn ?? ""}
                      lang="en"
                      name={`ingredientNotesEn_${index}`}
                      placeholder={f.notesPlaceholderEn}
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      defaultChecked={ingredient?.optional ?? false}
                      name={`ingredientOptional_${index}`}
                      type="checkbox"
                    />
                    {f.optional}
                  </label>
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>

      <section className="panel form-panel">
        <div>
          <p className="eyebrow">{f.stepsEyebrow}</p>
          <h2>{f.steps}</h2>
        </div>

        <div className="recipe-step-list">
          {Array.from({ length: stepRows }, (_, index) => {
            const step = recipe?.steps[index];

            return (
              <fieldset className="step-pair receipt-line" key={index}>
                <legend>{f.step(index + 1)}</legend>
                <div className="lang-pair">
                  <label>
                    <span>
                      {f.spanish}
                      <LangTag code="ES" />
                    </span>
                    <textarea
                      defaultValue={step?.instructionEs ?? ""}
                      lang="es"
                      name={`stepInstructionEs_${index}`}
                      rows={2}
                    />
                  </label>
                  <label>
                    <span>
                      {f.english}
                      <LangTag code="EN" />
                    </span>
                    <textarea
                      defaultValue={step?.instructionEn ?? ""}
                      lang="en"
                      name={`stepInstructionEn_${index}`}
                      rows={2}
                    />
                  </label>
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>

      <section className="panel form-panel">
        <div>
          <p className="eyebrow">{f.signalsEyebrow}</p>
          <h2>{f.tagsAndNutrition}</h2>
        </div>

        <div className="tag-checkbox-grid">
          {referenceData.tags.map((tag) => (
            <label className="checkbox-label" key={tag.id} title={tag.description ?? ""}>
              <input
                defaultChecked={selectedTagIds.has(tag.id)}
                name="tagIds"
                type="checkbox"
                value={tag.id}
              />
              {tagName(t, tag.name)}
            </label>
          ))}
        </div>

        <div className="nutrition-grid">
          <label>
            {f.calories}
            <input
              defaultValue={formatDecimalInput(recipe?.caloriesPerServing ?? null)}
              inputMode="decimal"
              name="caloriesPerServing"
            />
          </label>
          <label>
            {f.protein}
            <input
              defaultValue={formatDecimalInput(recipe?.proteinGPerServing ?? null)}
              inputMode="decimal"
              name="proteinGPerServing"
            />
          </label>
          <label>
            {f.carbs}
            <input
              defaultValue={formatDecimalInput(recipe?.carbsGPerServing ?? null)}
              inputMode="decimal"
              name="carbsGPerServing"
            />
          </label>
          <label>
            {f.fat}
            <input
              defaultValue={formatDecimalInput(recipe?.fatGPerServing ?? null)}
              inputMode="decimal"
              name="fatGPerServing"
            />
          </label>
        </div>
      </section>

      <section className="panel form-panel">
        <div>
          <p className="eyebrow">{f.swapsEyebrow}</p>
          <h2>{f.substitutions}</h2>
        </div>

        <div className="recipe-row-list">
          {Array.from({ length: substitutionRows }, (_, index) => {
            const substitution = recipe?.substitutions[index];

            return (
              <fieldset className="ingredient-row receipt-line" key={index}>
                <legend>{`${f.substitutions} ${index + 1}`}</legend>
                <div className="lang-pair">
                  <label>
                    {f.original}
                    <GroceryNameInput
                      defaultValue={
                        substitution
                          ? groceryName(locale, substitution.originalGroceryItem)
                          : null
                      }
                      listId={groceryListId}
                      name={`substitutionOriginal_${index}`}
                      placeholder={f.originalPlaceholder}
                    />
                  </label>
                  <label>
                    {f.substitute}
                    <GroceryNameInput
                      defaultValue={
                        substitution
                          ? groceryName(locale, substitution.substituteGroceryItem)
                          : null
                      }
                      listId={groceryListId}
                      name={`substitutionSubstitute_${index}`}
                      placeholder={f.substitutePlaceholder}
                    />
                  </label>
                </div>
                <div className="ingredient-row-grid secondary">
                  <label>
                    {f.noteEs}
                    <input
                      defaultValue={substitution?.substitutionNoteEs ?? ""}
                      lang="es"
                      name={`substitutionNoteEs_${index}`}
                      placeholder={f.notePlaceholderEs}
                    />
                  </label>
                  <label>
                    {f.noteEn}
                    <input
                      defaultValue={substitution?.substitutionNoteEn ?? ""}
                      lang="en"
                      name={`substitutionNoteEn_${index}`}
                      placeholder={f.notePlaceholderEn}
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      defaultChecked={substitution?.healthImprovement ?? false}
                      name={`substitutionHealth_${index}`}
                      type="checkbox"
                    />
                    {f.healthImprovement}
                  </label>
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>

      <section className="panel form-panel">
        <div>
          <p className="eyebrow">{f.feedbackEyebrow}</p>
          <h2>{f.rating}</h2>
        </div>

        <div className="form-grid">
          <label>
            {f.rating}
            <select defaultValue={recipe?.rating?.rating ?? ""} name="rating">
              <option value="">{t.common.notRated}</option>
              {[1, 2, 3, 4, 5].map((rating) => (
                <option key={rating} value={rating}>
                  {t.common.rating(rating)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {f.cookAgain}
            <select
              defaultValue={
                recipe?.rating?.wouldCookAgain === true
                  ? "yes"
                  : recipe?.rating?.wouldCookAgain === false
                    ? "no"
                    : ""
              }
              name="wouldCookAgain"
            >
              <option value="">{t.common.notSure}</option>
              <option value="yes">{t.common.yes}</option>
              <option value="no">{t.common.no}</option>
            </select>
          </label>
        </div>

        <label>
          {f.ratingNotes}
          <textarea
            defaultValue={recipe?.rating?.notes ?? ""}
            name="ratingNotes"
            rows={3}
          />
        </label>
      </section>

      <div className="form-actions">
        <button className="button" type="submit">
          {f.saveRecipe}
        </button>
        <Link
          className="secondary-button"
          href={recipe ? `/recipes/${recipe.id}` : "/recipes"}
        >
          {t.common.cancel}
        </Link>
      </div>
    </form>
  );
}

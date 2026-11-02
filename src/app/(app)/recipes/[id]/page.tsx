import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cookedMealReviewCount,
  getRecipeCookedMeals
} from "@/lib/cooking";
import { getHouseholdSettings } from "@/lib/household";
import { hasLocalized, pickLocalized } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import {
  cookingNoteText,
  formatCurrency,
  formatTimestampDate,
  groceryName,
  messageText,
  recipeDescription,
  recipeName,
  tagName
} from "@/lib/i18n/text";
import {
  formatRecipeQuantity,
  formatRecipeRating,
  cleanIdParam,
  formatRecipeTime,
  getRecipeById
} from "@/lib/recipes";
import {
  getRecipeMatchForRecipe,
  type IngredientMatch
} from "@/lib/recipe-matching";
import { markRecipeCookedAction } from "@/app/(app)/cooking/actions";
import { updateRecipeActiveStatus } from "../actions";

export const dynamic = "force-dynamic";

type RecipeDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string;
    notice?: string;
  }>;
};

function NutritionValue({
  label,
  notSet,
  value
}: {
  label: string;
  notSet: string;
  value: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || notSet}</dd>
    </div>
  );
}

function matchStatusLabel(ingredient: IngredientMatch, t: Dictionary) {
  if (ingredient.status === "substituted") {
    return t.match.use(ingredient.substituteName ?? "");
  }

  if (ingredient.status === "available_unverified_quantity") {
    return t.match.statusAvailableCheck;
  }

  return ingredient.status === "available" ? t.match.statusAvailable : t.match.statusMissing;
}

function matchBadgeClass(ingredient: IngredientMatch) {
  if (ingredient.status === "substituted") {
    return "badge badge-warn";
  }

  if (
    ingredient.status === "available" ||
    ingredient.status === "available_unverified_quantity"
  ) {
    return "badge badge-good";
  }

  return ingredient.isOptional ? "badge badge-quiet" : "badge badge-bad";
}

export default async function RecipeDetailPage({
  params,
  searchParams
}: RecipeDetailPageProps) {
  const { id } = await params;

  if (!cleanIdParam(id)) {
    notFound();
  }
  const query = (await searchParams) ?? {};
  const [{ locale, t }, settings] = await Promise.all([getI18n(), getHouseholdSettings()]);
  const d = t.recipeDetail;
  const [recipe, recipeMatch, cookedMeals] = await Promise.all([
    getRecipeById(id),
    getRecipeMatchForRecipe(id, locale),
    getRecipeCookedMeals(id)
  ]);
  const notice = messageText(t, query.notice);
  const error = messageText(t, query.error);

  if (!recipe) {
    notFound();
  }

  const totalTime = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
  const missingTranslation = !hasLocalized(locale, recipe.nameEn, recipe.nameEs);
  const noteText = (en: string | null, es: string | null) => pickLocalized(locale, en, es);

  return (
    <>
      <header className="page-header inventory-header">
        <div>
          <p className="eyebrow">
            <Link className="text-link" href="/recipes">
              {d.breadcrumb}
            </Link>
            {recipe.isActive ? null : <span className="tone-shop"> · {d.archived}</span>}
          </p>
          <h1>{recipeName(locale, recipe)}</h1>
          <p className="lead">{recipeDescription(locale, recipe) || d.noDescription}</p>
        </div>
        <div className="filter-actions">
          <Link className="button" href={`/recipes/${recipe.id}/edit`}>
            {t.common.edit}
          </Link>
        </div>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}
      {missingTranslation ? (
        <p className="notice notice-warning">
          {d.fallbackNotice(t.locale[locale])}{" "}
          <Link className="text-link" href={`/recipes/${recipe.id}/edit`}>
            {d.addTranslation}
          </Link>
        </p>
      ) : null}

      <section className="recipe-detail-grid">
        <article className="panel">
          <h2>{d.overview}</h2>
          <dl className="inventory-meta recipe-detail-meta">
            <div>
              <dt>{t.common.servings}</dt>
              <dd>{recipe.servings}</dd>
            </div>
            <div>
              <dt>{d.prep}</dt>
              <dd>{formatRecipeTime(recipe.prepTimeMinutes, t)}</dd>
            </div>
            <div>
              <dt>{d.cook}</dt>
              <dd>{formatRecipeTime(recipe.cookTimeMinutes, t)}</dd>
            </div>
            <div>
              <dt>{d.total}</dt>
              <dd>{formatRecipeTime(totalTime || null, t)}</dd>
            </div>
            <div>
              <dt>{d.cost}</dt>
              <dd>
                {recipe.estimatedCost
                  ? formatCurrency(locale, recipe.estimatedCost.toNumber(), settings.currency, settings.countryCode)
                  : t.common.notSet}
              </dd>
            </div>
            <div>
              <dt>{d.source}</dt>
              <dd>{recipe.source || t.common.notSet}</dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <h2>{d.tags}</h2>
          <div className="recipe-tags">
            {recipe.tags.length > 0 ? (
              recipe.tags.map((tagMap) => (
                <span className="badge badge-quiet" key={tagMap.tagId}>
                  {tagName(t, tagMap.tag.name)}
                </span>
              ))
            ) : (
              <p className="muted">{d.noTags}</p>
            )}
          </div>
        </article>

        <article className="panel">
          <h2>{d.householdRating}</h2>
          <p className="metric">{formatRecipeRating(recipe.rating?.rating, t)}</p>
          <p className="muted">
            {d.cookAgain(
              recipe.rating?.wouldCookAgain === true
                ? t.common.yes
                : recipe.rating?.wouldCookAgain === false
                  ? t.common.no
                  : t.common.notSure
            )}
          </p>
          {recipe.rating?.notes ? <p>{recipe.rating.notes}</p> : null}
        </article>

        {recipeMatch ? (
          <article className="panel">
            <h2>{d.matchTitle}</h2>
            <p className="metric">{recipeMatch.score}</p>
            <p className="muted">
              {d.matchSummary(
                recipeMatch.availableRequiredCount,
                recipeMatch.missingRequiredCount,
                recipeMatch.expiringMatchedCount
              )}
            </p>
            <ul className="explanation-list">
              {recipeMatch.explanations.slice(0, 3).map((explanation) => (
                <li key={explanation}>{explanation}</li>
              ))}
            </ul>
          </article>
        ) : null}

        <article className="panel">
          <h2>{d.cookTitle}</h2>
          <p className="muted">{d.cookLead}</p>
          <form action={markRecipeCookedAction} className="cook-form">
            <input name="recipeId" type="hidden" value={recipe.id} />
            <input name="returnTo" type="hidden" value={`/recipes/${recipe.id}`} />
            <label>
              {d.servingsCooked}
              <input
                defaultValue={recipe.servings}
                min={1}
                name="servingsCooked"
                type="number"
              />
            </label>
            <label>
              {t.common.notes}
              <textarea name="notes" rows={3} />
            </label>
            <button className="button" type="submit">
              {d.markCooked}
            </button>
          </form>
        </article>

        <article className="panel panel-large">
          <h2>{d.ingredients}</h2>
          <ul className="status-list">
            {(recipeMatch?.ingredients ?? []).length > 0
              ? recipeMatch?.ingredients.map((ingredient) => (
                  <li className="status-item" key={ingredient.ingredientId}>
                    <span>
                      <strong>{ingredient.ingredientName}</strong>
                      {ingredient.isOptional ? (
                        <span className="muted"> {t.common.optional}</span>
                      ) : null}
                      <br />
                      <span className="muted">
                        {d.need(ingredient.requiredQuantityLabel)}
                        {ingredient.notes ? ` · ${ingredient.notes}` : ""}
                      </span>
                      {ingredient.substituteName ? (
                        <>
                          <br />
                          <span className="muted">
                            {d.substituteAvailable(ingredient.substituteName)}
                          </span>
                        </>
                      ) : null}
                    </span>
                    <span className="ingredient-badges">
                      {ingredient.isExpiringSoon && ingredient.expirationLabel ? (
                        <span className="badge warning-badge">
                          {ingredient.expirationLabel}
                        </span>
                      ) : null}
                      <span className={matchBadgeClass(ingredient)}>
                        {matchStatusLabel(ingredient, t)}
                      </span>
                    </span>
                  </li>
                ))
              : recipe.ingredients.map((ingredient) => (
                  <li className="status-item" key={ingredient.id}>
                    <span>
                      <strong>{groceryName(locale, ingredient.groceryItem)}</strong>
                      {ingredient.optional ? (
                        <span className="muted"> {t.common.optional}</span>
                      ) : null}
                      <br />
                      <span className="muted">
                        {noteText(ingredient.notesEn, ingredient.notesEs) || d.noNotes}
                      </span>
                    </span>
                    <span className="badge">
                      {formatRecipeQuantity(
                        ingredient.quantity,
                        ingredient.unit,
                        ingredient.quantityDescription,
                        t
                      )}
                    </span>
                  </li>
                ))}
          </ul>
        </article>

        <article className="panel panel-large">
          <h2>{d.steps}</h2>
          <ol className="recipe-steps">
            {recipe.steps.map((step) => (
              <li key={step.id}>{noteText(step.instructionEn, step.instructionEs)}</li>
            ))}
          </ol>
        </article>

        <article className="panel">
          <h2>{d.nutrition}</h2>
          <dl className="inventory-meta recipe-detail-meta">
            <NutritionValue
              label={d.calories}
              notSet={t.common.notSet}
              value={recipe.caloriesPerServing?.toString() ?? ""}
            />
            <NutritionValue
              label={d.protein}
              notSet={t.common.notSet}
              value={
                recipe.proteinGPerServing
                  ? `${recipe.proteinGPerServing.toString()} g`
                  : ""
              }
            />
            <NutritionValue
              label={d.carbs}
              notSet={t.common.notSet}
              value={
                recipe.carbsGPerServing ? `${recipe.carbsGPerServing.toString()} g` : ""
              }
            />
            <NutritionValue
              label={d.fat}
              notSet={t.common.notSet}
              value={recipe.fatGPerServing ? `${recipe.fatGPerServing.toString()} g` : ""}
            />
          </dl>
        </article>

        <article className="panel">
          <h2>{d.substitutions}</h2>
          {recipe.substitutions.length > 0 ? (
            <ul className="status-list">
              {recipe.substitutions.map((substitution) => (
                <li className="status-item compact" key={substitution.id}>
                  <span>
                    <strong>
                      {groceryName(locale, substitution.originalGroceryItem)} →{" "}
                      {groceryName(locale, substitution.substituteGroceryItem)}
                    </strong>
                    <br />
                    <span className="muted">
                      {noteText(substitution.substitutionNoteEn, substitution.substitutionNoteEs) ||
                        d.noNote}
                    </span>
                  </span>
                  {substitution.healthImprovement ? (
                    <span className="badge badge-good">{d.health}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{d.noSubstitutions}</p>
          )}
        </article>

        <article className="panel panel-large">
          <h2>{d.cookedHistory}</h2>
          {cookedMeals.length > 0 ? (
            <div className="cooked-history-list">
              {cookedMeals.map((meal) => {
                const reviewCount = cookedMealReviewCount(meal);

                return (
                  <section className="cooked-history-item" key={meal.id}>
                    <div className="recipe-card-header">
                      <div>
                        <h3>
                          {formatTimestampDate(locale, meal.cookedAt, {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </h3>
                        <p className="muted">
                          {d.servingsLabel(meal.servingsCooked)}
                          {meal.notes ? ` · ${meal.notes}` : ""}
                        </p>
                      </div>
                      {reviewCount > 0 ? (
                        <span className="badge warning-badge">
                          {d.needsReview(reviewCount)}
                        </span>
                      ) : (
                        <span className="badge badge-good">{d.allDeducted}</span>
                      )}
                    </div>
                    <ul className="status-list">
                      {meal.ingredients.map((ingredient) => (
                        <li className="status-item compact" key={ingredient.id}>
                          <span>
                            <strong>
                              {ingredient.groceryItem
                                ? groceryName(locale, ingredient.groceryItem)
                                : ingredient.ingredientName}
                            </strong>
                            <br />
                            <span className="muted">
                              {d.need(
                                formatRecipeQuantity(
                                  ingredient.requestedQuantity,
                                  ingredient.requestedUnit,
                                  null,
                                  t
                                )
                              )}
                              {ingredient.deductedQuantity
                                ? ` · ${t.recipeDetail.deductionStatus.deducted.toLowerCase()} ${formatRecipeQuantity(
                                    ingredient.deductedQuantity,
                                    ingredient.requestedUnit,
                                    null,
                                    t
                                  )}`
                                : ""}
                            </span>
                            {ingredient.notes ? (
                              <>
                                <br />
                                <span className="muted">
                                  {cookingNoteText(t, ingredient.notes)}
                                </span>
                              </>
                            ) : null}
                          </span>
                          <span
                            className={
                              ingredient.deductionStatus === "deducted"
                                ? "badge badge-good"
                                : "badge badge-warn"
                            }
                          >
                            {d.deductionStatus[ingredient.deductionStatus]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="muted">{d.noHistory}</p>
          )}
        </article>

        <article className="panel">
          <h2>{d.status}</h2>
          <p className="muted">{recipe.isActive ? d.statusActive : d.statusArchived}</p>
          <form action={updateRecipeActiveStatus}>
            <input name="id" type="hidden" value={recipe.id} />
            <input
              name="isActive"
              type="hidden"
              value={recipe.isActive ? "false" : "true"}
            />
            <button className="secondary-button" type="submit">
              {recipe.isActive ? d.archiveRecipe : d.reactivateRecipe}
            </button>
          </form>
        </article>
      </section>
    </>
  );
}

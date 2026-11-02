import Link from "next/link";
import {
  getRecipeMatches,
  type IngredientMatch,
  type RecipeMatch
} from "@/lib/recipe-matching";
import { markRecipeCookedAction } from "@/app/(app)/cooking/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getI18n } from "@/lib/i18n/server";
import { messageText, tagName } from "@/lib/i18n/text";

export const dynamic = "force-dynamic";

type CookNowPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
  }>;
};

function statusLabel(ingredient: IngredientMatch, t: Dictionary) {
  if (ingredient.status === "substituted") {
    return t.match.use(ingredient.substituteName ?? "");
  }

  if (ingredient.status === "available" || ingredient.status === "available_unverified_quantity") {
    return t.match.statusAvailable;
  }

  return t.match.statusMissing;
}

function matchTone(match: RecipeMatch, t: Dictionary) {
  if (match.missingRequiredCount === 0) {
    return { label: t.cookNow.toneReady, tone: "tone-ready", score: "score-good" };
  }

  if (match.missingRequiredCount <= 2) {
    return { label: t.cookNow.toneNear, tone: "tone-near", score: "score-mid" };
  }

  return { label: t.cookNow.toneShop, tone: "tone-shop", score: "" };
}

function ingredientBadgeClass(ingredient: IngredientMatch) {
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

export default async function CookNowPage({ searchParams }: CookNowPageProps) {
  const params = (await searchParams) ?? {};
  const { locale, t } = await getI18n();
  const matches = await getRecipeMatches({ locale });
  const notice = messageText(t, params.notice);
  const error = messageText(t, params.error);

  return (
    <>
      <header className="page-header inventory-header">
        <div>
          <h1>{t.cookNow.title}</h1>
          <p className="lead">{t.cookNow.lead}</p>
        </div>
        <Link className="secondary-button" href="/recipes">
          {t.cookNow.browseRecipes}
        </Link>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <section className="cook-now-list" aria-label={t.cookNow.listLabel}>
        {matches.length > 0 ? (
          matches.map((match) => {
            const tone = matchTone(match, t);

            return (
            <article className="panel cook-now-card" key={match.recipe.id}>
              <div className="recipe-card-header">
                <div>
                  <p className={`eyebrow ${tone.tone}`}>{tone.label}</p>
                  <h2>
                    <Link href={`/recipes/${match.recipe.id}`}>{match.recipe.name}</Link>
                  </h2>
                  <p className="muted">
                    {match.recipe.description || t.recipes.noDescription}
                  </p>
                </div>
                <span
                  className={`score-badge ${tone.score}`}
                  data-label={t.cookNow.score}
                >
                  {match.score}
                </span>
              </div>

              <dl className="inventory-meta cook-now-meta">
                <div>
                  <dt>{t.cookNow.available}</dt>
                  <dd>{match.availableRequiredCount}</dd>
                </div>
                <div>
                  <dt>{t.cookNow.missing}</dt>
                  <dd>{match.missingRequiredCount}</dd>
                </div>
                <div>
                  <dt>{t.cookNow.expiring}</dt>
                  <dd>{match.expiringMatchedCount}</dd>
                </div>
                <div>
                  <dt>{t.cookNow.rating}</dt>
                  <dd>
                    {match.recipe.rating
                      ? t.common.rating(match.recipe.rating)
                      : t.common.notRated}
                  </dd>
                </div>
              </dl>

              <div className="recipe-tags">
                {match.recipe.tags.map((tag) => (
                  <span className="badge badge-quiet" key={tag}>
                    {tagName(t, tag)}
                  </span>
                ))}
              </div>

              <ul className="explanation-list">
                {match.explanations.slice(0, 4).map((explanation) => (
                  <li key={explanation}>{explanation}</li>
                ))}
              </ul>

              <div className="ingredient-match-grid">
                {match.ingredients.map((ingredient) => (
                  <div className="ingredient-match" key={ingredient.ingredientId}>
                    <span>
                      <strong>{ingredient.ingredientName}</strong>
                      {ingredient.isOptional ? (
                        <span className="muted"> {t.common.optional}</span>
                      ) : null}
                      {ingredient.substituteName ? (
                        <>
                          <br />
                          <span className="muted">
                            {t.cookNow.substitute(ingredient.substituteName)}
                          </span>
                        </>
                      ) : null}
                    </span>
                    <span className={ingredientBadgeClass(ingredient)}>
                      {statusLabel(ingredient, t)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="card-actions">
                <Link className="secondary-button" href={`/recipes/${match.recipe.id}`}>
                  {t.cookNow.viewRecipe}
                </Link>
                <form action={markRecipeCookedAction} className="inline-cook-form">
                  <input name="recipeId" type="hidden" value={match.recipe.id} />
                  <input name="returnTo" type="hidden" value="/cook-now" />
                  <label>
                    {t.common.servings}
                    <input
                      defaultValue={match.recipe.servings}
                      min={1}
                      name="servingsCooked"
                      type="number"
                    />
                  </label>
                  <button className="button" type="submit">
                    {t.cookNow.markCooked}
                  </button>
                </form>
              </div>
            </article>
            );
          })
        ) : (
          <article className="panel empty-state">
            <h2>{t.cookNow.emptyTitle}</h2>
            <p className="muted">{t.cookNow.emptyBody}</p>
          </article>
        )}
      </section>
    </>
  );
}

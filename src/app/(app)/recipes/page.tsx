import Link from "next/link";
import {
  cleanIdParam,
  cleanRecipeSearchParam,
  formatRecipeRating,
  formatRecipeTime,
  getRecipeReferenceData,
  getRecipes,
  isRecipeStatusFilter,
  type RecipeFilters
} from "@/lib/recipes";
import { getI18n } from "@/lib/i18n/server";
import {
  messageText,
  recipeDescription,
  recipeLanguages,
  recipeName,
  tagName
} from "@/lib/i18n/text";

export const dynamic = "force-dynamic";

type RecipesPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
    q?: string;
    status?: string;
    tag?: string;
  }>;
};

function filtersFromParams(
  searchParams: Awaited<NonNullable<RecipesPageProps["searchParams"]>>
): RecipeFilters {
  const status = cleanRecipeSearchParam(searchParams.status);

  return {
    query: cleanRecipeSearchParam(searchParams.q),
    status: isRecipeStatusFilter(status) ? status : "active",
    tagId: cleanIdParam(searchParams.tag)
  };
}

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const params = (await searchParams) ?? {};
  const { locale, t } = await getI18n();
  const filters = filtersFromParams(params);
  const [{ tags }, recipes] = await Promise.all([
    getRecipeReferenceData(),
    getRecipes(filters, locale)
  ]);
  const notice = messageText(t, params.notice);
  const error = messageText(t, params.error);
  const activeFilterCount = [
    filters.query,
    filters.tagId,
    filters.status && filters.status !== "active"
  ].filter(Boolean).length;

  return (
    <>
      <header className="page-header inventory-header">
        <div>
          <h1>{t.recipes.title}</h1>
          <p className="lead">{t.recipes.lead}</p>
        </div>
        <Link className="button" href="/recipes/new">
          {t.recipes.addRecipe}
        </Link>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <form className="panel filters-panel recipe-filters" action="/recipes">
        <label>
          {t.common.search}
          <input
            defaultValue={filters.query ?? ""}
            name="q"
            placeholder={t.recipes.searchPlaceholder}
          />
        </label>
        <label>
          {t.recipes.tag}
          <select defaultValue={filters.tagId ?? ""} name="tag">
            <option value="">{t.recipes.anyTag}</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tagName(t, tag.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.common.status}
          <select defaultValue={filters.status ?? "active"} name="status">
            <option value="active">{t.recipes.statusActive}</option>
            <option value="all">{t.recipes.statusAll}</option>
            <option value="archived">{t.recipes.statusArchived}</option>
          </select>
        </label>
        <div className="filter-actions">
          <button className="button" type="submit">
            {t.common.apply}
          </button>
          {activeFilterCount > 0 ? (
            <Link className="secondary-button" href="/recipes">
              {t.common.clear}
            </Link>
          ) : null}
        </div>
      </form>

      <section className="recipe-grid" aria-label={t.recipes.listLabel}>
        {recipes.length > 0 ? (
          recipes.map((recipe) => {
            const totalTime =
              (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
            const languages = recipeLanguages(recipe);
            const translationLabel =
              languages.en && languages.es
                ? t.recipes.translationBadge.both
                : languages.es
                  ? t.recipes.translationBadge.esOnly
                  : t.recipes.translationBadge.enOnly;
            const missingOwnLanguage = !languages[locale];

            return (
              <article className="panel recipe-card" key={recipe.id}>
                <div className="recipe-card-header">
                  <div>
                    {recipe.isActive ? null : (
                      <p className="eyebrow tone-shop">{t.recipes.archived}</p>
                    )}
                    <h2>
                      <Link href={`/recipes/${recipe.id}`}>{recipeName(locale, recipe)}</Link>
                    </h2>
                  </div>
                  <span className="badge">{formatRecipeRating(recipe.rating?.rating, t)}</span>
                </div>

                <p className="muted">
                  {recipeDescription(locale, recipe) || t.recipes.noDescription}
                </p>

                <div className="recipe-tags">
                  {recipe.tags.length > 0 ? (
                    recipe.tags.map((tagMap) => (
                      <span className="badge badge-quiet" key={tagMap.tagId}>
                        {tagName(t, tagMap.tag.name)}
                      </span>
                    ))
                  ) : (
                    <span className="muted">{t.recipes.noTags}</span>
                  )}
                </div>

                <dl className="inventory-meta recipe-meta">
                  <div>
                    <dt>{t.common.servings}</dt>
                    <dd>{recipe.servings}</dd>
                  </div>
                  <div>
                    <dt>{t.recipes.totalTime}</dt>
                    <dd>{formatRecipeTime(totalTime || null, t)}</dd>
                  </div>
                  <div>
                    <dt>{t.recipes.ingredients}</dt>
                    <dd>{recipe.ingredients.length}</dd>
                  </div>
                </dl>

                <div className="card-actions">
                  <div className="filter-actions">
                    <Link className="button" href={`/recipes/${recipe.id}`}>
                      {t.common.view}
                    </Link>
                    <Link
                      className="secondary-button"
                      href={`/recipes/${recipe.id}/edit`}
                    >
                      {t.common.edit}
                    </Link>
                  </div>
                  <span
                    className={`badge translation-badge ${
                      missingOwnLanguage ? "badge-warn" : "badge-quiet"
                    }`}
                    title={
                      missingOwnLanguage
                        ? t.recipes.missingTranslation(t.locale[locale])
                        : undefined
                    }
                  >
                    {translationLabel}
                  </span>
                </div>
              </article>
            );
          })
        ) : (
          <article className="panel empty-state">
            <h2>{t.recipes.emptyTitle}</h2>
            <p className="muted">{t.recipes.emptyBody}</p>
          </article>
        )}
      </section>
    </>
  );
}

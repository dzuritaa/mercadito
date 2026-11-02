import Link from "next/link";
import { notFound } from "next/navigation";
import { getHouseholdSettings } from "@/lib/household";
import { getI18n } from "@/lib/i18n/server";
import { unitOptionsFor } from "@/lib/units";
import { recipeName } from "@/lib/i18n/text";
import { cleanIdParam, getRecipeById, getRecipeReferenceData } from "@/lib/recipes";
import { updateRecipe } from "../../actions";
import { RecipeForm } from "../../recipe-form";

export const dynamic = "force-dynamic";

type EditRecipePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const { id } = await params;

  if (!cleanIdParam(id)) {
    notFound();
  }

  const [{ locale, t }, recipe, referenceData, settings] = await Promise.all([
    getI18n(),
    getRecipeById(id),
    getRecipeReferenceData(),
    getHouseholdSettings()
  ]);

  if (!recipe) {
    notFound();
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            <Link className="text-link" href="/recipes">
              {t.recipeForm.breadcrumb}
            </Link>
            {" · "}
            <Link className="text-link" href={`/recipes/${recipe.id}`}>
              {recipeName(locale, recipe)}
            </Link>
          </p>
          <h1>{t.recipeForm.editTitle}</h1>
          <p className="lead">{t.recipeForm.editLead}</p>
        </div>
      </header>

      <RecipeForm
        action={updateRecipe}
        locale={locale}
        recipe={recipe}
        referenceData={referenceData}
        t={t}
        units={unitOptionsFor(settings.unitSystem)}
      />
    </>
  );
}

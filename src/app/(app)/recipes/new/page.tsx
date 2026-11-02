import Link from "next/link";
import { getHouseholdSettings } from "@/lib/household";
import { getI18n } from "@/lib/i18n/server";
import { unitOptionsFor } from "@/lib/units";
import { getRecipeReferenceData } from "@/lib/recipes";
import { createRecipe } from "../actions";
import { RecipeForm } from "../recipe-form";

export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  const [{ locale, t }, referenceData, settings] = await Promise.all([
    getI18n(),
    getRecipeReferenceData(),
    getHouseholdSettings()
  ]);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            <Link className="text-link" href="/recipes">
              {t.recipeForm.breadcrumb}
            </Link>
          </p>
          <h1>{t.recipeForm.newTitle}</h1>
          <p className="lead">{t.recipeForm.newLead}</p>
        </div>
      </header>

      <RecipeForm
        action={createRecipe}
        locale={locale}
        referenceData={referenceData}
        t={t}
        units={unitOptionsFor(settings.unitSystem)}
      />
    </>
  );
}

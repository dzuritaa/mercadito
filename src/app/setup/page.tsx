import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyUser } from "@/lib/auth/session";
import { countryFromAcceptLanguage } from "@/lib/countries";
import { getHousehold } from "@/lib/household";
import { getI18n } from "@/lib/i18n/server";
import { messageText } from "@/lib/i18n/text";
import { prisma } from "@/lib/prisma";
import { NewAccountFields } from "../account-fields";
import { createAccountAction } from "../auth-actions";
import { AuthShell } from "../auth-shell";
import { HouseholdForm } from "../household-form";

export const dynamic = "force-dynamic";

type SetupPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

/**
 * First run, in two steps:
 * 1. No account yet → create it (anyone who reaches a fresh install can).
 * 2. Signed in, household not configured → household wizard.
 */
export default async function SetupPage({ searchParams }: SetupPageProps) {
  const params = (await searchParams) ?? {};
  const [{ locale, t }, household, anyUser] = await Promise.all([
    getI18n(),
    getHousehold(),
    hasAnyUser()
  ]);
  const error = messageText(t, params.error);

  if (!anyUser) {
    return (
      <AuthShell locale={locale} t={t} width="narrow">
        <header className="page-header">
          <div>
            <p className="eyebrow">{t.auth.createStep}</p>
            <h1>{t.auth.createTitle}</h1>
            <p className="lead">{t.auth.createLead}</p>
          </div>
        </header>

        {error ? (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        ) : null}

        <form action={createAccountAction} className="panel form-panel">
          <NewAccountFields t={t} />
          <button className="button" type="submit">
            {t.auth.createAccount}
          </button>
        </form>
      </AuthShell>
    );
  }

  if (!(await getCurrentUser())) {
    redirect("/login?next=/setup");
  }

  if (household?.setupCompletedAt) {
    redirect("/settings");
  }

  const [stores, headerList] = await Promise.all([
    prisma.store.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    headers()
  ]);

  return (
    <AuthShell locale={locale} t={t}>
      <header className="page-header">
        <div>
          <p className="eyebrow">{t.auth.householdStep}</p>
          <h1>{t.household.setupTitle}</h1>
          <p className="lead">{t.household.setupLead}</p>
        </div>
      </header>

      {error ? (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      ) : null}

      <HouseholdForm
        household={household}
        locale={locale}
        mode="setup"
        stores={stores}
        suggestedCountry={countryFromAcceptLanguage(headerList.get("accept-language"))}
        t={t}
      />
    </AuthShell>
  );
}

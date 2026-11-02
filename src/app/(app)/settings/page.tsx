import { getHousehold } from "@/lib/household";
import { getI18n } from "@/lib/i18n/server";
import { messageText } from "@/lib/i18n/text";
import { prisma } from "@/lib/prisma";
import { NewPasswordFields } from "../../account-fields";
import { changePasswordAction } from "../../auth-actions";
import { HouseholdForm } from "../../household-form";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams?: Promise<{ error?: string; notice?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = (await searchParams) ?? {};
  const [{ locale, t }, household, stores] = await Promise.all([
    getI18n(),
    getHousehold(),
    prisma.store.findMany({ where: { active: true }, orderBy: { name: "asc" } })
  ]);
  const notice = messageText(t, params.notice);
  const error = messageText(t, params.error);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t.household.settingsTitle}</h1>
          <p className="lead">{t.household.settingsLead}</p>
        </div>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}
      {error ? <p className="notice notice-error">{error}</p> : null}

      <HouseholdForm
        household={household}
        locale={locale}
        mode="settings"
        stores={stores}
        t={t}
      />

      <form action={changePasswordAction} className="panel form-panel account-form" id="account">
        <div>
          <h2>{t.auth.accountSection}</h2>
          <p className="form-hint">{t.auth.accountHint}</p>
        </div>
        <label className="narrow-field">
          {t.auth.currentPassword}
          <input autoComplete="current-password" name="currentPassword" required type="password" />
        </label>
        <NewPasswordFields label={t.auth.newPassword} t={t} />
        <div className="form-actions">
          <button className="secondary-button" type="submit">
            {t.auth.changePassword}
          </button>
        </div>
      </form>
    </>
  );
}

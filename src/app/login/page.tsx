import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyUser, safeNextPath } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { messageText } from "@/lib/i18n/text";
import { AuthShell } from "../auth-shell";
import { loginAction } from "../auth-actions";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{ error?: string; next?: string; notice?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!(await hasAnyUser())) {
    redirect("/setup");
  }

  const params = (await searchParams) ?? {};
  const next = safeNextPath(params.next);

  if (await getCurrentUser()) {
    redirect(next);
  }

  const { locale, t } = await getI18n();
  const notice = messageText(t, params.notice);
  const error = messageText(t, params.error);

  return (
    <AuthShell locale={locale} t={t} width="narrow">
      <header className="page-header">
        <div>
          <h1>{t.auth.loginTitle}</h1>
          <p className="lead">{t.auth.loginLead}</p>
        </div>
      </header>

      {notice ? <p className="notice">{notice}</p> : null}
      {error ? (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      ) : null}

      <form action={loginAction} className="panel form-panel">
        <input name="next" type="hidden" value={next} />
        <label>
          {t.auth.username}
          <input
            autoCapitalize="none"
            autoComplete="username"
            autoFocus
            name="username"
            required
            spellCheck={false}
          />
        </label>
        <label>
          {t.auth.password}
          <input autoComplete="current-password" name="password" required type="password" />
        </label>
        <button className="button" type="submit">
          {t.auth.signIn}
        </button>
      </form>

      <p className="form-hint auth-help">{t.auth.forgotPassword}</p>
    </AuthShell>
  );
}

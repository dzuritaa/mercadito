import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isSetupComplete } from "@/lib/household";
import { getI18n } from "@/lib/i18n/server";
import { BrandMark } from "../brand-mark";
import { logoutAction } from "../auth-actions";
import { LocaleSwitcher } from "../locale-switcher";
import { MainNav } from "./main-nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await isSetupComplete())) {
    redirect("/setup");
  }

  const { locale, t } = await getI18n();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <BrandMark />
          <span className="brand-text">
            <span className="brand-title">{t.nav.brandTitle}</span>
            <span className="brand-subtitle">{t.nav.brandSubtitle}</span>
          </span>
        </Link>
        <MainNav labels={t.nav} />
        <div className="sidebar-footer">
          <LocaleSwitcher locale={locale} t={t} />
          <form action={logoutAction} className="account-box">
            <span className="account-name">{t.auth.signedInAs(user.username)}</span>
            <button className="signout-button" type="submit">
              {t.auth.signOut}
            </button>
          </form>
        </div>
      </aside>
      <main className="main" id="main-content">
        {children}
      </main>
    </div>
  );
}

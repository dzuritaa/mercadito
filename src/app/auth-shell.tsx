import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { BrandMark } from "./brand-mark";
import { LocaleSwitcher } from "./locale-switcher";

/** Minimal frame for pages shown before signing in (login, first run). */
export function AuthShell({
  children,
  locale,
  t,
  width = "wide"
}: {
  children: React.ReactNode;
  locale: Locale;
  t: Dictionary;
  width?: "narrow" | "wide";
}) {
  return (
    <div className="setup-shell">
      <header className="setup-topbar">
        <span className="brand setup-brand">
          <BrandMark />
          <span className="brand-text">
            <span className="brand-title">{t.nav.brandTitle}</span>
          </span>
        </span>
        <LocaleSwitcher locale={locale} t={t} variant="light" />
      </header>
      <main className={`setup-main${width === "narrow" ? " auth-narrow" : ""}`} id="main-content">
        {children}
      </main>
    </div>
  );
}

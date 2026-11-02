import { locales, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { setLocaleAction } from "./locale-actions";

export function LocaleSwitcher({
  locale,
  t,
  variant = "sidebar"
}: {
  locale: Locale;
  t: Dictionary;
  variant?: "sidebar" | "light";
}) {
  return (
    <form
      action={setLocaleAction}
      className={`locale-switcher${variant === "light" ? " locale-switcher-light" : ""}`}
    >
      <span className="locale-label" id="locale-label">
        {t.locale.label}
      </span>
      <div aria-labelledby="locale-label" className="locale-options" role="group">
        {locales.map((option) => (
          <button
            aria-pressed={option === locale}
            className="locale-option"
            key={option}
            lang={option}
            name="locale"
            title={t.locale[option]}
            type="submit"
            value={option}
          >
            <span aria-hidden="true">{t.locale.short[option]}</span>
            <span className="locale-option-name">{t.locale[option]}</span>
          </button>
        ))}
      </div>
    </form>
  );
}

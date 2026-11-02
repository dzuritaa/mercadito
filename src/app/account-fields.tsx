import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** Username + password + confirmation, used when creating the account. */
export function NewAccountFields({ t }: { t: Dictionary }) {
  return (
    <>
      <label>
        {t.auth.username}
        <input
          autoCapitalize="none"
          autoComplete="username"
          maxLength={40}
          minLength={3}
          name="username"
          pattern="[A-Za-z0-9._\-]{3,40}"
          required
          spellCheck={false}
        />
        <span className="field-hint">{t.auth.usernameHint}</span>
      </label>
      <NewPasswordFields t={t} />
    </>
  );
}

export function NewPasswordFields({ label, t }: { label?: string; t: Dictionary }) {
  return (
    <div className="form-grid">
      <label>
        {label ?? t.auth.password}
        <input
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          name="password"
          required
          type="password"
        />
        <span className="field-hint">{t.auth.passwordHint(MIN_PASSWORD_LENGTH)}</span>
      </label>
      <label>
        {t.auth.passwordConfirm}
        <input
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          name="passwordConfirm"
          required
          type="password"
        />
      </label>
    </div>
  );
}

import { setLanguage } from '@/app/(app)/shell/actions';
import type { Locale } from '@/lib/i18n';

/**
 * The language switch a signed-out visitor gets. It writes the same cookie the
 * signed-in switch writes; for someone with an account it also updates the
 * profile, so the two never disagree.
 */
export function LanguagePicker({ current }: { current: Locale }) {
  return (
    <form action={setLanguage} className="language-row language-row-compact">
      <button
        className={`language-option${current === 'ar' ? ' is-on' : ''}`}
        name="language"
        value="ar"
        type="submit"
        lang="ar"
      >
        عربي
      </button>
      <button
        className={`language-option${current === 'en' ? ' is-on' : ''}`}
        name="language"
        value="en"
        type="submit"
        lang="en"
      >
        EN
      </button>
    </form>
  );
}

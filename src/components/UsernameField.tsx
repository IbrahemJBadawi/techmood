'use client';

import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n.client';

const PATTERN = /^[a-z0-9_]{3,30}$/;

/**
 * The username at signup (onboarding step 1): lowercase letters, digits and _,
 * checked as it is typed — the database has the last word when it is saved.
 */
export function UsernameField({ current }: { current: string | null }) {
  const t = useT();
  const [value, setValue] = useState(current ?? '');
  const [checked, setChecked] = useState<{ name: string; free: boolean } | null>(null);
  const clean = value.trim().replace(/^@/, '').toLowerCase();
  const needsCheck = Boolean(clean) && PATTERN.test(clean) && clean !== current;

  // Only the answer is stored; what to show is worked out from it while rendering.
  useEffect(() => {
    if (!needsCheck) return;
    const timer = setTimeout(async () => {
      const { data } = await createClient().rpc('is_username_available', { p_username: clean });
      setChecked({ name: clean, free: data === true });
    }, 400);
    return () => clearTimeout(timer);
  }, [clean, needsCheck]);

  const status: 'idle' | 'checking' | 'free' | 'taken' | 'invalid' =
    !clean ? 'idle'
    : !PATTERN.test(clean) ? 'invalid'
    : clean === current ? 'free'
    : checked?.name !== clean ? 'checking'
    : checked.free ? 'free' : 'taken';

  const hint = {
    idle: t('حروف إنجليزية صغيرة وأرقام و_ فقط، من 3 إلى 30 خانة.', 'Lowercase letters, digits and _ only, 3 to 30 characters.'),
    checking: t('جارٍ التحقق…', 'Checking…'),
    free: t('✓ متاح', '✓ Available'),
    taken: t('محجوز — اختر غيره.', 'Taken — pick another.'),
    invalid: t('حروف إنجليزية صغيرة وأرقام و_ فقط، من 3 إلى 30 خانة.', 'Lowercase letters, digits and _ only, 3 to 30 characters.'),
  }[status];

  return (
    <div className="field">
      <label htmlFor="username">{t('اسم المستخدم', 'Username')}</label>
      <div className="username-field" dir="ltr">
        <span className="username-prefix">@</span>
        <input id="username" name="username" value={value} onChange={(event) => setValue(event.target.value)} required
               dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck={false}
               pattern="@?[a-zA-Z0-9_]{3,30}" placeholder="ibrahem" aria-describedby="username-hint" />
      </div>
      <small id="username-hint" className={`field-hint${status === 'taken' || status === 'invalid' ? ' is-error' : status === 'free' ? ' is-ok' : ''}`}
             aria-live="polite">{hint}</small>
    </div>
  );
}

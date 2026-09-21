import { cache } from 'react';
import { cookies } from 'next/headers';

import { isLocale, LOCALE_COOKIE, makeT, type Locale, type T } from '@/lib/i18n';

/**
 * The locale for this request.
 *
 * It is read from a cookie rather than from the profile on every render: the
 * cookie is written when the person signs in and whenever they change the
 * setting, so it is the same answer without a database round trip — and it is
 * also the only answer available to a signed-out visitor reading the landing
 * page. `profiles.language` remains the durable copy that follows the account
 * to a new device.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const jar = await cookies();
  const stored = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(stored) ? stored : 'ar';
});

export const getT = cache(async (): Promise<T> => makeT(await getLocale()));

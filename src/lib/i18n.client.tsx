'use client';

import { createContext, useContext, useMemo } from 'react';

import { makeT, type Locale, type T } from '@/lib/i18n';

const LocaleContext = createContext<Locale>('ar');

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** The same t(ar, en) a server component gets, for components that run in the browser. */
export function useT(): T {
  const locale = useLocale();
  return useMemo(() => makeT(locale), [locale]);
}

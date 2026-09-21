'use client';

import { useSyncExternalStore } from 'react';

import { useT } from '@/lib/i18n.client';
import type { Text } from '@/lib/i18n';

type Theme = 'light' | 'dark' | 'system';

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };

const LABEL: Record<Theme, Text> = {
  system: { ar: 'حسب النظام', en: 'Follow the system' },
  light:  { ar: 'الوضع الفاتح', en: 'Light' },
  dark:   { ar: 'الوضع الليلي', en: 'Dark' },
};

/**
 * The theme lives on <html data-theme>, written before first paint by the
 * bootstrap script in the root layout, so this component reads the DOM rather
 * than keeping a second copy of the truth in React state. The stylesheet falls
 * back to the operating system whenever the attribute is absent.
 */
let listeners: (() => void)[] = [];

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((entry) => entry !== listener);
  };
}

function readTheme(): Theme {
  const value = document.documentElement.getAttribute('data-theme');
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** The server cannot know the browser's stored choice; it renders the default. */
function serverTheme(): Theme {
  return 'system';
}

function apply(next: Theme) {
  const root = document.documentElement;
  if (next === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', next);

  try {
    if (next === 'system') localStorage.removeItem('tm-theme');
    else localStorage.setItem('tm-theme', next);
  } catch {
    // private mode or blocked storage — the attribute still holds for this page
  }

  listeners.forEach((listener) => listener());
}

export function ThemeToggle() {
  const t = useT();
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  return (
    <button
      type="button"
      className="icon-button"
      title={t(LABEL[theme])}
      aria-label={t(`المظهر: ${t(LABEL[theme])} — اضغط للتبديل`,
                    `Theme: ${t(LABEL[theme])} — press to change`)}
      onClick={() => apply(NEXT[theme])}
    >
      {theme === 'dark' ? <Moon /> : theme === 'light' ? <Sun /> : <Auto />}
    </button>
  );
}

const svg = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function Sun() {
  return (
    <svg {...svg}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}

function Moon() {
  return (
    <svg {...svg}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </svg>
  );
}

function Auto() {
  return (
    <svg {...svg}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
    </svg>
  );
}

'use client';

import { useEffect, useState } from 'react';

/**
 * «Saved» shown on the button itself (design lab 3: «علامة صح على الزر»):
 * true for a moment after a form action answers with `ok`, so the button can
 * turn green with a tick instead of a green box appearing under the form.
 *
 * A new answer is a new state object, so saving twice in a row flashes twice.
 */
export function useSavedFlash(state: { ok?: string } | undefined, ms = 2600) {
  const [seen, setSeen] = useState(state);
  const [done, setDone] = useState(false);
  if (state !== seen) {
    setSeen(state);
    setDone(Boolean(state?.ok));
  }
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => setDone(false), ms);
    return () => clearTimeout(timer);
  }, [done, ms]);
  return done;
}

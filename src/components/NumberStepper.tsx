'use client';

import { useRef, type InputHTMLAttributes } from 'react';

import { useT } from '@/lib/i18n.client';

/**
 * A number with − and + beside it (design lab 3: «أزرار − و +»), big enough
 * to tap, around an ordinary <input type=number> — so the form posts exactly
 * what it did before, min/max/step still apply, and typing still works.
 */
export function NumberStepper(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);

  function bump(up: boolean) {
    const node = input.current;
    if (!node || node.disabled || node.readOnly) return;
    if (node.value === '') node.value = String(node.min !== '' ? node.min : 0);
    else if (up) node.stepUp();
    else node.stepDown();
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return (
    <span className="num-stepper">
      <button type="button" className="num-step" onClick={() => bump(false)} disabled={props.disabled}
              aria-label={t('أنقص', 'Decrease')} tabIndex={-1}>−</button>
      <input ref={input} type="number" inputMode="decimal" {...props} />
      <button type="button" className="num-step" onClick={() => bump(true)} disabled={props.disabled}
              aria-label={t('زِد', 'Increase')} tabIndex={-1}>+</button>
    </span>
  );
}

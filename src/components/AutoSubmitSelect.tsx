'use client';

import { useState } from 'react';

/**
 * A select that saves itself: choosing an option submits its form. The
 * button beside it is kept for anybody without JavaScript and hidden for
 * everybody else, and a small tick says the choice went through.
 */
export function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  label,
  savedLabel,
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  label: string;
  savedLabel: string;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <>
      <select
        name={name}
        defaultValue={defaultValue}
        aria-label={label}
        onChange={(event) => {
          event.currentTarget.form?.requestSubmit();
          setSaved(true);
          window.setTimeout(() => setSaved(false), 1800);
        }}
      >
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
      <span className={`auto-saved${saved ? ' is-on' : ''}`} aria-live="polite">{saved ? `✓ ${savedLabel}` : ''}</span>
    </>
  );
}

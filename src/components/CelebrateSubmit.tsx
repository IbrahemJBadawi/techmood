'use client';

import type { ReactNode } from 'react';

import { celebrate } from '@/components/Confetti';

/** A submit button that throws the confetti as it sends — for finishing something, never for undoing it. */
export function CelebrateSubmit({ className, children, off = false }: { className?: string; children: ReactNode; off?: boolean }) {
  return (
    <button className={className} type="submit" onClick={() => { if (!off) celebrate(); }}>
      {children}
    </button>
  );
}

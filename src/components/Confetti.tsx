'use client';

import { useEffect, useState } from 'react';

/**
 * Coloured paper falling for a moment (design lab 3: «قصاصات ملوّنة») when
 * something real is finished: a quiz passed, a lesson done, a certificate
 * earned. Anything can call celebrate(); the host in the layout draws it.
 * People who asked their device for less motion get none.
 */
export function celebrate() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('tm-celebrate'));
}

const COLORS = ['#006BE0', '#F5B400', '#0E8A5B', '#C2255C', '#6D4AE8', '#0A7A99'];

export function ConfettiHost() {
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    const go = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      setBurst((n) => n + 1);
    };
    window.addEventListener('tm-celebrate', go);
    return () => window.removeEventListener('tm-celebrate', go);
  }, []);

  useEffect(() => {
    if (!burst) return;
    const timer = setTimeout(() => setBurst(0), 2600);
    return () => clearTimeout(timer);
  }, [burst]);

  if (!burst) return null;
  return (
    <div className="confetti" aria-hidden="true" key={burst}>
      {Array.from({ length: 70 }, (_, i) => (
        <i key={i} style={{
          left: `${(i * 37 + 11) % 100}%`,
          background: COLORS[i % COLORS.length],
          animationDelay: `${(i % 10) * 0.06}s`,
          animationDuration: `${1.6 + (i % 5) * 0.18}s`,
          ['--drift' as string]: `${((i * 53) % 120) - 60}px`,
          ['--spin' as string]: `${360 + (i % 4) * 180}deg`,
          width: i % 3 === 0 ? 6 : 8,
          height: i % 3 === 0 ? 12 : 8,
          borderRadius: i % 4 === 0 ? '50%' : 2,
        }} />
      ))}
    </div>
  );
}

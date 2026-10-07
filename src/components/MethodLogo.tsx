/**
 * A coloured tile for a payment method (design lab 4: «بطاقات مع شعارات»).
 * These are drawn marks in each provider's colour, not their trademarks; a
 * method the list does not know gets its own icon on the brand blue.
 */
const MARKS: Record<string, { bg: string; mark: string }> = {
  paypal:                 { bg: '#003087', mark: 'P' },
  jawwal_pay:             { bg: '#00A651', mark: 'J' },
  palpay:                 { bg: '#6D2077', mark: 'pal' },
  bank_of_palestine:      { bg: '#0B5E3B', mark: 'BoP' },
  international_transfer: { bg: '#1F3A5F', mark: '🌍' },
  wallet:                 { bg: '#0B1B2B', mark: '◎' },
};

export function MethodLogo({ methodKey, icon, size = 40 }: { methodKey: string; icon?: string | null; size?: number }) {
  const known = MARKS[methodKey] ?? (methodKey.includes('bank') ? { bg: '#14324F', mark: '🏦' } : null);
  const mark = known?.mark ?? icon ?? '💳';
  return (
    <span className="method-logo" aria-hidden
          style={{ width: size, height: size, background: known?.bg ?? 'var(--royal)', fontSize: mark.length > 2 ? size * 0.3 : size * 0.42 }}>
      {mark}
    </span>
  );
}

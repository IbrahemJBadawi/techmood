import { PremiumBadge } from '@/components/PremiumBadge';

/**
 * The blue ✓ next to a name (0161): an admin checked this person's identity.
 * Purely a label — it cannot be bought; Premium keeps its own ✦.
 */
export function VerifiedBadge({ label = 'حساب موثّق — Verified' }: { label?: string }) {
  return <span className="verified-badge" title={label} aria-label={label}>✓</span>;
}

/** Both marks a name can carry, in their fixed order. */
export function NameBadges({ verified, premium }: { verified?: boolean; premium?: boolean }) {
  if (!verified && !premium) return null;
  return (
    <span className="name-badges">
      {verified && <VerifiedBadge />}
      {premium && <PremiumBadge />}
    </span>
  );
}

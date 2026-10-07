/**
 * The TechMood Premium mark next to a name (0154): a small violet star that
 * says the member is verified and subscribed. Purely a label — what Premium
 * changes is enforced in the database.
 */
export function PremiumBadge({ label = 'TechMood Premium' }: { label?: string }) {
  return <span className="premium-badge" title={label} aria-label={label}>✦</span>;
}

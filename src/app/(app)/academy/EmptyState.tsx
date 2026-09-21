import Link from 'next/link';

/**
 * An empty section says what is missing and offers the one action that fills
 * it. It never renders a placeholder card pretending to be content.
 */
export function EmptyState({
  title,
  note,
  actionLabel,
  actionHref,
}: {
  title: string;
  note: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="panel empty-state">
      <h3 style={{ fontSize: '0.98rem' }}>{title}</h3>
      <p className="muted" style={{ fontSize: '0.88rem' }}>{note}</p>
      {actionLabel && actionHref && (
        <Link className="btn btn-primary btn-sm" href={actionHref}>{actionLabel}</Link>
      )}
    </div>
  );
}

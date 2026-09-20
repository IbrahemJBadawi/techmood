/**
 * Stars are the quality signal and are always rendered from an evaluation
 * average — never derived from XP, which measures activity instead.
 */
export function Stars({ value, max = 5 }: { value: number | null | undefined; max?: number }) {
  const filled = Math.max(0, Math.min(max, Math.round(value ?? 0)));

  return (
    <span aria-label={`${filled} من ${max} نجوم`} role="img">
      <span className="stars-filled" aria-hidden="true">{'★'.repeat(filled)}</span>
      <span className="stars-empty" aria-hidden="true">{'☆'.repeat(max - filled)}</span>
    </span>
  );
}

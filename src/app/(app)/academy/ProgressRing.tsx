/**
 * Progress as a ring, with the number inside it — the shape a learner reads
 * at a glance on a card, where a bar would need a label beside it.
 */
export function ProgressRing({
  percent,
  size = 52,
  stroke = 5,
  label,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  label: string;
}) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <span
      className={`progress-ring${value === 100 ? ' is-done' : ''}`}
      role="img"
      aria-label={`${label}: ${value}%`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="progress-ring-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="progress-ring-fill"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="progress-ring-value eng">{value}%</span>
    </span>
  );
}

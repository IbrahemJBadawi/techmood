/**
 * Small, server-rendered charts for the Control Center.
 *
 * One series per chart and one axis (small multiples, never a dual axis), in
 * the brand blue — validated against both surfaces. Columns are at most 24px,
 * rounded 4px at the data end and square at the baseline; the grid is a
 * hairline; only the latest and the highest value are labelled, the rest are
 * in the hover title and the table view. Text stays in text colours.
 */

type Point = { label: string; value: number };

const W = 320;
const H = 150;
const PAD = { top: 18, right: 8, bottom: 22, left: 8 };

/**
 * The axis ceiling: a round number (1, 2, 2.5 or 5 × a power of ten) with a
 * little room above the tallest bar, so the ceiling's own label never sits on
 * top of the bar's value (8 → 10, 31 → 50, 180 → 250); never below 5.
 */
function niceMax(max: number) {
  if (max <= 4) return 5;
  const power = 10 ** Math.floor(Math.log10(max));
  const target = max * 1.15;
  for (const k of [1, 2, 2.5, 5, 10]) if (k * power >= target) return k * power;
  return 10 * power;
}

/** A column path with a rounded top and a square base. */
function column(x: number, y: number, width: number, height: number) {
  const r = Math.min(4, width / 2, height);
  const base = y + height;
  return `M${x},${base} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${base} Z`;
}

export function ColumnChart({ title, data, tableLabel }: { title: string; data: Point[]; tableLabel: string }) {
  const max = niceMax(Math.max(0, ...data.map((point) => point.value)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / Math.max(data.length, 1);
  const barW = Math.min(24, band - 2);
  const peak = data.reduce((best, point, index) => (point.value > (data[best]?.value ?? -1) ? index : best), 0);
  const last = data.length - 1;

  return (
    <figure className="chart-card">
      <figcaption className="chart-title">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="chart-svg">
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} className="chart-axis" />
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top} y2={PAD.top} className="chart-grid" />
        <text x={W - PAD.right} y={PAD.top - 5} textAnchor="end" className="chart-tick">{max.toLocaleString('en')}</text>
        {data.map((point, index) => {
          const height = max ? (point.value / max) * innerH : 0;
          const x = PAD.left + index * band + (band - barW) / 2;
          const y = PAD.top + innerH - height;
          const labelled = point.value > 0 && (index === peak || index === last);
          return (
            <g key={point.label} className="chart-band">
              <rect x={PAD.left + index * band} y={PAD.top} width={band} height={innerH} className="chart-hit">
                <title>{`${point.label}: ${point.value.toLocaleString('en')}`}</title>
              </rect>
              {height > 0 && <path d={column(x, y, barW, height)} className="chart-mark" />}
              {labelled && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="chart-value">{point.value.toLocaleString('en')}</text>
              )}
              {(index === 0 || index === last) && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" className="chart-tick">{point.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      <details className="chart-table">
        <summary>{tableLabel}</summary>
        <table className="data">
          <tbody>
            {data.map((point) => (
              <tr key={point.label}><td>{point.label}</td><td className="eng">{point.value.toLocaleString('en')}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Horizontal bars for a ranked list; the value sits at the bar's tip. */
export function BarList({ rows }: { rows: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="bar-list">
      {rows.map((row) => (
        <li key={row.label} title={`${row.label}: ${row.value.toLocaleString('en')}${row.note ? ` — ${row.note}` : ''}`}>
          <span className="bar-list-label">{row.label}</span>
          <span className="bar-list-track">
            <span className="bar-list-bar" style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
            <span className="bar-list-value eng">{row.value.toLocaleString('en')}</span>
          </span>
          {row.note && <span className="muted bar-list-note">{row.note}</span>}
        </li>
      ))}
    </ul>
  );
}

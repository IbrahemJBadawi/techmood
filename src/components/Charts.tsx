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

/**
 * One number with its change against the period before (design lab 4: «KPI
 * مع نسبة التغيّر»). The change is a plain percentage; from zero it says «new»
 * rather than an infinite rise.
 */
export function KpiCard({ label, value, previous, period, newLabel }: {
  label: string; value: number; previous: number; period: string; newLabel: string;
}) {
  const change = previous === 0 ? (value === 0 ? 0 : null) : Math.round(((value - previous) / previous) * 100);
  const tone = change === null || change > 0 ? 'is-up' : change < 0 ? 'is-down' : 'is-flat';
  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value eng">{value.toLocaleString('en')}</strong>
      <span className={`kpi-change ${tone}`}>
        <span className={change === null ? 'kpi-delta' : 'kpi-delta eng'}>{change === null ? newLabel : `${change > 0 ? '▲' : change < 0 ? '▼' : '•'} ${Math.abs(change)}%`}</span>
        <span className="muted"> {period}</span>
      </span>
    </div>
  );
}

/** A single series over time as a line with a soft area under it; the latest and highest points are labelled. */
export function LineChart({ title, data, tableLabel }: { title: string; data: Point[]; tableLabel: string }) {
  const max = niceMax(Math.max(0, ...data.map((point) => point.value)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = innerW / Math.max(data.length - 1, 1);
  const at = (index: number, value: number) => [PAD.left + index * step, PAD.top + innerH - (max ? (value / max) * innerH : 0)] as const;
  const points = data.map((point, index) => at(index, point.value));
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const base = PAD.top + innerH;
  const area = points.length ? `${line} L${points[points.length - 1][0].toFixed(1)},${base} L${points[0][0].toFixed(1)},${base} Z` : '';
  const peak = data.reduce((best, point, index) => (point.value > (data[best]?.value ?? -1) ? index : best), 0);
  const last = data.length - 1;

  return (
    <figure className="chart-card">
      <figcaption className="chart-title">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="chart-svg">
        <line x1={PAD.left} x2={W - PAD.right} y1={base} y2={base} className="chart-axis" />
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top} y2={PAD.top} className="chart-grid" />
        <text x={W - PAD.right} y={PAD.top - 5} textAnchor="end" className="chart-tick">{max.toLocaleString('en')}</text>
        {area && <path d={area} className="chart-area" />}
        {line && <path d={line} className="chart-line" />}
        {data.map((point, index) => {
          const [x, y] = points[index];
          const labelled = index === peak || index === last;
          return (
            <g key={point.label}>
              <circle cx={x} cy={y} r={labelled ? 3.5 : 2} className="chart-dot">
                <title>{`${point.label}: ${point.value.toLocaleString('en')}`}</title>
              </circle>
              {labelled && point.value > 0 && (
                <text x={x} y={y - 7} textAnchor={index === last ? 'end' : 'middle'} className="chart-value">{point.value.toLocaleString('en')}</text>
              )}
              {(index === 0 || index === last) && (
                <text x={x} y={H - 6} textAnchor={index === 0 ? 'start' : 'end'} className="chart-tick">{point.label}</text>
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

/**
 * Steps that narrow (design lab 4: «قمع»): each bar is its share of the first
 * step, and under it the share of the step just above, where people drop off.
 */
export function Funnel({ steps, ofPrevious }: { steps: { label: string; value: number }[]; ofPrevious: string }) {
  const first = Math.max(1, steps[0]?.value ?? 0);
  return (
    <ol className="funnel">
      {steps.map((step, index) => {
        const share = Math.round((step.value / first) * 100);
        const prev = index > 0 ? steps[index - 1].value : 0;
        return (
          <li key={step.label}>
            <span className="funnel-bar" style={{ width: `${Math.max(8, share)}%` }}>
              <span className="eng">{step.value.toLocaleString('en')}</span>
            </span>
            <span className="funnel-label">
              {step.label}
              {index > 0 && <span className="muted"> · <span className="eng">{prev ? Math.round((step.value / prev) * 100) : 0}%</span> {ofPrevious}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

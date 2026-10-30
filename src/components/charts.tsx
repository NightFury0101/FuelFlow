import { useState } from 'react';
import { formatShort } from '../lib/date';

export function ProgressRing({ value, max, size = 168, stroke = 14, children, label }: { value: number; max: number; size?: number; stroke?: number; children?: React.ReactNode; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const over = max > 0 && value > max;
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'var(--warn)' : 'var(--accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bar" role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={Math.round(max)}>
      <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

interface Pt {
  date: string;
  value: number;
}

/** Weight line chart over real dates. X positions use actual day gaps, never evenly spaced entries. */
export function LineChart({ points, goal, unit, height = 200 }: { points: Pt[]; goal?: number; unit: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 340;
  const H = height;
  const pad = { l: 36, r: 12, t: 14, b: 26 };
  if (points.length === 0) return null;
  const times = points.map((p) => new Date(p.date + 'T12:00:00').getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const vals = points.map((p) => p.value).concat(goal != null ? [goal] : []);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const spread = Math.max(hi - lo, 1);
  lo -= spread * 0.15;
  hi += spread * 0.15;
  const x = (t: number) => (t1 === t0 ? (pad.l + W - pad.r) / 2 : pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(times[i]).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const ticks = [hi - (hi - lo) * 0.1, (hi + lo) / 2, lo + (hi - lo) * 0.1];
  const labelIdx = points.length <= 4 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const hp = hover != null ? points[hover] : null;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Weight chart with ${points.length} entries`}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 6} y={y(t) + 4} className="axis" textAnchor="end">
              {t.toFixed(spread < 5 ? 1 : 0)}
            </text>
          </g>
        ))}
        {goal != null && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={y(goal)} y2={y(goal)} className="goal-line" />
            <text x={W - pad.r} y={y(goal) - 5} className="axis goal-text" textAnchor="end">
              Goal
            </text>
          </g>
        )}
        <path d={path} className="line" />
        {points.map((p, i) => (
          <circle key={i} cx={x(times[i])} cy={y(p.value)} r={hover === i ? 5.5 : 3.5} className={'dot' + (i === points.length - 1 ? ' last' : '')} />
        ))}
        {labelIdx.map((i) => (
          <text key={i} x={x(times[i])} y={H - 6} className="axis" textAnchor={i === 0 && points.length > 1 ? 'start' : i === points.length - 1 && points.length > 1 ? 'end' : 'middle'}>
            {formatShort(points[i].date)}
          </text>
        ))}
        {points.map((p, i) => (
          <rect
            key={'h' + i}
            x={x(times[i]) - 14}
            y={0}
            width={28}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onTouchStart={() => setHover(i)}
          >
            <title>{`${formatShort(p.date)}: ${p.value} ${unit}`}</title>
          </rect>
        ))}
      </svg>
      {hp && (
        <div className="chart-tip">
          {formatShort(hp.date)} · <strong>{hp.value} {unit}</strong>
        </div>
      )}
    </div>
  );
}

/** Daily bar chart. Days without records are drawn as a faint dash so "not logged" never looks like zero. */
export function BarChart({ days, target, unit, color = 'var(--accent)', height = 170, weekly = false }: { days: Array<{ date: string; value: number | null }>; target?: number; unit: string; color?: string; height?: number; weekly?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 340;
  const H = height;
  const pad = { l: 8, r: 8, t: 12, b: 22 };
  const max = Math.max(target || 0, ...days.map((d) => d.value || 0), 1) * 1.1;
  const slot = (W - pad.l - pad.r) / days.length;
  const bw = Math.max(3, Math.min(22, slot * 0.62));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const every = days.length <= 7 ? 1 : days.length <= 14 ? 2 : Math.ceil(days.length / 6);
  const month = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short' });
  // Weekly view: label the first week of each month (every other month on a full year).
  const monthStarts = weekly ? days.map((d, i) => i === 0 || d.date.slice(0, 7) !== days[i - 1].date.slice(0, 7)) : [];
  const monthEvery = days.length > 26 ? 2 : 1;
  let monthCount = 0;
  const label = (d: { date: string }, i: number): string | null => {
    if (weekly) {
      if (!monthStarts[i]) return null;
      return monthCount++ % monthEvery === 0 ? month(d.date) : null;
    }
    if (i % every !== 0) return null;
    return days.length <= 7 ? new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' }) : (formatShort(d.date).split(' ')[1] ?? '');
  };
  const tipDate = (d: string) => (weekly ? `Week of ${formatShort(d)}` : formatShort(d));
  const tipValue = (v: number | null) => (v == null ? 'Not logged' : `${weekly ? 'avg ' : ''}${Math.round(v).toLocaleString()} ${unit}`);
  const hd = hover != null ? days[hover] : null;
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Bar chart of ${days.length} ${weekly ? 'weeks' : 'days'}`}>
        {target != null && target > 0 && <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} className="goal-line" />}
        {days.map((d, i) => {
          const cx = pad.l + slot * i + slot / 2;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}>
              <rect x={cx - slot / 2} y={0} width={slot} height={H} fill="transparent" />
              {d.value == null ? (
                <line x1={cx - bw / 2} x2={cx + bw / 2} y1={y(0) - 1} y2={y(0) - 1} className="missing" />
              ) : (
                <rect x={cx - bw / 2} y={y(d.value)} width={bw} height={Math.max(2, y(0) - y(d.value))} rx={Math.min(5, bw / 2)} fill={color} opacity={hover === i ? 1 : 0.85} />
              )}
              {(() => {
                const t = label(d, i);
                return t ? (
                  <text x={cx} y={H - 6} className="axis" textAnchor={weekly ? 'start' : 'middle'}>
                    {t}
                  </text>
                ) : null;
              })()}
              <title>{`${tipDate(d.date)}: ${tipValue(d.value)}`}</title>
            </g>
          );
        })}
      </svg>
      {hd && (
        <div className="chart-tip">
          {tipDate(hd.date)} · <strong>{tipValue(hd.value)}</strong>
        </div>
      )}
    </div>
  );
}

// Draws the trainer report as a 1080×1350 PNG (fits WhatsApp, Viber, Instagram and email).
import type { UnitPrefs } from './types';
import { dateRange, signed, type ProgressReport } from './report';
import { displayWater, weightValue } from './units';

export const REPORT_W = 1080;
export const REPORT_H = 1350;

const C = {
  bg: '#0b0d0c',
  card: '#141716',
  line: '#262b28',
  track: '#252a27',
  text: '#f3f5f4',
  muted: '#8d9590',
  lime: '#c5f432',
  protein: '#ff8a65',
  water: '#4fb7ff',
};
const DISPLAY = '"Sora", "Inter Display", Inter, system-ui, sans-serif';
const BODY = 'Inter, system-ui, sans-serif';

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left', maxW?: number) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  let t = s;
  if (maxW) while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -2) + '…';
  ctx.fillText(t, x, y);
  return ctx.measureText(t).width;
}

function logo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.36;
  ctx.lineCap = 'round';
  ctx.lineWidth = size * 0.12;
  ctx.strokeStyle = C.track;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = C.lime;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.5);
  ctx.stroke();
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, color: string) {
  rr(ctx, x, y, w, 10, 5);
  ctx.fillStyle = C.track;
  ctx.fill();
  const f = Math.max(0, Math.min(1, frac));
  if (f > 0) {
    rr(ctx, x, y, Math.max(10, w * f), 10, 5);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function weightChart(ctx: CanvasRenderingContext2D, r: ProgressReport, x: number, y: number, w: number, h: number) {
  const pts = r.weights;
  if (pts.length < 2) return;
  const t0 = Date.parse(pts[0].date);
  const t1 = Date.parse(pts[pts.length - 1].date);
  const span = Math.max(1, t1 - t0);
  const vals = pts.map((p) => p.kg);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 1) {
    lo -= 0.5;
    hi += 0.5;
  }
  const px = (d: string) => x + ((Date.parse(d) - t0) / span) * w;
  const py = (kg: number) => y + h - ((kg - lo) / (hi - lo)) * h;
  // Soft fill under the line.
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, 'rgba(197,244,50,0.22)');
  grad.addColorStop(1, 'rgba(197,244,50,0)');
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(px(p.date), py(p.kg)) : ctx.moveTo(px(p.date), py(p.kg))));
  ctx.lineTo(px(pts[pts.length - 1].date), y + h);
  ctx.lineTo(px(pts[0].date), y + h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(px(p.date), py(p.kg)) : ctx.moveTo(px(p.date), py(p.kg))));
  ctx.strokeStyle = C.lime;
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(px(last.date), py(last.kg), 9, 0, Math.PI * 2);
  ctx.fillStyle = C.lime;
  ctx.fill();
}

export async function drawReport(r: ProgressReport, units: UnitPrefs): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load(`700 40px Sora`), document.fonts.load(`600 40px Sora`), document.fonts.load(`500 30px Inter`), document.fonts.load(`600 30px Inter`)]);
  } catch {
    /* system fonts are fine */
  }
  const cv = document.createElement('canvas');
  cv.width = REPORT_W;
  cv.height = REPORT_H;
  const ctx = cv.getContext('2d')!;
  const W = REPORT_W;
  const M = 64;

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, REPORT_H);
  const glow = ctx.createRadialGradient(W * 0.85, 120, 0, W * 0.85, 120, 620);
  glow.addColorStop(0, 'rgba(197,244,50,0.12)');
  glow.addColorStop(1, 'rgba(197,244,50,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, REPORT_H);

  // Header
  logo(ctx, M, 58, 56);
  text(ctx, 'FuelFlow', M + 72, 98, `700 36px ${DISPLAY}`, C.text);
  text(ctx, 'PROGRESS REPORT', W - M, 96, `600 22px ${BODY}`, C.muted, 'right');
  text(ctx, r.name, M, 196, `700 56px ${DISPLAY}`, C.text, 'left', W - 2 * M);
  text(ctx, `${dateRange(r)} · last ${r.days} days`, M, 246, `500 28px ${BODY}`, C.muted);

  // Weight card
  const wy = 290;
  rr(ctx, M, wy, W - 2 * M, 360, 36);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, 'Weight', M + 40, wy + 64, `600 30px ${DISPLAY}`, C.text);
  const wt = (kg: number) => `${weightValue(kg, units)} ${units.weight}`;
  if (r.endKg == null) {
    text(ctx, 'No weigh-ins in this period', M + 40, wy + 140, `500 30px ${BODY}`, C.muted);
  } else {
    const good = r.changeKg != null && ((r.goal === 'lose' && r.changeKg < 0) || (r.goal === 'gain' && r.changeKg > 0));
    const big = r.changeKg != null ? signed(weightValue(r.changeKg, units), units.weight) : wt(r.endKg);
    text(ctx, big, M + 40, wy + 150, `700 76px ${DISPLAY}`, good ? C.lime : C.text);
    const sub = r.changeKg != null ? `${wt(r.startKg!)} → ${wt(r.endKg)}` : 'Latest weigh-in';
    text(ctx, sub, M + 40, wy + 196, `500 28px ${BODY}`, C.muted);
    if (r.goalKg != null && r.goal !== 'maintain') {
      const left = Math.abs(r.goalKg - r.endKg);
      text(ctx, `Goal ${wt(r.goalKg)}`, W - M - 40, wy + 110, `600 28px ${BODY}`, C.text, 'right');
      text(ctx, left < 0.05 ? 'Reached' : `${weightValue(left, units)} ${units.weight} to go`, W - M - 40, wy + 150, `500 26px ${BODY}`, C.muted, 'right');
    }
    weightChart(ctx, r, M + 48, wy + 226, W - 2 * M - 96, 104);
  }

  // Tiles
  const ty = wy + 390;
  const gap = 24;
  const tw = (W - 2 * M - gap) / 2;
  const th = 220;
  const tile = (col: number, row: number, label: string, value: string, unit: string, foot: string, frac: number | null, color: string) => {
    const x = M + col * (tw + gap);
    const y = ty + row * (th + gap);
    rr(ctx, x, y, tw, th, 32);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, label, x + 32, y + 48, `600 24px ${BODY}`, C.muted);
    const vw = text(ctx, value, x + 32, y + 112, `700 58px ${DISPLAY}`, C.text);
    text(ctx, unit, x + 32 + vw + 10, y + 112, `500 24px ${BODY}`, C.muted, 'left', tw - vw - 70);
    if (frac != null) bar(ctx, x + 32, y + 136, tw - 64, frac, color);
    text(ctx, foot, x + 32, y + 190, `500 24px ${BODY}`, C.text, 'left', tw - 64);
  };
  const n = (v: number) => Math.round(v).toLocaleString('en-US');
  tile(0, 0, 'CALORIES', r.avgKcal == null ? '—' : n(r.avgKcal), 'kcal/day', r.avgKcal == null ? 'No food logged' : `Target ${n(r.kcalTarget)} · on target ${r.onTargetDays}/${r.loggedDays} days`, r.avgKcal == null ? null : r.avgKcal / r.kcalTarget, C.lime);
  tile(1, 0, 'PROTEIN', r.avgProtein == null ? '—' : String(r.avgProtein), 'g/day', r.avgProtein == null ? 'No food logged' : `Target ${r.proteinTarget} g · reached ${r.proteinHitDays} days`, r.avgProtein == null ? null : r.avgProtein / r.proteinTarget, C.protein);
  tile(0, 1, 'CONSISTENCY', `${r.loggedDays}/${r.days}`, 'days logged', `Current streak ${r.streak} day${r.streak === 1 ? '' : 's'}`, r.loggedDays / r.days, C.lime);
  tile(1, 1, 'WATER', r.avgWaterMl == null ? '—' : displayWater(r.avgWaterMl, units), 'per day', r.avgWaterMl == null ? 'No water logged' : `Goal ${displayWater(r.waterTargetMl, units)}`, r.avgWaterMl == null ? null : r.avgWaterMl / r.waterTargetMl, C.water);

  // Measurements (up to 3)
  const my = ty + 2 * th + gap + 64;
  const ms = r.measures.slice(0, 3);
  if (ms.length) {
    const colW = (W - 2 * M) / ms.length;
    ms.forEach((m, i) => {
      const x = M + i * colW;
      text(ctx, m.label.toUpperCase(), x, my, `600 22px ${BODY}`, C.muted);
      const v = m.from == null ? `${m.to} ${m.unit}` : `${m.from} → ${m.to} ${m.unit}`;
      text(ctx, v, x, my + 40, `600 30px ${DISPLAY}`, C.text, 'left', colW - 20);
    });
  }

  text(ctx, 'From my own FuelFlow logs — estimates, not medical advice.', W / 2, REPORT_H - 40, `500 22px ${BODY}`, C.muted, 'center');
  return cv;
}

export function canvasToBlob(cv: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('Couldn’t create the image'))), 'image/png'));
}

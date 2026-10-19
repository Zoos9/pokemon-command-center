// "Where's the bottom?" — price curve since release, predicted bottom band, meter, trend phase.
// Every piece degrades on its own: missing fields hide that piece or say "not enough data". No invented numbers.
import { money, esc } from "./util.js";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ym = (d) => { const m = /^(\d{4})-(\d{2})/.exec(d || ""); return m ? `${MON[+m[2] - 1]} ${m[1]}` : esc(d || ""); };
export const fmtWindow = (start, end, text) => { if (!start && text && text.includes("/")) [start, end] = text.split("/"); return start ? `${ym(start)} – ${ym(end)}` : text ? esc(text) : null; };

const PH = { "falling fast": ["#ff4d6d", "⇊"], falling: ["#ff7a45", "↓"], slowing: ["#ff9f1c", "↘"], flat: ["#c9b458", "→"], bottoming: ["#ffcb05", "◡"], rising: ["#2ee6a6", "↗"] };
const phKey = (p) => (p ? String(p).toLowerCase() : null);

export function bottomModel(c) {
  const t = c.trendData || {};
  const official = Array.isArray(t.daily) && t.daily.length ? t.daily.map((d) => (Array.isArray(d) ? [d[0], +d[1]] : [d.date, d.median == null ? null : +d.median, d.roll3_median != null ? +d.roll3_median : null, d.n])).filter((d) => d[0]) : null;
  const series = official || c.daily, seriesSrc = official ? "official" : "derived";
  const zl = c.sug.low, zh = c.sug.high, hasZone = zl != null && zh != null;
  const cur = t.fair_now ?? c.med7, curLbl = t.fair_now != null ? "fair now" : "7d sold median";
  let meter = null;
  if (hasZone && cur != null) meter = cur > zh ? { state: "above", pct: (cur / zh - 1) * 100 } : cur >= zl ? { state: "in" } : { state: "below", pct: (1 - cur / zl) * 100 };
  return { series, seriesSrc, zl, zh, hasZone, cur, curLbl, meter, phase: phKey(t.phase), slope: t.slope, offPeak: t.off_peak, accel: t.accel, lineToday: t.line_today, peak: t.peak, peakDate: t.peak_date, twin: t.win, tn: t.n,
    window: c.sug.window, reason: c.sug.reason, conf: c.sug.conf, best: c.lowest?.total ?? null, research: c.sug.phase, zLbl: c.sug.kind === "predicted_bottom" || c.sug.window || c.sug.reason ? "predicted bottom" : "research buy zone",
    centre: c.sug.centre ?? (c.sug.low != null && c.sug.high != null ? (c.sug.low + c.sug.high) / 2 : null), knife: c.sug.knife, wStart: c.sug.wStart, wEnd: c.sug.wEnd, wText: c.sug.wText, category: c.sug.category,
    trimmedN: t.trimmedN, peakN: t.peak_n, outliers: t.outliers, s7med: t.s7med, s7n: t.s7n };
}


export function meterHtml(m, mini = false) {
  if (!m.meter) return mini ? "" : `<div class="bm none">Bottom meter: ${m.hasZone ? "no current price yet" : "no research zone yet"}</div>`;
  const s = m.meter.state, txt = s === "in" ? "in the zone" : s === "below" ? `below zone (−${m.meter.pct.toFixed(0)}%)` : `${m.meter.pct.toFixed(0)}% away`;
  const fill = s === "above" ? Math.max(6, 100 - Math.min(94, m.meter.pct * 2)) : 100;
  return `<div class="bm ${s}${mini ? " mini" : ""}"><div class="bmbar"><i style="width:${fill}%"></i><b class="bmz" title="predicted bottom ${money(m.zl)}–${money(m.zh)}"></b></div><div class="bmt"><b>${txt}</b>${mini ? "" : ` <small>${m.curLbl} ${money(m.cur)} → ${m.zLbl === "predicted bottom" ? "bottom" : "buy zone"} ${money(m.zl)}–${money(m.zh)}${m.centre != null ? ` (mid ${money(m.centre)})` : ""}</small>`}</div></div>`;
}

export function phaseChip(m) {
  if (m.phase) { const [col, ic] = PH[m.phase] || ["#888", "•"]; return `<span class="bph" style="--pc:${col}">${ic} ${esc(m.phase)}</span>`; }
  return m.research && m.research !== "no" ? `<span class="bph res" title="Researcher's phase call; trend phase not available yet">research: ${esc(m.research)}</span>` : "";
}

export function bottomSection(c, small) {
  const m = bottomModel(c);
  const pct = (v, unit = "%") => (v == null || !isFinite(+v) ? "n/a" : `${+v > 0 ? "+" : ""}${(+v).toFixed(+v && Math.abs(+v) < 1 ? 2 : 1)}${unit}`);
  const big = m.phase ? (() => { const [col, ic] = PH[m.phase] || ["#888", "•"]; return `<div class="bbig" style="--pc:${col}">${ic} ${esc(m.phase.toUpperCase())}</div>`; })()
    : `<div class="bbig na">No trend yet${m.research ? ` <small>· researcher's call: ${esc(m.research)}</small>` : ""}</div>`;
  const stats = m.slope != null || m.offPeak != null || m.accel != null ? `<div class="bstats"><span>slope <b>${pct(m.slope, "%/day")}</b></span><span>off peak <b>${pct(m.offPeak)}</b></span><span>accel <b>${pct(m.accel, "%/day²")}</b></span>${m.peak != null ? `<span>peak <b>$${(+m.peak).toFixed(2)}</b>${m.peakDate ? " " + esc(String(m.peakDate).slice(5)) : ""}</span>` : ""}${m.twin ? `<span>${m.twin}d window${m.tn ? `, n=${m.tn}` : ""}</span>` : ""}${m.peakN ? `<span>peak from n=${m.peakN}</span>` : ""}${m.s7med != null ? `<span>7d sold <b>${money(m.s7med)}</b>${m.s7n ? ` n=${m.s7n}` : ""}</span>` : ""}${m.outliers ? `<span>${m.outliers} outlier${m.outliers > 1 ? "s" : ""} trimmed</span>` : ""}</div>` : "";
  const win = fmtWindow(m.wStart, m.wEnd, m.wText || m.window);
  const knife = m.knife ? `<div class="knife">🔪 FALLING KNIFE <small>researcher: don't catch it yet</small></div>` : "";
  const cap = m.hasZone ? `<p class="bcap">${m.zLbl === "predicted bottom" ? "Predicted bottom" : "Researcher's buy zone"} <b>${money(m.zl)}–${money(m.zh)}</b>${m.centre != null ? ` (centre ${money(m.centre)})` : ""}${win ? ` · expected <b>${win}</b>` : ""}${m.conf ? ` · ${esc(m.conf)} confidence` : ""}${m.reason ? ` — ${esc(m.reason)}` : ""} <small>(Market Researcher${m.zLbl === "predicted bottom" ? "" : "; bottom window/reason not published yet"})</small></p>` : "";
  return `<section class="panel bottom"><h2>🕳️ Where's the bottom?</h2>${big}${knife}${stats}${meterHtml(m)}${curve(m, small)}${cap}</section>`;
}

function curve(m, small) {
  const pts = m.series || [];
  if (pts.filter((p) => p[1] != null || p[2] != null).length < 3) return `<div class="bm none">Price curve: not enough daily data yet (${pts.length} day${pts.length === 1 ? "" : "s"})</div>`;
  const W = small ? 400 : 820, H = small ? 230 : 280, L = 44, R = 14, T = 12, B = 26;
  const vals = pts.map((p) => p[1]).concat([m.zl, m.zh, m.best].filter((v) => v != null));
  if (m.lineToday != null) vals.push(m.lineToday);
  const srt = pts.map((p) => p[1]).filter((v) => v != null).sort((x, y) => x - y), p90 = srt[Math.min(srt.length - 1, Math.floor(srt.length * 0.9))];
  const must = [m.zl, m.zh, m.best, m.lineToday, ...pts.map((p) => p[2])].filter((v) => v != null), top = Math.max(p90 * 1.3, ...must);
  const off = pts.filter((p) => p[1] != null && p[1] > top);
  let lo = Math.min(...srt, ...must) * 0.9, hi = Math.max(...srt.filter((v) => v <= top), ...must) * 1.08;
  const wS = m.wStart ? Date.parse(m.wStart) : null, wE = m.wEnd ? Date.parse(m.wEnd) : null, nowT = Date.parse(new Date().toISOString().slice(0, 10)), winOn = wS && wE && wS - nowT <= 120 * 864e5;
  const t0 = Date.parse(pts[0][0]), tToday = Math.max(Date.parse(pts.at(-1)[0]), Date.parse(new Date().toISOString().slice(0, 10))), tN = winOn ? Math.max(tToday, wE) : tToday, sp = Math.max(tN - t0, 864e5); const XD = (d) => L + ((Date.parse(d) - t0) / sp) * (W - L - R), X = (i) => XD(pts[i][0]), today = new Date(tToday).toISOString().slice(0, 10), Y = (v) => H - B - ((Math.min(v, hi) - lo) / (hi - lo)) * (H - B - T);
  let s = "";
  for (let k = 0; k <= 4; k++) { const v = lo + ((hi - lo) * k) / 4; s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${L - 5}" y="${Y(v) + 4}" text-anchor="end" class="ax">${money(v)}</text>`; }
  if (m.hasZone) s += `<rect x="${L}" y="${Y(m.zh)}" width="${W - L - R}" height="${Math.max(3, Y(m.zl) - Y(m.zh))}" class="bband"/><text x="${L + 6}" y="${Y(m.zl) - 5}" class="bbandl">${m.zLbl.toUpperCase()}</text>`;
  if (m.hasZone && m.centre != null) s += `<line class="bcentre" x1="${L}" x2="${W - R}" y1="${Y(m.centre)}" y2="${Y(m.centre)}"/>`;
  if (winOn) s += `<rect class="bwin" x="${XD(m.wStart)}" y="${T}" width="${Math.max(3, XD(m.wEnd) - XD(m.wStart))}" height="${H - B - T}"/><text class="bwinl" x="${XD(m.wStart) + 4}" y="${T + 12}">expected bottom</text>`;
  { let seg = [], segs = []; pts.forEach((p, i) => { if (p[1] == null) { if (seg.length) segs.push(seg); seg = []; } else seg.push(`${X(i).toFixed(1)},${Y(p[1]).toFixed(1)}`); }); if (seg.length) segs.push(seg);
    segs.forEach((g) => (s += g.length > 1 ? `<polyline class="bcurve" points="${g.join(" ")}"/>` : `<circle class="bcdot" cx="${g[0].split(",")[0]}" cy="${g[0].split(",")[1]}" r="3.5"/>`)); }
  if (m.seriesSrc === "official") pts.forEach((p, i) => { if (p[1] != null) s += `<circle class="bcdot" data-v="${p[1]}" cx="${X(i).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3"><title>${esc(p[0])} · median ${money(p[1])} (n=${p[3] ?? "?"})</title></circle>`; });
  const r3 = pts.map((p, i) => [i, p[2]]).filter((q) => q[1] != null && isFinite(q[1]));
  if (r3.length > 1) s += `<polyline class="broll" points="${r3.map(([i, v]) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}"/>`;
  off.forEach((p) => { const i = pts.indexOf(p), x = X(i); s += `<path class="boff" d="M${x - 6},${T + 9} L${x},${T + 1} L${x + 6},${T + 9} Z"/><text class="boffl" x="${x}" y="${T + 21}" text-anchor="middle">↑ ${money(p[1])}</text>`; });
  const official = m.lineToday != null && m.slope != null;
  if (official) { // Alert Desk trend: value today = trend_line_today, back over trend_window_days at slope %/day
    const days = Math.min(m.twin || 14, Math.round((tToday - t0) / 864e5)), d0 = new Date(tToday - days * 864e5).toISOString().slice(0, 10);
    const v0 = m.lineToday / Math.pow(1 + m.slope / 100, days);
    s += `<line class="btrend" x1="${XD(d0)}" y1="${Y(Math.max(lo, Math.min(hi, v0)))}" x2="${XD(today)}" y2="${Y(m.lineToday)}"/>`;
  }
  if (m.best != null) s += `<circle class="bbest" cx="${XD(today)}" cy="${Y(m.best)}" r="7"><title>best listing today ${money(m.best)}</title></circle><text x="${XD(today) - 10}" y="${Y(m.best) + (Y(m.best) > H - B - 20 ? -12 : 18)}" text-anchor="end" class="bbestl">best listing ${money(m.best)}</text>`;
  [0, Math.floor((pts.length - 1) / 2), pts.length - 1].forEach((i) => (s += `<text x="${X(i)}" y="${H - 7}" text-anchor="middle" class="ax">${esc(String(pts[i][0]).slice(5))}</text>`));

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Price curve since release">${s}</svg>
  <div class="legend">${wS && !winOn ? `<span class="bwinl2">→ expected bottom ${fmtWindow(m.wStart, m.wEnd)} (off chart, future)</span>` : ""}${off.length ? `<span>↑ ${off.length} spike day${off.length > 1 ? "s" : ""} clipped at the top</span>` : ""}<span><i class="lg-bc"></i>${m.seriesSrc === "official" ? `daily sold median (outliers trimmed${pts.some((p) => p[1] == null) ? "; gaps = all sales trimmed" : ""})` : `daily median of sold comps (outliers trimmed${m.trimmedN ? `: ${m.trimmedN} dropped` : ""}; ${pts.length} days, derived here)`}</span><span><i class="lg-bt"></i>${m.lineToday != null && m.slope != null ? `Alert Desk trend (${m.twin || 14}d, ${m.slope > 0 ? "+" : ""}${(+m.slope).toFixed(1)}%/day)` : "no official trend line yet"}</span>${pts.some((p) => p[2] != null) ? `<span><i class="lg-br"></i>3-day rolling median</span>` : ""}${m.hasZone ? `<span><i class="lg-bb"></i>${m.zLbl}${m.centre != null ? " (dashed = centre)" : ""}</span>` : ""}${m.best != null ? `<span><i class="lg-bd"></i>best listing today (item+ship)</span>` : ""}</div>`;
}

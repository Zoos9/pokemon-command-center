// "Where's the bottom?" — price curve since release, predicted bottom band, meter, trend phase.
// Every piece degrades on its own: missing fields hide that piece or say "not enough data". No invented numbers.
import { money, esc } from "./util.js";

const PH = { "falling fast": ["#ff4d6d", "⇊"], falling: ["#ff7a45", "↓"], slowing: ["#ff9f1c", "↘"], flat: ["#c9b458", "→"], bottoming: ["#ffcb05", "◡"], rising: ["#2ee6a6", "↗"] };
const phKey = (p) => (p ? String(p).toLowerCase() : null);

export function bottomModel(c) {
  const t = c.trendData || {};
  const official = Array.isArray(t.daily) && t.daily.length ? t.daily.map((d) => (Array.isArray(d) ? [d[0], +d[1]] : [d.date, +(d.median ?? d.median_usd ?? d.price)])).filter((d) => d[0] && isFinite(d[1])) : null;
  const series = official || c.daily, seriesSrc = official ? "official" : "derived";
  const zl = c.sug.low, zh = c.sug.high, hasZone = zl != null && zh != null;
  const cur = t.fair_now ?? c.med7, curLbl = t.fair_now != null ? "fair now" : "7d sold median";
  let meter = null;
  if (hasZone && cur != null) meter = cur > zh ? { state: "above", pct: (cur / zh - 1) * 100 } : cur >= zl ? { state: "in" } : { state: "below", pct: (1 - cur / zl) * 100 };
  return { series, seriesSrc, zl, zh, hasZone, cur, curLbl, meter, phase: phKey(t.phase), slope: t.slope, offPeak: t.off_peak, accel: t.accel, lineToday: t.line_today, peak: t.peak, peakDate: t.peak_date, twin: t.win, tn: t.n,
    window: c.sug.window, reason: c.sug.reason, conf: c.sug.conf, best: c.lowest?.total ?? null, research: c.sug.phase, zLbl: c.sug.window || c.sug.reason ? "predicted bottom" : "research buy zone" };
}

function fit(pts) { // least squares on [i, price]; dashboard-fitted, labelled as such
  const n = pts.length, xs = pts.map((_, i) => i), ys = pts.map((p) => p[1]);
  const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  const b = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / (xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1);
  return [my - b * mx, b];
}

export function meterHtml(m, mini = false) {
  if (!m.meter) return mini ? "" : `<div class="bm none">Bottom meter: ${m.hasZone ? "no current price yet" : "no research zone yet"}</div>`;
  const s = m.meter.state, txt = s === "in" ? "in the zone" : s === "below" ? `below zone (−${m.meter.pct.toFixed(0)}%)` : `${m.meter.pct.toFixed(0)}% away`;
  const fill = s === "above" ? Math.max(6, 100 - Math.min(94, m.meter.pct * 2)) : 100;
  return `<div class="bm ${s}${mini ? " mini" : ""}"><div class="bmbar"><i style="width:${fill}%"></i><b class="bmz" title="predicted bottom ${money(m.zl)}–${money(m.zh)}"></b></div><div class="bmt"><b>${txt}</b>${mini ? "" : ` <small>${m.curLbl} ${money(m.cur)} → ${m.zLbl === "predicted bottom" ? "bottom" : "buy zone"} ${money(m.zl)}–${money(m.zh)}</small>`}</div></div>`;
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
  const stats = m.slope != null || m.offPeak != null || m.accel != null ? `<div class="bstats"><span>slope <b>${pct(m.slope, "%/day")}</b></span><span>off peak <b>${pct(m.offPeak)}</b></span><span>accel <b>${pct(m.accel, "%/day²")}</b></span>${m.peak != null ? `<span>peak <b>${money(m.peak)}</b>${m.peakDate ? " " + esc(String(m.peakDate).slice(5)) : ""}</span>` : ""}${m.twin ? `<span>${m.twin}d window${m.tn ? `, n=${m.tn}` : ""}</span>` : ""}</div>` : "";
  const cap = m.hasZone ? `<p class="bcap">${m.zLbl === "predicted bottom" ? "Predicted bottom" : "Researcher's buy zone"} <b>${money(m.zl)}–${money(m.zh)}</b>${m.window ? ` · ${esc(m.window)}` : ""}${m.conf ? ` · ${esc(m.conf)} confidence` : ""}${m.reason ? ` — ${esc(m.reason)}` : ""} <small>(Market Researcher${m.zLbl === "predicted bottom" ? "" : "; bottom window/reason not published yet"})</small></p>` : "";
  return `<section class="panel bottom"><h2>🕳️ Where's the bottom?</h2>${big}${stats}${meterHtml(m)}${curve(m, small)}${cap}</section>`;
}

function curve(m, small) {
  const pts = m.series || [];
  if (pts.length < 3) return `<div class="bm none">Price curve: not enough daily data yet (${pts.length} day${pts.length === 1 ? "" : "s"})</div>`;
  const W = small ? 400 : 820, H = small ? 230 : 280, L = 44, R = 14, T = 12, B = 26;
  const vals = pts.map((p) => p[1]).concat([m.zl, m.zh, m.best].filter((v) => v != null));
  if (m.lineToday != null) vals.push(m.lineToday); let lo = Math.min(...vals) * 0.9, hi = Math.max(...vals) * 1.06;
  const t0 = Date.parse(pts[0][0]), tN = Math.max(Date.parse(pts.at(-1)[0]), Date.parse(new Date().toISOString().slice(0, 10))), sp = Math.max(tN - t0, 864e5); const XD = (d) => L + ((Date.parse(d) - t0) / sp) * (W - L - R), X = (i) => XD(pts[i][0]), today = new Date(tN).toISOString().slice(0, 10), Y = (v) => H - B - ((v - lo) / (hi - lo)) * (H - B - T);
  const [a, b] = fit(pts);
  let s = "";
  for (let k = 0; k <= 4; k++) { const v = lo + ((hi - lo) * k) / 4; s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${L - 5}" y="${Y(v) + 4}" text-anchor="end" class="ax">${money(v)}</text>`; }
  if (m.hasZone) s += `<rect x="${L}" y="${Y(m.zh)}" width="${W - L - R}" height="${Math.max(3, Y(m.zl) - Y(m.zh))}" class="bband"/><text x="${L + 6}" y="${Y(m.zl) - 5}" class="bbandl">${m.zLbl.toUpperCase()}</text>`;
  s += `<polyline class="bcurve" points="${pts.map((p, i) => `${X(i).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ")}"/>`;
  const official = m.lineToday != null && m.slope != null;
  if (official) { // Alert Desk trend: value today = trend_line_today, back over trend_window_days at slope %/day
    const days = Math.min(m.twin || 14, Math.round((tN - t0) / 864e5)), d0 = new Date(tN - days * 864e5).toISOString().slice(0, 10);
    const v0 = m.lineToday / Math.pow(1 + m.slope / 100, days);
    s += `<line class="btrend" x1="${XD(d0)}" y1="${Y(Math.max(lo, Math.min(hi, v0)))}" x2="${XD(today)}" y2="${Y(m.lineToday)}"/>`;
  } else s += `<line class="btrend" x1="${X(0)}" y1="${Y(a)}" x2="${X(pts.length - 1)}" y2="${Y(a + b * (pts.length - 1))}"/>`;
  if (m.best != null) s += `<circle class="bbest" cx="${XD(today)}" cy="${Y(m.best)}" r="7"><title>best listing today ${money(m.best)}</title></circle><text x="${XD(today) - 10}" y="${Y(m.best) + (Y(m.best) > H - B - 20 ? -12 : 18)}" text-anchor="end" class="bbestl">best listing ${money(m.best)}</text>`;
  [0, Math.floor((pts.length - 1) / 2), pts.length - 1].forEach((i) => (s += `<text x="${X(i)}" y="${H - 7}" text-anchor="middle" class="ax">${esc(String(pts[i][0]).slice(5))}</text>`));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Price curve since release">${s}</svg>
  <div class="legend"><span><i class="lg-bc"></i>${m.seriesSrc === "official" ? "daily sold median since release" : `daily median of our sold comps (${pts.length} days, derived here)`}</span><span><i class="lg-bt"></i>${m.lineToday != null && m.slope != null ? `Alert Desk trend (${m.twin || 14}d, ${m.slope > 0 ? "+" : ""}${(+m.slope).toFixed(1)}%/day)` : "trend fitted here (no official trend yet)"}</span>${m.hasZone ? `<span><i class="lg-bb"></i>${m.zLbl}</span>` : ""}${m.best != null ? `<span><i class="lg-bd"></i>best listing today (item+ship)</span>` : ""}</div>`;
}

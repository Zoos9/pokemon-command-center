// Tiny inline-SVG charts (no libraries).
import { esc, money } from "./util.js";
export const PHASE = { hype: "#ff3d7f", declining: "#ff9f1c", basing: "#2ee6a6", recovering: "#3ba7ff" };
export const phaseColor = (p) => PHASE[p] || "#8d86b5";

export function spark(vals, w = 96, h = 26, col = "#ffcb05") {
  if (!vals || vals.length < 2) return `<span class="nospark">not enough days</span>`;
  const lo = Math.min(...vals), hi = Math.max(...vals), r = hi - lo || 1;
  const pts = vals.map((v, i) => `${((i * w) / (vals.length - 1)).toFixed(1)},${(h - ((v - lo) / r) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

export function priceChart(c, small = false) {
  const W = small ? 400 : 820, H = small ? 300 : 360, L = small ? 46 : 52, Rm = 12, T = 14, B = 30;
  const sales = c.sales.map((s) => [s.sold_date, +s.price]);
  if (!sales.length) return `<div class="empty">No sold comps recorded yet for this card.</div>`;
  const vals = sales.map((s) => s[1]);
  const marks = [c.lowest?.total, c.target.buy, c.target.sell, c.sug.low, c.sug.high].filter((v) => v != null);
  let lo = Math.min(...vals, ...marks) * 0.92, hi = Math.max(...vals, ...marks) * 1.06; if (hi - lo < 0.5) { lo -= 0.5; hi += 0.5; }
  const days = [...new Set(sales.map((s) => s[0]))].sort();
  const t0 = new Date(days[0]).getTime(), t1 = new Date(days.at(-1)).getTime() || t0 + 1, span = Math.max(t1 - t0, 864e5);
  const X = (d) => L + ((new Date(d).getTime() - t0) / span) * (W - L - Rm), Y = (p) => H - B - ((p - lo) / (hi - lo)) * (H - B - T);
  let s = "";
  const step = niceStep((hi - lo) / 5);
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) s += `<line x1="${L}" x2="${W - Rm}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" class="ax">${money(v)}</text>`;
  if (c.sug.low != null && c.sug.high != null) s += `<rect x="${L}" y="${Y(c.sug.high)}" width="${W - L - Rm}" height="${Math.max(2, Y(c.sug.low) - Y(c.sug.high))}" class="band-sug"/><text x="${L + 8}" y="${Y(c.sug.high) + 15}" class="lab-sug">SUGGESTED ZONE ${money(c.sug.low)}–${money(c.sug.high)} (research)</text>`;
  if (c.target.buy != null) s += `<line x1="${L}" x2="${W - Rm}" y1="${Y(c.target.buy)}" y2="${Y(c.target.buy)}" class="ln-target"/><text x="${L + 8}" y="${Y(c.target.buy) - 6}" class="lab-target">YOUR BUY TARGET ${money(c.target.buy)}</text>`;
  if (c.target.sell != null) s += `<line x1="${L}" x2="${W - Rm}" y1="${Y(c.target.sell)}" y2="${Y(c.target.sell)}" class="ln-sell"/><text x="${L + 8}" y="${Y(c.target.sell) - 6}" class="lab-sell">YOUR SELL TARGET ${money(c.target.sell)}</text>`;
  s += sales.map(([d, p]) => `<circle cx="${X(d).toFixed(1)}" cy="${Y(p).toFixed(1)}" r="4" class="dot"><title>${esc(d)} · ${money(p)}</title></circle>`).join("");
  if (c.daily.length > 1) s += `<polyline class="ln-med" points="${c.daily.map(([d, p]) => `${X(d).toFixed(1)},${Y(p).toFixed(1)}`).join(" ")}"/>`;
  if (c.lowest?.total != null) s += `<line x1="${L}" x2="${W - Rm}" y1="${Y(c.lowest.total)}" y2="${Y(c.lowest.total)}" class="ln-ask"/><text x="${W - Rm - 6}" y="${Y(c.lowest.total) - 6}" text-anchor="end" class="lab-ask">lowest live ask ${money(c.lowest.total)}</text>`;
  const n = Math.min(6, days.length), idx = [...new Set(Array.from({ length: n }, (_, i) => Math.round((i * (days.length - 1)) / Math.max(1, n - 1))))];
  s += idx.map((i) => `<text x="${X(days[i])}" y="${H - 8}" text-anchor="middle" class="ax">${days[i].slice(5)}</text>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sold price history">${s}</svg>
  <div class="legend"><span><i class="lg-dot"></i>each sale</span>${c.daily.length > 1 ? `<span><i class="lg-med"></i>daily median</span>` : ""}<span><i class="lg-ask"></i>lowest live ask</span>${c.sug.low != null ? `<span><i class="lg-sug"></i>suggested zone</span>` : ""}${c.target.buy != null ? `<span><i class="lg-target"></i>your target</span>` : ""}</div>`;
}
function niceStep(x) { const p = 10 ** Math.floor(Math.log10(x || 1)), m = x / p; return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p; }

export function radar(cards, small = false) {
  const cx = 420, cy = 420, R = 300;
  const rc = cards.filter((c) => c.dist != null);
  const inz = rc.filter((c) => c.dist <= 2), out = rc.filter((c) => c.dist > 2).sort((a, b) => (a.med7 || 0) - (b.med7 || 0));
  const maxD = Math.max(40, Math.ceil(Math.max(0, ...out.map((c) => c.dist)) / 10) * 10);
  let s = `<defs><radialGradient id="rg"><stop offset="0" stop-color="#2ee6a6" stop-opacity=".22"/><stop offset="1" stop-color="#2ee6a6" stop-opacity="0"/></radialGradient></defs><circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#rg)"/>`;
  for (let k = 1; k <= 4; k++) s += `<circle cx="${cx}" cy="${cy}" r="${(R * k) / 4}" class="ring"/><text x="${cx + 6}" y="${cy - (R * k) / 4 + 14}" class="ringlab">+${Math.round((maxD * k) / 4)}%</text>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${R * 0.1}" class="zone"/>`;
  inz.forEach((c, k) => { const a = (k / inz.length) * 2 * Math.PI; s += `<a href="#/card/${encodeURIComponent(c.id)}"><circle cx="${(cx + 14 * Math.cos(a)).toFixed(0)}" cy="${(cy + 14 * Math.sin(a)).toFixed(0)}" r="7" fill="#2ee6a6"><title>${esc(c.name)} ${c.lang} — in zone</title></circle></a>`; });
  s += `<text x="${cx}" y="${cy + 50}" text-anchor="middle" class="inzone">${inz.length} IN ZONE</text>`;
  out.forEach((c, i) => {
    const a = (i / out.length) * 2 * Math.PI - Math.PI / 2, r = R * Math.max(0.15, Math.min(1, c.dist / maxD));
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a), col = phaseColor(c.sug.phase), sz = 5 + Math.min(9, (c.med7 || 0) ** 0.4);
    const lx = cx + (R + 30) * Math.cos(a), ly = cy + (R + 30) * Math.sin(a), right = Math.cos(a) >= 0;
    s += `<a href="#/card/${encodeURIComponent(c.id)}"><line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${lx.toFixed(0)}" y2="${ly.toFixed(0)}" stroke="${col}" stroke-opacity=".35"/><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${sz.toFixed(0)}" fill="${col}"><title>${esc(c.full)} ${c.lang} ${c.dist.toFixed(0)}% above zone</title></circle><text class="rl" x="${(lx + (right ? 4 : -4)).toFixed(0)}" y="${(ly + 4).toFixed(0)}" text-anchor="${right ? "start" : "end"}">${esc(c.name.split(" ")[0])} ${c.lang} ${c.number.split("/")[0]} +${c.dist.toFixed(0)}%</text></a>`;
  });
  return { svg: `<svg class="radar" viewBox="${small ? "95 95 650 650" : "-150 0 1140 840"}" role="img" aria-label="Distance of each card from its buy zone">${s}</svg>`, inz, out };
}

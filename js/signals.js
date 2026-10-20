// Per-card decision signals: stage, fair price, target formula, predicted bottom, room to bottom, DEAL/WATCH.
// All inputs are canonical watchlist columns; null -> '—' / 'pending'. Price compared = item + shipping (tax shown separately).
import { esc, money } from "./util.js";
import { fmtWindow } from "./bottom.js";
const STG = { "falling fast": ["#ff4d6d", "⇊"], falling: ["#ff7a45", "↓"], slowing: ["#ff9f1c", "↘"], flat: ["#c9b458", "→"], rising: ["#2ee6a6", "↗"] };
const c2 = (v) => (v == null || isNaN(+v) ? "—" : "$" + (+v).toFixed(2));
const p1 = (v, plus) => (v == null || isNaN(+v) ? "—" : (plus && v > 0 ? "+" : "") + (+v).toFixed(1) + "%");

export function sig(c) {
  const t = c.trendData || {}, r = c.ref || {};
  const stage = t.phase ? String(t.phase).toLowerCase() : null;
  const zl = c.sug.low, zh = c.sug.high, zm = t.zone_mid ?? (zl != null && zh != null ? Math.round((zl + zh) * 50) / 100 : null);
  const ceil = t.deal_ceiling, basis = t.ceil_basis;
  const price = c.lowest?.total ?? null, target = c.target.buy;
  const askAdj = r.p25 != null && r.k != null ? r.p25 * r.k : null;
  const room = price != null && zl != null ? (price - zl) / price * 100 : null;   // % the price still has to fall to reach zone_low
  let status = null, reason;
  if (price == null) reason = "no live reputable ask";
  else if (target == null) reason = "no target set";
  else if (price > target) { status = "WATCH"; reason = `above target ${c2(target)}${ceil != null ? `, needs ≤ ${c2(Math.min(target, ceil))}` : ""}`; }
  else if (ceil == null) {
    if (stage === "falling fast" || stage === "falling") { status = "WATCH"; reason = `under target but ${stage}, no predicted bottom yet`; }
    else { status = "DEAL"; reason = `under target ${c2(target)} · ${stage || "trend pending"} · no predicted bottom`; }
  } else if (price <= ceil) { status = "DEAL"; reason = `under target and ≤ ${basis || "ceiling"} ${c2(ceil)}${stage ? ` (${stage})` : ""}`; }
  else { status = "WATCH"; reason = `under target but ${stage || "trend pending"}, needs ≤ ${c2(ceil)}`; }
  return { stage, slope: t.slope, fair: r.fair, capped: r.fairCapped, ref: r.reference, pct: r.pct, p25: r.p25, k: r.k, askAdj, target, kind: r.kind, manual: r.manual,
    zl, zm, zh, ceil, basis, win: fmtWindow(c.sug.wStart, c.sug.wEnd, c.sug.wText), conf: c.sug.conf, room, offPeak: t.off_peak, price, status, reason };
}
const pctLbl = (s) => (s.pct != null ? `${Math.round(s.pct * 1000) / 10}%` : "—%");
export const stagePill = (s) => s.stage
  ? `<span class="stg" style="background:${(STG[s.stage] || ["#8a84b3"])[0]}">${(STG[s.stage] || ["", ""])[1]} ${esc(s.stage)} <b>${p1(s.slope, true)}/d</b></span>`
  : `<span class="stg none">trend pending</span>`;
export const statusPill = (s) => s.status ? `<span class="sts ${s.status.toLowerCase()}">${s.status}</span>` : `<span class="sts none">—</span>`;

// Compact block for card rows (Cards grid, deal cards).
export function sigCompact(c) {
  const s = sig(c);
  return `<div class="sigc"><div class="sgr">${stagePill(s)}${statusPill(s)}</div>
  <div class="sgk"><span>fair <b>${c2(s.fair)}</b></span><span>buy &lt; <b>${c2(s.target)}</b></span></div>
  <div class="sgk"><span title="predicted bottom">bottom <b>${s.zl != null ? `${money(s.zl)}–${money(s.zh)}` : "pending"}</b></span><span>${s.room == null ? "room —" : s.room <= 0 ? "<b class='g'>at/below zone</b>" : `room <b>${s.room.toFixed(0)}%</b>`}</span></div>
  <div class="sgw">${esc(s.reason)}</div></div>`;
}

// Full panel for the card trajectory view.
export function sigFull(c, priceHtml) {
  const s = sig(c), manual = s.kind === "manual" || s.manual != null;
  const formula = `reference = min(fair_now ${c2(s.fair)}${s.capped ? " (capped)" : ""}, active p25 ${c2(s.p25)} × k ${s.k ?? "—"} = ${c2(s.askAdj)}) = <b>${c2(s.ref)}</b>`;
  return `<section class="panel sigf"><h2>Decision ${statusPill(s)}</h2>
  ${priceHtml ? `<div class="sgprice"><small>LOWEST ALL-IN</small>${priceHtml}</div>` : ""}<div class="sgrow">${stagePill(s)}<span class="sgwhy">${esc(s.reason)}</span></div>
  ${s.status === "WATCH" ? `<div class="sgceil">deal ceiling <b>${c2(s.ceil)}</b>${s.basis ? ` <small>(${esc(s.basis)} because ${esc(s.stage || "trend pending")})</small>` : ""} · compared with item + ship ${c2(s.price)}, tax shown separately</div>` : s.price != null ? `<div class="sgceil">lowest item + ship ${c2(s.price)} <small>(tax separate)</small></div>` : ""}
  <div class="sggrid">
   <div><small>FAIR PRICE (TREND)</small><b>${c2(s.fair)}</b><span>fair_now from the trend line</span></div>
   <div><small>BUY BELOW = ${pctLbl(s)} OF REFERENCE</small><b class="yel">${c2(s.target)}</b><span>${formula}${manual ? " · manual target overrides" : ""}</span></div>
   <div><small>PREDICTED BOTTOM <span class="sugg">Researcher</span></small><b class="grn">${s.zl != null ? `${c2(s.zl)} · ${c2(s.zm)} · ${c2(s.zh)}` : "pending"}</b><span>low · mid · high · window ${s.win || "—"} · confidence ${esc(s.conf || "—")}</span></div>
   <div><small>HOW CLOSE TO THE BOTTOM</small><b>${s.room == null ? "—" : s.room <= 0 ? "at/below zone low" : s.room.toFixed(1) + "% room"}</b><span>${s.room != null && s.room > 0 ? `ask must fall ${s.room.toFixed(1)}% to reach zone low ${c2(s.zl)}` : "vs zone low"} · ${p1(s.offPeak)} off peak</span></div>
  </div><p class="note">DEAL = under target AND ≤ zone low if falling fast, ≤ zone mid if falling, otherwise ≤ zone high. This is a rule read-out, not an alert; live alerts are listed on the Deals tab.</p></section>`;
}

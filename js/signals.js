// Per-card decision signals: stage, fair price, target formula, predicted bottom, room to bottom, DEAL/WATCH.
// All inputs are canonical watchlist columns; null -> '—' / 'pending'. Price compared = item + shipping (tax shown separately).
import { esc, money, tCT, ago } from "./util.js";
import { fmtWindow } from "./bottom.js";
import { stageInfo, STALE_MS, KIND_LABEL, REBOUND_PCT } from "./fields.js";
const c2 = (v) => (v == null || isNaN(+v) ? "—" : "$" + (+v).toFixed(2));
const p1 = (v, plus) => (v == null || isNaN(+v) ? "—" : (plus && v > 0 ? "+" : "") + (+v).toFixed(1) + "%");
const basisLbl = (b) => (b === "post_peak" ? "since peak" : b === "window" ? "trend window" : b ? String(b) : null);
export const asksLine = (s) => `asks n=${n0(s.competitiveN)} competitive of ${n0(s.asksTotalN)} · floor ${c2(s.askFloor)}`;
const n0 = (v) => (v == null || isNaN(+v) ? "—" : String(Math.round(+v)));
export const isStale = (iso) => !iso || isNaN(Date.parse(iso)) || Date.now() - Date.parse(iso) > STALE_MS;
export const freshTag = (label, iso) => `<span class="fr ${isStale(iso) ? "stale" : "ok"}" title="${esc(label)} ${esc(iso || "never")}">${isStale(iso) ? "⚠ " : ""}${esc(label)} ${iso ? `${tCT(iso)} <small>(${ago(iso)})</small>` : "—"}</span>`;
const why = (txt) => `<details class="why"><summary aria-label="What this means">ⓘ what this means</summary><p>${txt}</p></details>`;

// Reference candidates exactly as Alert Desk computes them: lowest of fair_now, active p25 × k, and the leading-asks reference.
function refSteps(r) {
  const askAdj = r.p25 != null && r.k != null ? Math.round(r.p25 * r.k * 100) / 100 : null;
  const cands = [["fair now (sold-comp trend)", r.fair], ["asks: p25 × k", askAdj], ["leading asks (listings undercutting solds)", r.leading]].filter((x) => x[1] != null);
  const min = cands.length ? Math.min(...cands.map((x) => x[1])) : null;
  const won = r.kind === "auto_sold" ? 0 : r.kind === "auto_asks" ? 1 : r.kind === "auto_leading_asks" ? 2 : null;
  return { askAdj, cands, min, won, mismatch: min != null && r.reference != null && Math.abs(min - r.reference) > 0.02 };
}

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
  const rebound = stage === "rising" && t.off_peak_trend != null && t.off_peak_trend <= REBOUND_PCT;   // rising over the window but still below the peak
  return { stage, slope: t.slope, postPeak: t.postPeakSlope, slopeBasis: t.slopeBasis, fair: r.fair, capped: r.fairCapped, lineToday: r.lineToday, ref: r.reference, pct: r.pct, p25: r.p25, k: r.k, askAdj, target, kind: r.kind, manual: r.manual,
    leading: r.leading, competitiveN: r.competitiveN, asksTotalN: r.asksTotalN, undercutN: r.undercutN, undercutShare: r.undercutShare,
    zl, zm, zh, ceil, basis, win: fmtWindow(c.sug.wStart, c.sug.wEnd, c.sug.wText), conf: c.sug.conf, room, offPeak: t.off_peak, peakSrc: t.peakSrc, insuff: c.sug.insuff, askFloor: r.askFloor, sourceText: r.sourceText, refAt: c.refAt || c.synced_at, peak: t.peak, peakDate: t.peak_date, twin: t.win, price, status, reason, rebound };
}
const pctLbl = (s) => (s.pct != null ? `${Math.round(s.pct * 1000) / 10}%` : "—%");
export const stagePill = (s) => { const i = stageInfo(s.stage);
  return i ? `<span class="stg" style="background:${i.col}">${i.ic} ${esc(s.stage)} <b>${p1(s.slope, true)}/d</b>${basisLbl(s.slopeBasis) ? ` <small>${basisLbl(s.slopeBasis)}</small>` : ""}</span>${s.rebound ? `<span class="stg2" title="Rising over the trend window, but still below its peak">${p1(c.trendData.off_peak_trend)} vs peak</span>` : ""}`
    : `<span class="stg none">trend pending</span>`; };
export const statusPill = (s) => s.status ? `<span class="sts ${s.status.toLowerCase()}">${s.status}</span>` : `<span class="sts none">—</span>`;

// Compact block for card rows (Cards grid, deal cards).
export function sigCompact(c) {
  const s = sig(c), st = isStale(c.scanned_at);
  return `<div class="sigc"><div class="sgr">${stagePill(s)}${statusPill(s)}</div>
  <div class="sgk"><span>fair <b>${c2(s.fair)}</b></span><span>buy &lt; <b>${c2(s.target)}</b></span></div>
  ${s.insuff ? `<div class="insuf">⏳ No bottom call yet: ${esc(s.insuff)}</div>` : `<div class="sgk"><span title="predicted bottom">bottom <b>${s.zl != null ? `${money(s.zl)}–${money(s.zh)}` : "pending"}</b></span><span>${s.room == null ? "room —" : s.room <= 0 ? "<b class='g'>at/below zone</b>" : `room <b>${s.room.toFixed(0)}%</b>`}</span></div>`}
  <div class="sgk"><span>off peak <b>${p1(s.offPeak)}</b></span></div><div class="sgk"><span>${asksLine(s)}</span></div>
  <div class="sgw">${esc(s.reason)}</div>${st ? `<div class="fr stale">⚠ listings ${c.scanned_at ? ago(c.scanned_at) : "never scanned"}</div>` : ""}</div>`;
}

// Full panel for the card trajectory view.
export function sigFull(c, priceHtml) {
  const s = sig(c), manual = s.kind === "manual" || s.manual != null, R = refSteps(c.ref || {}), info = stageInfo(s.stage);
  const steps = `<ol class="steps">${R.cands.map(([l, v], i) => `<li class="${i === R.won || (R.won == null && v === R.min) ? "won" : ""}">${esc(l)}: <b>${c2(v)}</b>${i === 1 ? ` <small>(${c2(s.p25)} × ${s.k ?? "—"})</small>` : ""}${i === 0 && s.capped ? " <small>(capped at 3-day median)</small>" : ""}</li>`).join("")}
    <li>reference = the lowest of those = <b>${c2(s.ref)}</b>${R.mismatch ? ` <small class="warn">(Alert Desk's stored reference; the math above gives ${c2(R.min)})</small>` : ""}</li>
    <li>buy below = ${pctLbl(s)} × ${c2(s.ref)} = <b class="yel">${c2(s.ref != null && s.pct != null ? s.ref * s.pct : null)}</b>${manual ? ` <small>· your manual target ${c2(s.target)} overrides this</small>` : ""}</li></ol>${s.kind ? `<div class="tsrc2">source: <b>${esc(KIND_LABEL[s.kind] || s.kind)}</b>${s.sourceText ? ` — ${esc(s.sourceText)}` : ""}</div>` : ""}`;
  const fairWhy = `Fair price is <b>fair_now</b>: the value today of a trend line fitted to recent <i>sold</i> comps (outliers trimmed${s.twin ? `, ${s.twin}-day window` : ""}). It describes what buyers actually paid, not what sellers are asking, so it can sit above today's listings${s.price != null && s.fair != null && s.price < s.fair ? ` (lowest ask now ${c2(s.price)} vs fair ${c2(s.fair)})` : ""}. When asks are cheaper, the reference below uses the asks instead, so the target still follows the market down.${s.capped ? ` This card's trend line ended at ${c2(s.lineToday)}, so fair_now was capped at the 3-day sold median.` : ""}`;
  const stageWhy = info ? `${esc(info.say)} Slope ${p1(s.slope, true)}/day${s.slopeBasis ? ` (measured ${s.slopeBasis === "post_peak" ? "since the peak" : `over the ${s.twin || 14}-day window`}; basis: ${esc(basisLbl(s.slopeBasis))})` : ""}. ${s.peak != null ? `${s.peakSrc === "research robust peak" ? "Research robust peak" : "Peak daily median"} ${c2(s.peak)}${s.peakDate ? ` on ${esc(String(s.peakDate).slice(5))}` : ""}; now ${p1(s.offPeak)} vs that peak.` : ""}${s.rebound ? " It is labelled rising because the trend window goes up, but it is still below its peak — read it as a rebound, not a new high." : ""}` : "No trend stage yet: not enough sold days after trimming outliers.";
  const comp = `<div><small>ASK COMPETITION</small><b>${n0(s.competitiveN)}<span class="of"> of ${n0(s.asksTotalN)}</span></b><span>${asksLine(s)} · ${n0(s.undercutN)} undercutting solds${s.undercutShare != null ? ` (${(s.undercutShare * 100).toFixed(1)}%)` : ""}</span>${why("Competitive asks are listings priced near the sold market; if many sellers undercut recent sales, prices tend to follow them down. '—' means Alert Desk hasn't published this count yet.")}</div>`;
  return `<section class="panel sigf"><h2>Decision ${statusPill(s)}</h2>
  ${priceHtml ? `<div class="sgprice"><small>LOWEST ALL-IN</small>${priceHtml}</div>` : ""}<div class="sgrow">${stagePill(s)}<span class="sgwhy">${esc(s.reason)}</span></div>
  ${why(s.status === "DEAL" ? "DEAL: the cheapest reputable listing (item + shipping) is under the buy-below target AND low enough for the trend stage. This is the dashboard's rule read-out; pushed alerts are on the Deals tab." : s.status === "WATCH" ? `WATCH: not a deal yet. ${s.price != null && s.target != null && s.price > s.target ? `The cheapest listing ${c2(s.price)} is above the buy-below target ${c2(s.target)}.` : `The cheapest listing ${c2(s.price)} is under the target, but the card is still ${esc(s.stage || "trending")}, so it also has to reach the deal ceiling ${c2(s.ceil)}.`} Rule: under target AND ≤ bottom low if falling fast, ≤ bottom mid if falling, otherwise ≤ bottom high.` : "No status: there's no live listing or no target for this card.")}
  ${s.status === "WATCH" ? `<div class="sgceil">deal ceiling <b>${c2(s.ceil)}</b>${s.basis ? ` <small>(${esc(s.basis)} because ${esc(s.stage || "trend pending")})</small>` : ""} · compared with item + ship ${c2(s.price)}, tax shown separately</div>` : s.price != null ? `<div class="sgceil">lowest item + ship ${c2(s.price)} <small>(tax separate)</small></div>` : ""}
  <div class="sggrid">
   <div><small>STAGE</small><b>${info ? `${info.ic} ${esc(s.stage)}` : "pending"}</b><span>${p1(s.slope, true)}/day${basisLbl(s.slopeBasis) ? ` (${basisLbl(s.slopeBasis)})` : ""} · ${p1(s.offPeak)} vs ${s.peakSrc === "research robust peak" ? "research peak" : "peak"} ${c2(s.peak)}${s.peakDate ? ` ${esc(String(s.peakDate).slice(5, 10))}` : ""}</span>${why(stageWhy)}</div>
   <div><small>FAIR PRICE (TREND)</small><b>${c2(s.fair)}</b><span>trend of sold comps, not asks</span>${why(fairWhy)}</div>
   <div class="wide"><small>BUY BELOW = ${pctLbl(s)} OF REFERENCE</small><b class="yel">${c2(s.target)}</b>${steps}${why(`The target starts from a reference price: the lowest of the sold-comp trend (fair now), the 25th-percentile ask scaled by k (k = how sold prices usually compare to asks for this card), and the price of listings already undercutting recent sales. Taking the lowest keeps the target honest when sellers are cutting prices. The target is ${pctLbl(s)} of that reference.`)}</div>
   ${s.insuff ? `<div class="wide insuf"><small>PREDICTED BOTTOM · NOT ENOUGH DATA</small><b>⏳ No bottom call yet</b><p>${esc(s.insuff)}</p><span>Target above is still computed from available prices; treat it loosely until real sales exist.</span></div>` : `   <div><small>PREDICTED BOTTOM <span class="sugg">Researcher</span></small><b class="grn">${s.zl != null ? `${c2(s.zl)} · ${c2(s.zm)} · ${c2(s.zh)}` : "pending"}</b><span>low · mid · high · window ${s.win || "—"} · confidence ${esc(s.conf || "—")}</span>${why("The Market Researcher's forecast of where this card's price is likely to stop falling, with a time window and a confidence. It's a prediction, not a guarantee; low confidence means treat it loosely.")}</div>
   <div><small>HOW CLOSE TO THE BOTTOM</small><b>${s.room == null ? "—" : s.room <= 0 ? "at/below zone low" : s.room.toFixed(1) + "% room"}</b><span>${s.room != null && s.room > 0 ? `ask must fall ${s.room.toFixed(1)}% to reach zone low ${c2(s.zl)}` : "vs zone low"} · ${p1(s.offPeak)} off peak</span></div>
`}
   ${comp}
  </div><div class="frrow">${freshTag("listings scanned", c.scanned_at)}${freshTag("trend/target synced", c.refAt || c.synced_at)}${c.sug.noteAt ? `<span class="fr ${Date.parse(c.sug.noteAt) < Date.parse(c.refAt || c.synced_at || 0) ? "stale" : "ok"}">${Date.parse(c.sug.noteAt) < Date.parse(c.refAt || c.synced_at || 0) ? "⚠ research note older than trend data: " : "research note "}${tCT(c.sug.noteAt)} <small>(${ago(c.sug.noteAt)})</small></span>` : ""}</div></section>`;
}

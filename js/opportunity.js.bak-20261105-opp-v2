// "Best buys now" opportunity score (watchlist opportunity_*, research/opportunity.py, method opportunity-v1). Display / ranking
// only: never changes DEAL/WATCH, alerts, buy_below (70% of reference) or paper trades. Values are as of the last pipeline run.
import { esc } from "./util.js";
const n = (v) => (v == null || isNaN(+v) ? null : +v);
export function oppFor(w) {
  const o = w?.opportunity ?? w?.data?.opportunity ?? null;
  const score = n(w?.opportunity_score ?? w?.data?.opportunity_score ?? o?.score), rank = n(w?.opportunity_rank ?? w?.data?.opportunity_rank ?? o?.rank);
  const note = w?.opportunity_note ?? w?.data?.opportunity_note ?? o?.note ?? null;
  if (!o && score == null && !note) return null;
  return { score, rank, note: note || "", eligible: o ? o.eligible === true : score != null, why: o?.ineligible || null, ask: n(o?.ask), cost: n(o?.cost), sale: n(o?.sale), saleSrc: o?.sale_source || null,
    pct: n(o?.net_profit_pct), profit: n(o?.net_profit_usd), zoneLow: n(o?.zone_low), zoneHigh: n(o?.zone_high), zonePos: n(o?.zone_pos_pct), inZone: o?.in_zone === true,
    liq: o?.liquidity || null, phase: o?.phase || null, knife: o?.falling_knife === true, actionable: o?.actionable === true, comp: o?.components || null, asOf: o?.as_of || null, method: o?.method || "opportunity-v1" };
}
// Ranked rows only, sorted by key ("score" | "pct" | "zone"); ties fall back to rank.
export function bestBuys(cards, key = "score", limit = 10) {
  const r = cards.filter((c) => c.opp?.eligible && c.opp.score != null);
  const k = { score: (c) => -c.opp.score, pct: (c) => -(c.opp.pct ?? -1e9), zone: (c) => (c.opp.zonePos ?? 1e9) }[key] || ((c) => -c.opp.score);
  return r.sort((a, b) => k(a) - k(b) || (a.opp.rank ?? 999) - (b.opp.rank ?? 999)).slice(0, limit);
}
export const oppZone = (o) => (o.zoneHigh == null ? "no zone" : o.inZone ? (o.zoneLow != null && o.ask < o.zoneLow ? "below zone" : "in zone") : `+${Math.round(o.zonePos)}% above`);
export const oppBadge = (o) => (!o || o.score == null ? "" : `<span class="opp ${o.score >= 65 ? "hi" : o.score >= 50 ? "mid" : "lo"}" title="${esc(o.note)}">★ ${Math.round(o.score)}</span>`);
export const oppLine = (o) => (!o ? "" : o.score != null ? `<div class="mrow s oppl"><span>best-buy score ${oppBadge(o)} #${o.rank}</span><span class="n">${o.pct != null ? (o.pct >= 0 ? "+" : "") + Math.round(o.pct) + "% net" : ""}</span></div>` : "");
export function oppPanel(o) {
  if (!o) return "";
  const c = o.comp;
  return `<div class="st oppst"><small>BEST-BUY SCORE <span class="sugg">opportunity-v1</span></small><b>${o.score != null ? `${oppBadge(o)} <small>rank #${o.rank}</small>` : "not ranked"}</b>${esc(o.note)}
  ${c ? `<br><small>profit ${c.profit}/40 · zone ${c.zone}/25 · liquidity ${c.liquidity}/15 · confidence ${c.confidence}/10 · phase ${c.phase}/10</small>` : ""}
  <details class="why"><summary aria-label="What this means">ⓘ what this means</summary><p>Ranks watchlist rows by risk-adjusted buy value at today's lowest valid ask (item + shipping, seller 30+ fb / 90%+, × 1.065 tax). Profit = net after eBay fees (13.25% + $0.40 + outbound ship) selling at the 12-mo estimate (your sell_above, else research est., else precedent est.); full 40 points at +100%. Zone = in/below the predicted bottom zone (25), falling to 0 at 50% above. Liquidity high 15 / medium 10 / low 3 / unknown 0. Phase: basing 10, recovering 8, declining 4, falling knife 0. Presale, insufficient-data, no-valid-ask and loses-money rows are not ranked. Estimates, not promises; display only (${esc(o.method)}${o.asOf ? ", " + esc(o.asOf.slice(0, 16).replace("T", " ")) + " CT" : ""}).</p></details></div>`;
}

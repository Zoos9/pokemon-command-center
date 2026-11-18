// 2026-11-18 ONE shared Deal / Watch decision for every Command Center view (method deal-decision-v1).
// Mirrors scanner/check_targets.card_tier (= the alert rule: strict "under buy_below" on item + shipping, alert_tier_core
// falling-knife ceiling, watch-only / presale / insufficient-data holds, then the stale-sold and stale-active guards) and then
// ANDs it with the tier the pipeline computed at sync time (watchlist data.deal_decision). A card is a DEAL only when both
// agree and the live browser-clock guards pass; anything else is WATCH with the reason. Never changes buy_below / alerts.
import { activeStale } from "./health.js";
export const DECISION_METHOD = "deal-decision-v1";
const c2 = (v) => (v == null || isNaN(+v) ? "—" : "$" + (+v).toFixed(2));
const FALLING = new Set(["falling fast", "falling", "peaked"]);   // check_targets: peaked is treated like falling

// Deal ceiling exactly as check_targets.alert_tier_core: falling fast -> zone_low, falling/peaked -> zone midpoint, else zone_high.
export function dealCeiling(c) {
  const t = c.trendData || {}, stage = t.phase ? String(t.phase).toLowerCase() : null;
  const zl = c.sug?.low ?? null, zh = c.sug?.high ?? null;
  const zm = t.zone_mid ?? (zl != null && zh != null ? Math.round((zl + zh) * 50) / 100 : null);
  if (zl == null && zh == null) return { ceil: t.deal_ceiling ?? null, basis: t.ceil_basis ?? null, zm };
  if (stage === "falling fast") return { ceil: zl, basis: "zone_low", zm };
  if (stage === "falling" || stage === "peaked") return { ceil: zm, basis: "zone_mid", zm };
  return { ceil: zh, basis: "zone_high", zm };
}

export function decide(c, now = Date.now()) {
  const t = c.trendData || {}, stage = t.phase ? String(t.phase).toLowerCase() : null;
  const { ceil, basis } = dealCeiling(c);
  const price = c.lowest?.total ?? null, target = c.target?.buy ?? null;
  let status = null, reason;
  if (price == null) reason = "no live reputable ask";
  else if (target == null) reason = "no target set";
  else if (price > target) { status = "WATCH"; reason = `above target ${c2(target)}${ceil != null ? `, needs ≤ ${c2(Math.min(target, ceil))}` : ""}`; }
  else if (price >= target - 1e-9) { status = "WATCH"; reason = `at target ${c2(target)}, not under it (alerts need item + ship under buy_below)`; }
  else if (c.watchOnly && !c.dealAlerts) { status = "WATCH"; reason = "watch-only opportunity item: tracked and paper-traded, never a Deal"; }
  else if (c.presaleOnly) { status = "WATCH"; reason = "presale-only item: never a Deal until it ships and the Researcher has a zone"; }
  else if (c.insufficient) { status = "WATCH"; reason = "Researcher: insufficient data, never a Deal until there is a zone"; }
  else if (ceil == null) {
    if (stage == null || FALLING.has(stage)) { status = "WATCH"; reason = `under target but ${stage || "no trend yet"}, no predicted bottom yet`; }
    else { status = "DEAL"; reason = `under target ${c2(target)} · ${stage} · no predicted bottom`; }
  } else if (price <= ceil) { status = "DEAL"; reason = `under target and ≤ ${basis || "ceiling"} ${c2(ceil)}${stage ? ` (${stage})` : ""}`; }
  else { status = "WATCH"; reason = `under target but ${stage || "trend pending"}, needs ≤ ${c2(ceil)}`; }
  // Sold-data staleness guard (scanner/sold_freshness.py, 2026-11-13).
  const fresh = c.fresh || null, soldStale = !!(fresh && fresh.stale);
  if (soldStale && status === "DEAL") { status = "WATCH"; reason = `stale sold data — would be DEAL (${reason})`; }
  // Stale-active-listings guard (scanner/health_check.py, 2026-11-17), live browser clock.
  const actStale = price != null && activeStale(c, now);
  if (actStale && status === "DEAL") { status = "WATCH"; reason = `stale active listings — would be DEAL (${reason})`; }
  // The pipeline's own decision at sync time (check_targets.card_tier). It can only hold a DEAL, never create one.
  const sv = c.serverTier || null;
  if (status === "DEAL" && sv && sv.tier !== "DEAL") { status = "WATCH"; reason = `pipeline says ${sv.tier || "no Deal"}: ${sv.tier_reason || "not under target"}`; }
  return { status, reason, ceil, basis, stage, price, target, soldStale, fresh, activeStale: actStale, server: sv, method: DECISION_METHOD };
}
// Convenience for lists: DEAL / WATCH / null.
export const tierOf = (c, now) => decide(c, now).status;

// ROI after eBay fees + exit plan. Pure functions, no DOM, no imports (unit-testable in Node).
// Fee model (constants in js/config.js -> CONFIG.FEES; see web/README.md "Fee model"):
//   cost basis   = buy price (item + shipping) × (1 + taxRate)
//   net proceeds = sale × (1 − ebayFeePct) − perOrderFee − outbound shipping
//   net multiple = net proceeds ÷ cost basis;  sale needed for m× = (m × cost + perOrderFee + ship) ÷ (1 − ebayFeePct)
export const DEFAULT_FEES = { ebayFeePct: 0.1325, perOrderFee: 0.40, taxRate: 0.065,
  ship: { pwe: 1.25, pweMaxSale: 20, bmwt: 5.00, etb: 13.00, box: 22.00 }, thinMarginX: 1.25, stopFallbackPct: 20 };

const r2 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);
const r3 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 1000) / 1000);

// Item kind -> shipping tier. Singles: plain envelope under pweMaxSale, tracked bubble mailer at/above it.
export function itemKind(name, category) {
  const n = String(name || ""), cat = String(category || ""), sealed = /^sealed/i.test(cat) || /elite trainer box|booster box|booster bundle|ultra[- ]premium collection/i.test(n) && !/promo/i.test(n);
  if (!sealed) return "single";
  return /premium/i.test(cat) || /booster box|ultra[- ]premium collection/i.test(n) ? "box" : "etb";
}
export function shipFor(kind, sale, F = DEFAULT_FEES) {
  if (kind === "box") return F.ship.box;
  if (kind === "etb") return F.ship.etb;
  return sale != null && sale < F.ship.pweMaxSale ? F.ship.pwe : F.ship.bmwt;
}
export const costBasis = (buy, F = DEFAULT_FEES) => (buy == null ? null : buy * (1 + F.taxRate));
export const netProceeds = (sale, kind, F = DEFAULT_FEES) => (sale == null ? null : sale * (1 - F.ebayFeePct) - F.perOrderFee - shipFor(kind, sale, F));
// Sale price whose net proceeds = m × cost. Singles: try the envelope tier first; if that price is >= the cutoff, use the mailer tier.
export function saleFor(m, cost, kind, F = DEFAULT_FEES) {
  if (cost == null) return null;
  const solve = (ship) => (m * cost + F.perOrderFee + ship) / (1 - F.ebayFeePct);
  if (kind !== "single") return solve(shipFor(kind, null, F));
  const s = solve(F.ship.pwe);
  return s < F.ship.pweMaxSale ? s : Math.max(solve(F.ship.bmwt), F.ship.pweMaxSale);
}
function basis(buy, kind, target, F) {
  if (buy == null) return null;
  const cost = costBasis(buy, F), net = target != null ? netProceeds(target, kind, F) : null;
  return { buy: r2(buy), cost: r2(cost), breakeven: r2(saleFor(1, cost, kind, F)), x15: r2(saleFor(1.5, cost, kind, F)), x2: r2(saleFor(2, cost, kind, F)), x3: r2(saleFor(3, cost, kind, F)),
    netAtTarget: r2(net), multAtTarget: net != null ? r3(net / cost) : null, profitAtTarget: net != null ? r2(net - cost) : null };
}
const usd = (v) => (v == null ? "—" : "$" + (+v).toFixed(2));
// i: { name, category, ask (lowest reputable item+ship, or null), buyBelow, target, targetSrc, targetConf, zoneLow, zoneHigh, med7 }
export function roiFor(i, F = DEFAULT_FEES) {
  const kind = itemKind(i.name, i.category), t = i.target ?? null;
  const atAsk = basis(i.ask ?? null, kind, t, F), atBuy = basis(i.buyBelow ?? null, kind, t, F);
  const flipNet = i.ask != null && i.med7 != null ? netProceeds(i.med7, kind, F) : null;
  const flip = flipNet != null ? { sale: r2(i.med7), net: r2(flipNet), mult: r3(flipNet / costBasis(i.ask, F)), profit: r2(flipNet - costBasis(i.ask, F)) } : null;
  const b = atAsk || atBuy, bLabel = atAsk ? "today's ask" : "buy-below";
  let plan = null;
  if (b) {
    const sell = `Sell zone: list at ${usd(b.x2)}+ (2× net on a ${usd(b.buy)} buy at ${bLabel}; net profit ≈ ${usd(b.cost)} per unit).`;
    const tgt = t != null ? ` 12-mo target ${usd(t)}${i.targetSrc === "sell_above" ? " (your sell_above)" : i.targetSrc === "precedent" ? " (precedent est., mid)" : " (research estimate)"} → ${b.multAtTarget?.toFixed(2)}× net${b.multAtTarget < 2 ? ", short of 2×" : ""}.` : " No 12-mo target yet, so no upside estimate.";
    const stop = i.zoneLow != null ? ` Re-evaluate / stop-loss if the 7d sold median breaks below the predicted bottom low ${usd(i.zoneLow)}${i.zoneHigh != null ? ` (zone ${usd(i.zoneLow)}–${usd(i.zoneHigh)})` : ""}.`
      : ` No predicted bottom zone yet: re-evaluate if the 7d sold median falls ${F.stopFallbackPct}%+ below your buy (${usd(b.buy * (1 - F.stopFallbackPct / 100))}).`;
    plan = sell + tgt + stop;
  }
  const headline = atAsk?.multAtTarget ?? flip?.mult ?? null;
  const verdict = headline == null ? null : headline < 1 ? "loss" : headline < F.thinMarginX ? "thin" : headline >= 1.5 ? "good" : "ok";
  return { kind, ship: shipFor(kind, i.ask ?? i.buyBelow, F), target: t, targetSrc: t != null ? i.targetSrc : null, targetConf: i.targetConf || null, atAsk, atBuy, flip, plan,
    headline, headlineBasis: atAsk?.multAtTarget != null ? "target" : flip ? "flip" : null, verdict,
    actionable: (i.targetSrc !== "precedent" || i.targetZoneAnchored === true) && i.ask != null && i.buyBelow != null && i.ask <= i.buyBelow && atAsk?.multAtTarget != null && atAsk.multAtTarget >= 1.5 };
}
// 12-mo precedent upside (watchlist.json upside_12mo, research/upside_12mo.py): net multiple at its low / mid / high sale prices,
// at today's ask and at buy-below. "2x candidate" = zone-anchored estimate (not a presale/launch price), n >= 5 analogs,
// and net multiple at the MID estimate >= 2 at buy-below or at today's ask.
export function upsideFor(up, kind, ask, buyBelow, F = DEFAULT_FEES) {
  if (!up || up.mid == null) return up ? { none: true, reason: up.reason || "no estimate", n: up.n_precedents ?? null } : null;
  const at = (buy) => (buy == null ? null : { buy: r2(buy), low: r3(netProceeds(up.low, kind, F) / costBasis(buy, F)), mid: r3(netProceeds(up.mid, kind, F) / costBasis(buy, F)), high: r3(netProceeds(up.high, kind, F) / costBasis(buy, F)) });
  const zone = /^predicted bottom zone/.test(up.anchor_kind || ""), atAsk = at(ask ?? null), atBuy = at(buyBelow ?? null);
  const okN = (up.n_precedents ?? 0) >= 5, c2B = zone && okN && atBuy?.mid >= 2, c2A = zone && okN && atAsk?.mid >= 2;
  return { low: up.low, mid: up.mid, high: up.high, conf: up.confidence || null, n: up.n_precedents ?? null, anchor: up.anchor ?? null, anchorKind: up.anchor_kind || null,
    zone, pool: up.pool || null, method: up.method || null, asOf: up.as_of || null, multLow: up.mult_low ?? null, multMid: up.mult_mid ?? null, multHigh: up.mult_high ?? null,
    atAsk, atBuy, cand2x: c2B || c2A, cand2xBasis: c2B && c2A ? "buy-below & ask" : c2B ? "buy-below" : c2A ? "today's ask" : null };
}
// Backtested exit plan (watchlist.json exit_plan + sell_signal, research/exit_plan.py). Display only: never an alert, never sell_above.
// Net multiples are recomputed here at today's ask / buy-below with the same fee model (the stored ones are a nightly snapshot).
export function exitFor(ep, ss, kind, ask, buyBelow, F = DEFAULT_FEES) {
  if (!ep) return null;
  if (ep.target_sell == null) return { none: true, reason: ep.reason || "no exit plan", signal: ss?.signal || "n/a" };
  const net = netProceeds(ep.target_sell, kind, F), mx = (buy) => (buy == null ? null : r3(net / costBasis(buy, F)));
  return { target: ep.target_sell, targetKind: ep.target_kind || null, net: r2(net), lo: ep.exit_range_low ?? null, hi: ep.exit_range_high ?? null,
    multAsk: mx(ask ?? null), multBuy: mx(buyBelow ?? null), ask: ask ?? null, buyBelow: buyBelow ?? null,
    ruleId: ep.rule_id || null, rule: ep.rule || null, ruleType: ep.rule_type || null, anchor: ep.anchor ?? null, anchorKind: ep.anchor_kind || null,
    winStart: ep.sell_window_start || null, winEnd: ep.sell_window_end || null, stopDate: ep.time_stop_date || null, stopMonths: ep.time_stop_months ?? null,
    trailing: ep.trailing_stop || null, conf: ep.confidence || null, n: ep.n_precedents ?? null, pool: ep.pool || null,
    bt: { geo: ep.bt_net_geo ?? null, med: ep.bt_net_median ?? null, months: ep.bt_months_median ?? null, h12geo: ep.bt_hold12_net_geo ?? null, h12med: ep.bt_hold12_net_median ?? null, oos: ep.oos_net_geo ?? null },
    asOf: ep.as_of || null, method: ep.method || null, holding: ep.holding || null,
    signal: ss?.signal || "n/a", signalReason: ss?.reason || null, applies: !!ss?.applies };
}

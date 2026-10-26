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
    const tgt = t != null ? ` 12-mo target ${usd(t)}${i.targetSrc === "sell_above" ? " (your sell_above)" : " (research estimate)"} → ${b.multAtTarget?.toFixed(2)}× net${b.multAtTarget < 2 ? ", short of 2×" : ""}.` : " No 12-mo target yet, so no upside estimate.";
    const stop = i.zoneLow != null ? ` Re-evaluate / stop-loss if the 7d sold median breaks below the predicted bottom low ${usd(i.zoneLow)}${i.zoneHigh != null ? ` (zone ${usd(i.zoneLow)}–${usd(i.zoneHigh)})` : ""}.`
      : ` No predicted bottom zone yet: re-evaluate if the 7d sold median falls ${F.stopFallbackPct}%+ below your buy (${usd(b.buy * (1 - F.stopFallbackPct / 100))}).`;
    plan = sell + tgt + stop;
  }
  const headline = atAsk?.multAtTarget ?? flip?.mult ?? null;
  const verdict = headline == null ? null : headline < 1 ? "loss" : headline < F.thinMarginX ? "thin" : headline >= 1.5 ? "good" : "ok";
  return { kind, ship: shipFor(kind, i.ask ?? i.buyBelow, F), target: t, targetSrc: t != null ? i.targetSrc : null, targetConf: i.targetConf || null, atAsk, atBuy, flip, plan,
    headline, headlineBasis: atAsk?.multAtTarget != null ? "target" : flip ? "flip" : null, verdict,
    actionable: i.ask != null && i.buyBelow != null && i.ask <= i.buyBelow && atAsk?.multAtTarget != null && atAsk.multAtTarget >= 1.5 };
}

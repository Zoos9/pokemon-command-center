// All-in price display: main number = item + shipping + tax when Alert Desk's fields exist,
// otherwise item + shipping (clearly labelled "tax not incl."). Comparisons elsewhere always use `total` (item+ship).
import { esc, num } from "./util.js";
// Exact cents everywhere in price breakdowns so the parts visibly add up to the total.
const money = (x) => (x == null || isNaN(x) ? "—" : `$${(+x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

export function priceInfo(l) {
  if (!l) return null;
  const item = num(l.item_usd) ?? num(l.price);
  const shipUnknown = l.shipping_unknown === true && num(l.shipping_usd) == null;
  const ship = shipUnknown ? null : num(l.shipping_usd) ?? num(l.shipping);
  const cmp = num(l.total) ?? (item != null ? item + (ship || 0) : null);      // item + shipping (target comparisons)
  let rate = num(l.tax_rate); if (rate != null && rate <= 1) rate *= 100;          // accept 0.0825 or 8.25; never invented
  const tax = num(l.tax_usd), allInField = num(l.total_with_tax_usd);
  const hasTax = allInField != null || tax != null;
  const allIn = allInField ?? (tax != null && cmp != null ? cmp + tax : cmp);
  return { item, ship, shipUnknown, cmp, rate, tax, hasTax, allIn, auction: !!l.is_auction };
}
// opts: { key, pop (dropdown, for tables), target, targetLabel, compact }
export function priceBtn(l, opts = {}) {
  const p = priceInfo(l); if (!p || p.allIn == null) return "—";
  const label = p.hasTax ? "all-in" : "item+ship · tax not incl.";
  const rows = [
    [p.auction ? "Current bid" : "Item", money(p.item)],
    ["Shipping", p.shipUnknown ? "shipping unknown" : p.ship == null ? "—" : p.ship === 0 ? "free" : money(p.ship)],
    ["Tax", p.tax != null ? `tax ${p.rate != null ? p.rate.toFixed(p.rate % 1 ? 2 : 0) + "% · " : ""}${money(p.tax)}` : p.hasTax ? "included" : "not yet calculated"],
    [p.hasTax ? "All-in total" : "Total (no tax)", money(p.allIn)],
  ];
  const cmpLine = opts.target != null && p.cmp != null
    ? `<div class="ptcmp">vs ${esc(opts.targetLabel || "target")}: item+ship ${money(p.cmp)} ${p.cmp <= opts.target ? "≤" : ">"} ${money(opts.target)}</div>` : "";
  const k = esc(opts.key || l.item_id || l.url || Math.random().toString(36).slice(2));
  return `<details class="pt${opts.pop ? " pop" : ""}${opts.compact ? " compact" : ""}" data-k="pt-${k}"><summary aria-label="${esc(`${money(p.allIn)} ${label}. Tap for price breakdown`)}">
    <span class="ptv">${money(p.allIn)}</span><span class="ptl">${p.hasTax ? "all-in" : p.shipUnknown ? "+ship? · no tax" : "no tax"}</span><span class="ptc" aria-hidden="true">▾</span></summary>
    <div class="ptb">${rows.map(([a, b], i) => `<div class="${i === 3 ? "tot" : ""}"><span>${a}</span><b>${esc(b)}</b></div>`).join("")}${cmpLine}<div class="ptn">Targets and % vs market use item + shipping, not tax.</div></div></details>`;
}

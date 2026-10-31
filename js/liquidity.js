// Liquidity / sell-through (watchlist liquidity, research/liquidity.py, method liquidity-v1). Display only:
// never changes alerts, tiers, buy_below (70% of reference) or paper trades. Low liquidity adds a caution note to DEAL/WATCH.
import { esc } from "./util.js";
const n = (v) => (v == null || isNaN(+v) ? null : +v);
export function liqFor(w) {
  const L = w?.liquidity ?? w?.data?.liquidity ?? null;
  if (!L || !L.level) return null;
  return { level: String(L.level), reason: L.reason || "", caution: L.caution || null, spd30: n(L.sales_per_day_30d), spd7: n(L.sales_per_day_7d), spd: n(L.sales_per_day_level ?? L.sales_per_day_30d),
    basis: L.rate_basis || "30d", n7: n(L.sold_7d_n), n30: n(L.sold_30d_n), cov30: n(L.covered_days_30d), capped: L.window_capped === true, active: n(L.active_count), activeCapped: L.active_capped === true,
    st: n(L.sell_through_30d), dos: n(L.days_of_supply), comp: n(L.competing_n), dosComp: n(L.days_of_supply_competing), presale: L.presale === true, asOf: L.as_of || null, method: L.method || "liquidity-v1" };
}
const ICON = { high: "🟢", medium: "🟡", low: "🔴", unknown: "⚪" };
const f2 = (v) => (v == null ? "—" : v >= 10 ? v.toFixed(0) : v.toFixed(2));
const d0 = (v) => (v == null ? "∞" : Math.round(v) + " d");
export const liqTitle = (q) => `${q.reason}${q.capped ? ` · rate measured over the ${q.cov30?.toFixed(1)} d the sold data covers (recent-sales sample)` : ""}${q.activeCapped ? " · active = 200 cheapest results scanned, more listed above" : ""}`;
export const liqBadge = (q) => (!q ? "" : `<span class="liq ${esc(q.level)}" title="${esc(liqTitle(q))}">${ICON[q.level] || "⚪"} ${esc(q.level)} liquidity</span>`);
// One line for deal cards / card grid: level · sales/day · days of supply.
export function liqLine(q) {
  if (!q) return "";
  if (q.level === "unknown") return `<div class="roid liql">${liqBadge(q)} <small>${esc(q.reason)}</small></div>`;
  return `<div class="roid liql">${liqBadge(q)} <small><b>${f2(q.spd)}</b> sales/day${q.basis !== "30d" ? " (7d)" : ""} · <b>${d0(q.dos)}</b> of supply · ${q.active ?? "—"}${q.activeCapped ? "+" : ""} active</small></div>`;
}
// Caution next to a DEAL / WATCH status (display only; the alert rule is unchanged).
export const liqCaution = (q, status) => (q && q.level === "low" && (status === "DEAL" || status === "WATCH") ? `<div class="liqc">⚠ ${esc(q.caution || "Low liquidity: may be slow to resell at this price")}</div>` : "");
// Card page panel.
export function liqPanel(q) {
  if (!q) return "";
  return `<div class="st liqst"><small>LIQUIDITY <span class="sugg">sell-through</span></small><b>${liqBadge(q)}</b>${q.level === "unknown" && q.presale ? "presale · " : ""}${f2(q.spd30)}/day 30d · ${f2(q.spd7)}/day 7d<br>
  ${q.n7 ?? "—"} sold 7d · ${q.n30 ?? "—"} sold 30d${q.capped ? ` <small>(data covers ${q.cov30?.toFixed(1)} d)</small>` : ""}<br>${q.active ?? "—"}${q.activeCapped ? "+" : ""} active · sell-through ${q.st == null ? "—" : q.st.toFixed(2)} · <b>${d0(q.dos)}</b> of supply${q.comp != null ? `<br><small>${q.comp} asks within 10% of the sold price → ${d0(q.dosComp)}</small>` : ""}
  <details class="why"><summary aria-label="What this means">ⓘ what this means</summary><p>${esc(q.reason)}. Sales/day = qualifying sold comps (same seller and title filters as the sold median) over the days the data covers; days of supply = reputable active listings ÷ sales/day. High ≥ 1/day and ≤ 30 d; medium ≥ 0.25/day and ≤ 90 d; low otherwise; unknown = presale or too few sales. Display only (${esc(q.method)}${q.asOf ? ", " + esc(q.asOf.slice(0, 16).replace("T", " ")) + " CT" : ""}).</p></details></div>`;
}

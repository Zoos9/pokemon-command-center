// Paper Trading tab (2026-10-25). Data: papertrade table rows {id, kind, portfolio, date, data}.
import { esc, money, pct, dCT } from "./util.js";
const COLORS = ["#ffcb05", "#2ee6a6", "#3b9cff", "#ff3d7f", "#c86bff", "#ff9f1c", "#a9a3c9"];
const m2 = (x) => (x == null || isNaN(x) ? "—" : `$${(+x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const sgn = (x) => (x == null ? "" : x > 0 ? "up" : x < 0 ? "dn" : "");

function curve(eq, ports, start) {
  const dates = [...new Set(eq.map((e) => e.date))].sort();
  if (!dates.length) return `<p class="empty">No equity snapshots yet.</p>`;
  const W = 640, H = 220, P = 34;
  const vals = eq.map((e) => +e.data.equity).concat([start]);
  let lo = Math.min(...vals), hi = Math.max(...vals); if (hi - lo < 50) { lo -= 25; hi += 25; }
  const x = (d) => (dates.length === 1 ? W / 2 : P + ((W - P - 8) * dates.indexOf(d)) / (dates.length - 1));
  const y = (v) => 8 + (H - 30) * (1 - (v - lo) / (hi - lo));
  const lines = ports.map((p, i) => {
    const pts = eq.filter((e) => e.portfolio === p.id).sort((a, b) => (a.date < b.date ? -1 : 1));
    const c = COLORS[i % COLORS.length];
    return `<polyline fill="none" stroke="${c}" stroke-width="2.5" points="${pts.map((e) => `${x(e.date)},${y(+e.data.equity)}`).join(" ")}"/>` +
      pts.map((e) => `<circle cx="${x(e.date)}" cy="${y(+e.data.equity)}" r="3.5" fill="${c}"><title>${esc(p.name)} ${e.date}: ${m2(e.data.equity)}</title></circle>`).join("");
  }).join("");
  const base = `<line x1="${P}" x2="${W}" y1="${y(start)}" y2="${y(start)}" stroke="#8d86b5" stroke-dasharray="4 4"/><text x="2" y="${y(start) + 4}" fill="#8d86b5" font-size="11">${money(start)}</text>`;
  const ax = `<text x="${P}" y="${H - 4}" fill="#8d86b5" font-size="11">${dates[0]}</text><text x="${W - 8}" y="${H - 4}" fill="#8d86b5" font-size="11" text-anchor="end">${dates.at(-1)}</text>`;
  const leg = ports.map((p, i) => `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(p.name)}</span>`).join("");
  return `<svg class="ptcurve" viewBox="0 0 ${W} ${H}" role="img" aria-label="Equity curves">${base}${lines}${ax}</svg><div class="ptleg">${leg}</div>`;
}

const tradeRow = (t) => {
  const d = t.data;
  if (d.side === "sell") return `<tr><td>${esc(d.date)}</td><td><span class="ptside sell">SELL</span></td><td><b>${esc(d.card)}</b> <small>${esc(d.number || "")}</small></td>
    <td class="n">${m2(d.sale_price_usd)} − fees ${m2(d.ebay_fees_usd)} − ship ${m2(d.ship_out_usd)} = <b>${m2(d.net_proceeds_usd)}</b></td>
    <td class="n ${sgn(d.pnl_usd)}">${m2(d.pnl_usd)} (${pct(d.roi_pct, 1)})</td><td><small>${esc(d.reason)} · held ${d.held_days}d</small></td></tr>`;
  return `<tr><td>${esc(d.date)}</td><td><span class="ptside buy">BUY</span></td><td><b>${esc(d.card)}</b> <small>${esc(d.number || "")}</small>${d.listing_url ? ` <a class="link" href="${esc(d.listing_url)}" target="_blank" rel="noopener">listing ↗</a>` : ""}</td>
    <td class="n">${m2(d.item_usd)} + ship ${m2(d.shipping_usd)} + tax ${m2(d.tax_usd)} = <b>${m2(d.total_usd)}</b></td>
    <td class="n"><small>target ${m2(d.expected_target)}${d.expected_by ? " by " + esc(d.expected_by) : ""}${d.prediction?.zone_low != null ? `<br>zone ${m2(d.prediction.zone_low)}–${m2(d.prediction.zone_high)}` : ""}${d.prediction?.bottom_window ? `<br>bottom ${esc(d.prediction.bottom_window)}` : ""}</small></td>
    <td><small>${esc(d.reason)}<br>seller ${esc(d.seller || "?")} (${d.seller_feedback ?? "?"} · ${d.seller_feedback_pct ?? "?"}%)</small></td></tr>`;
};

export function vPaper(rows) {
  rows = rows || [];
  const ports = rows.filter((r) => r.kind === "portfolio").map((r) => r.data).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const trades = rows.filter((r) => r.kind === "trade").sort((a, b) => (a.data.ts < b.data.ts ? 1 : -1));
  const eq = rows.filter((r) => r.kind === "equity");
  if (!ports.length) return `<section class="hero"><h1 class="verdict">Paper Trading</h1><p class="sub">No paper-trading data synced yet.</p></section>`;
  const lb = ports.slice().sort((a, b) => b.equity - a.equity);
  const upd = rows.find((r) => r.kind === "portfolio")?.ts;
  const board = `<div class="ptscroll"><table class="tbl pttbl"><thead><tr><th>#</th><th>Strategy</th><th>Equity</th><th>ROI</th><th>vs control</th><th>Realized</th><th>Unrealized</th><th>Cash</th><th>Buys/Sells</th><th>Win rate</th><th>Prediction hit</th></tr></thead><tbody>${lb.map((p, i) => `<tr onclick="location.hash='#/paper/${encodeURIComponent(p.id)}'"><td>${i + 1}</td><td><b>${esc(p.name)}</b></td><td class="n"><b>${m2(p.equity)}</b></td><td class="n ${sgn(p.roi_pct)}">${pct(p.roi_pct, 2)}</td><td class="n ${sgn(p.roi_vs_control_pct)}">${p.strategy === "control" ? "—" : pct(p.roi_vs_control_pct, 2)}</td><td class="n ${sgn(p.realized_pnl)}">${m2(p.realized_pnl)}</td><td class="n ${sgn(p.unrealized_pnl)}">${m2(p.unrealized_pnl)}</td><td class="n">${m2(p.cash)}</td><td class="n">${p.n_buys}/${p.n_sells}</td><td class="n">${p.win_rate_pct == null ? "—" : pct(p.win_rate_pct).replace("+", "")}</td><td class="n">${p.pred_accuracy_pct == null ? `<small>${p.pred_matured} matured</small>` : pct(p.pred_accuracy_pct).replace("+", "") + ` <small>(${p.pred_matured})</small>`}</td></tr>`).join("")}</tbody></table></div>`;
  const sections = ports.map((p, i) => {
    const tr = trades.filter((t) => t.portfolio === p.id);
    const hold = p.holdings || [];
    return `<details class="panel ptport" data-k="pt-${esc(p.id)}" id="pt-${esc(p.id)}" ${location.hash === "#/paper/" + encodeURIComponent(p.id) ? "open" : ""}><summary><i class="ptdot" style="background:${COLORS[i % COLORS.length]}"></i><b>${esc(p.name)}</b> <span class="n">${m2(p.equity)}</span> <span class="n ${sgn(p.roi_pct)}">${pct(p.roi_pct, 2)}</span> <small>${hold.length} holdings · ${tr.length} trades</small></summary>
      <p class="sub">${esc(p.desc || "")}</p>
      <h3>Holdings</h3>${hold.length ? `<div class="ptscroll"><table class="tbl pttbl"><thead><tr><th>Item</th><th>Units</th><th>Cost (all-in)</th><th>Mark (sold)</th><th>Net if sold</th><th>Unrealized</th><th>Target</th></tr></thead><tbody>${hold.map((h) => `<tr onclick="location.hash='#/card/${encodeURIComponent(h.card_id)}'"><td><b>${esc(h.card)}</b> <small>${esc(h.number || "")}</small></td><td class="n">${h.units}</td><td class="n">${m2(h.cost_usd)}</td><td class="n">${m2(h.mark_usd)}<small class="src">${esc(h.mark_source || "")}</small></td><td class="n">${m2(h.net_value_usd)}</td><td class="n ${sgn(h.unrealized_usd)}">${m2(h.unrealized_usd)} (${pct(h.unrealized_pct, 1)})</td><td class="n">${m2(h.expected_target)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="empty">No open positions${p.strategy === "sealed_seasonal" ? " (buy window opens Nov 1)" : ""}.</p>`}
      <h3>Trades</h3>${tr.length ? `<div class="ptscroll"><table class="tbl pttbl pttr"><thead><tr><th>Date</th><th></th><th>Item</th><th>Price breakdown</th><th>Target / P&amp;L</th><th>Reason</th></tr></thead><tbody>${tr.map(tradeRow).join("")}</tbody></table></div>` : `<p class="empty">No trades yet.</p>`}
    </details>`;
  }).join("");
  return `<section class="hero"><h1 class="verdict">Paper Trading</h1><p class="sub">$5,000 fake money per strategy, filled at <b>real eBay listings</b> (item + ship + 6.5% tax, sellers 30+/90%+), marked at the sold median minus eBay fees 13.25% + $0.40 and shipping. Updated ${dCT(upd)}.</p></section>
  <section class="panel"><h2>🏆 Leaderboard</h2>${board}</section>
  <section class="panel"><h2>📈 Equity</h2>${curve(eq, ports, 5000)}</section>
  ${sections}
  <p class="sub"><small>Rules: buys only at a real active listing, one unit per listing, max 20% of equity per item. Every buy records its reason, expected target and the predicted bottom so predictions get scored.</small></p>`;
}

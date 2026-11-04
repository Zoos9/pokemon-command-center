// Long-history analog timing (watchlist analog_history, research/analog_backtest.py, method analog-v1). Display only:
// never changes DEAL/WATCH, alerts, buy_below (70% of reference) or paper trades. "analog est." = past-set PriceCharting monthly paths.
import { esc } from "./util.js";
import { spark } from "./charts.js";
const n = (v) => (v == null || isNaN(+v) ? null : +v);
export function anaFor(w) {
  const a = w?.analog_history ?? w?.data?.analog_history ?? null;
  if (!a || !a.method) return null;
  return { eligible: a.eligible === true, note: a.note || "", pool: a.pool || null, stage: a.stage || null, ms: n(a.months_since_release), release: a.release || null,
    bm: n(a.analog_bottom_month), bmLo: n(a.analog_bottom_month_p25), bmHi: n(a.analog_bottom_month_p75), start: a.expected_bottom_start || null, end: a.expected_bottom_end || null,
    depth: n(a.analog_depth_median_pct), r12: n(a.analog_12m_net_from_bottom), r12Lo: n(a.analog_12m_net_from_bottom_p25), r12Hi: n(a.analog_12m_net_from_bottom_p75),
    atStage: n(a.analog_12m_net_at_stage), atStage70: n(a.analog_12m_net_at_stage_fill70), nAna: n(a.n_analogs), knife: a.long_falling_knife === true,
    s1: n(a.own_slope_1m_pct), s3: n(a.own_slope_3m_pct), pts: n(a.history_points) || 0, monthly: Array.isArray(a.monthly) ? a.monthly : [], url: a.history_url || null,
    histNote: a.history_note || null, asOf: a.as_of || null, method: a.method };
}
const x2 = (v) => (v == null ? "—" : v.toFixed(2) + "×");
const mo = (s) => (s ? s.slice(0, 7) : "—");
const STAGE_CLS = { "before typical bottom": "pre", "in typical bottom window": "in", "past typical bottom": "past", "pre-release": "pre" };
export const anaBadge = (a) => (!a || !a.stage ? "" : `<span class="ana ${STAGE_CLS[a.stage] || ""}" title="${esc(a.note)}">📈 ${esc(a.stage)}</span>`);
// Card page panel.
export function anaPanel(a) {
  if (!a) return "";
  if (!a.eligible) return `<section class="panel anap"><h2>📈 Long history <span class="sugg">analog est.</span></h2><p class="empty">${esc(a.note || "No analog estimate yet.")}</p></section>`;
  const vals = a.monthly.map((p) => +p[1]).filter((v) => !isNaN(v));
  const own = a.pts >= 2 ? `<p class="anah">${spark(vals, 180, 34, a.knife ? "#ff4d4d" : "#3ba7ff")} <small>own monthly price, ${a.pts} months (${esc(mo(a.monthly[0]?.[0]))} → ${esc(mo(a.monthly.at(-1)?.[0]))})${a.s1 != null ? ` · ${a.s1 >= 0 ? "+" : ""}${a.s1}% last month` : ""}${a.s3 != null ? ` · ${a.s3 >= 0 ? "+" : ""}${a.s3}%/mo over 3` : ""}${a.url ? ` · <a href="${esc(a.url)}" target="_blank" rel="noopener">PriceCharting ↗</a>` : ""}</small></p>`
    : `<p class="anah"><small>${esc(a.histNote || "No long price history for this row yet.")}</small></p>`;
  return `<section class="panel anap"><h2>📈 Long history <span class="sugg">analog est.</span> ${anaBadge(a)}${a.knife ? ` <span class="kn" title="own monthly price still falling fast">🔪 still falling</span>` : ""}</h2>
  <div class="anag"><div><small>MONTHS SINCE RELEASE</small><b>${a.ms ?? "—"}</b></div><div><small>TYPICAL BOTTOM</small><b>month ${a.bm != null ? Math.round(a.bm) : "—"}</b><small>middle half ${a.bmLo != null ? Math.round(a.bmLo) : "—"}-${a.bmHi != null ? Math.round(a.bmHi) : "—"} · ${esc(mo(a.start))} → ${esc(mo(a.end))}</small></div>
  <div><small>TYPICAL DEPTH</small><b>${a.depth == null ? "—" : Math.round(a.depth) + "%"}</b><small>bottom vs launch month</small></div><div><small>12 MO FROM BOTTOM</small><b>${x2(a.r12)}</b><small>net after fees/tax · ${x2(a.r12Lo)}-${x2(a.r12Hi)}</small></div>
  <div><small>BUY AT THIS STAGE</small><b>${x2(a.atStage)}</b><small>12-mo net at market · ${x2(a.atStage70)} at a 70% fill</small></div></div>
  ${own}<p class="note">${esc(a.note)} Pool: ${esc(a.pool || "")}, ${a.nAna ?? "—"} analogs. Display only; Deal/Watch alerts and buy_below are unchanged${a.asOf ? ` (${esc(a.asOf)})` : ""}.</p></section>`;
}

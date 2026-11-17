// 2026-11-17 pipeline health banner + stale-active-listings guard (mirrors scanner/health_check.py, method pipeline-health-v1).
// Ages are computed here from timestamps with the browser clock, so the banner turns red even when the box is down and
// nothing new is being pushed (the 2026-11-15 -> 11-17 outage showed 2-day-old asks as if current).
import { esc } from "./util.js";
export const ACTIVE_STALE_H = 6;
// [amber_h, red_h] per stage: active scans every 2 h, sold refresh 3x/day, paper trading nightly, sync after every scan.
export const BANDS = { active_scan: [6, 24], sold_merge: [36, 72], paper_trading: [30, 72], last_sync: [6, 24] };
const LABEL = { active_scan: "listings scan", sold_merge: "sold refresh", paper_trading: "paper trading", last_sync: "dashboard sync" };
const TZ = "America/Chicago";
const ms = (iso) => { const t = Date.parse(iso || ""); return isNaN(t) ? null : t; };
const newest = (xs) => xs.map(ms).filter((t) => t != null).sort((a, b) => a - b).at(-1) ?? null;
const ageTxt = (h) => (h == null ? "never" : h < 1 ? `${Math.max(1, Math.round(h * 60))}m ago` : h < 72 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`);
const when = (t) => (t == null ? "never" : new Date(t).toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " CT");

// Per card: listings snapshot older than 6 h, missing, or that card's last scan failed (scanner/health_check.active_freshness).
export const activeStale = (c, now = Date.now()) => { const t = ms(c?.scanned_at); return t == null || now - t > ACTIVE_STALE_H * 3600e3 || !!c?.activeFresh?.scan_failed; };

// { overall, items: [{key,label,t,ageH,status}], staleActiveN, n } from the pushed health row (sync_meta.pipeline_health)
// with card / paper-trade fallbacks so it still works before the first health push.
export function healthModel({ health = null, cards = [], paper = [] } = {}, now = Date.now()) {
  const h = health || {};
  const ts = {
    active_scan: newest(cards.map((c) => c.scanned_at)) ?? newest([h.active_scan?.ts]),   // cards first: what the screen actually shows
    sold_merge: newest([h.sold_merge?.ts, ...cards.map((c) => c.fresh?.last_sold_refresh)]),
    paper_trading: newest([h.paper_trading?.ts, ...(paper || []).map((p) => p.ts)]),
    last_sync: newest([h.synced_at, h.last_sync?.ts]),
  };
  const items = Object.keys(BANDS).map((key) => { const t = ts[key], ageH = t == null ? null : (now - t) / 3600e3, [a, r] = BANDS[key];
    return { key, label: LABEL[key], t, ageH, status: ageH == null || ageH > r ? "red" : ageH > a ? "amber" : "ok" }; });
  const rank = { ok: 0, amber: 1, red: 2 };
  const overall = items.reduce((w, i) => (rank[i.status] > rank[w] ? i.status : w), "ok");
  return { overall, items, staleActiveN: cards.filter((c) => activeStale(c, now)).length, n: cards.length };
}

export function healthBanner(m) {
  if (!m || m.overall === "ok") return "";
  const bad = m.items.filter((i) => i.status !== "ok");
  const act = m.items.find((i) => i.key === "active_scan");
  const parts = bad.map((i) => `<span class="${i.status}"><b>${esc(i.label)}</b> ${esc(ageTxt(i.ageH))} <small>(${esc(when(i.t))})</small></span>`).join(" · ");
  const head = m.overall === "red" ? "⛔ Data is out of date" : "⚠ Data is getting old";
  const tail = act && act.status !== "ok"
    ? ` Prices below are from the last scan, not live. Deals on ${m.staleActiveN}/${m.n} cards with listings older than ${ACTIVE_STALE_H} h are held as Watch.`
    : " Listings are current; Deals on cards with stale sold comps are held as Watch.";
  return `<div class="hban ${m.overall}" role="${m.overall === "red" ? "alert" : "status"}"><b>${head}:</b> ${parts}.${esc(tail)}</div>`;
}

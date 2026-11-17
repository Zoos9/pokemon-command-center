// Data layer: one interface, two adapters (Supabase or local JSON), selected by config.js.
import { CONFIG } from "./cfg.js";
import { mapRow } from "./fields.js";
import { createLocal } from "./adapters/local.js";

let adapter;
export async function init() {
  if (CONFIG.BACKEND === "supabase") {
    const { createSupabase } = await import("./adapters/supabase.js");
    adapter = await createSupabase();
  } else adapter = createLocal();
  return adapter;
}
export const backend = () => adapter;
const load = (k) => async () => (await adapter.fetchTable(k)).map((r) => mapRow(k, r));

export const getWatchlist = load("watchlist");
export const getSoldSales = load("sold_sales");
export const getActiveSnapshot = load("active_snapshot");
export const getScans = load("scans");
export const getAlerts = load("alerts");
export const getFeed = load("feed");
export const getResearchCalls = load("research_calls");
export const getCardHistory = load("card_history");
export const getReports = load("reports");
export const getPaperTrade = load("papertrade");
// 2026-11-17 pipeline health row (sync_meta key pipeline_health; scanner/health_check.py). Null when unavailable.
export const getHealth = async () => { try { const r = await adapter.fetchTable("health"); return (Array.isArray(r) ? r[0] : r) || null; } catch (e) { console.warn("health", e.message || e); return null; } };
export const subscribeFeed = (cb) => adapter.subscribe("feed", (rows) => cb(rows.map((r) => mapRow("feed", r))));
export const subscribeAlerts = (cb) => adapter.subscribe("alerts", (rows) => cb(rows.map((r) => mapRow("alerts", r))));
// Fires when active_snapshot / scans / watchlist change (Supabase realtime). Local adapter: no-op (app polls).
export const subscribeData = (cb) => (adapter.onDataChange ? adapter.onDataChange(cb) : () => {});

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
export const subscribeFeed = (cb) => adapter.subscribe("feed", (rows) => cb(rows.map((r) => mapRow("feed", r))));
export const subscribeAlerts = (cb) => adapter.subscribe("alerts", (rows) => cb(rows.map((r) => mapRow("alerts", r))));
// Fires when active_snapshot / scans / watchlist change (Supabase realtime). Local adapter: no-op (app polls).
export const subscribeData = (cb) => (adapter.onDataChange ? adapter.onDataChange(cb) : () => {});

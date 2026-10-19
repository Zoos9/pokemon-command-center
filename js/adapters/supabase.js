// Production adapter: wraps Pokemon Lead's window.PokeData (js/pokedata.js, copied from site/js/data.js).
// Realtime (postgres_changes) on feed, alerts, active_snapshot, scans, watchlist, with 30s polling as backup.
import { CONFIG } from "../cfg.js";
const load = (src) => new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => bad(new Error("failed to load " + src)); document.head.appendChild(s); });

export async function createSupabase() {
  if (!window.supabase) await load("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js");
  if (!window.PokeData) await load("js/pokedata.js");
  const P = window.PokeData, sb = P.client;
  const all = async (table, cols = "*", order = null) => {      // paged full-table read (bulk views need every card)
    const out = []; const page = 1000;
    for (let from = 0; ; from += page) {
      let q = sb.from(table).select(cols).range(from, from + page - 1);
      if (order) q = q.order(order, { ascending: true });
      const { data, error } = await q; if (error) throw error;
      out.push(...(data || [])); if (!data || data.length < page) break;
    }
    return out;
  };
  const fetchers = {
    watchlist: () => all("watchlist", "*", "sort_order"),
    sold_sales: () => all("sold_sales", "card_id,item_id,sold_date,price_usd,title,url,seller,seller_feedback,condition", "sold_date"),
    active_snapshot: () => all("active_snapshot", "card_id,scanned_at,ebay_total,reputable_count,bin_count,auction_count,lowest_total,lowest_reputable,listings,auctions_ending_soon"),
    scans: async () => (await P.scans(20)).reverse(),
    alerts: async () => (await P.alerts(200)).reverse(),
    feed: async () => (await P.feed(300)).reverse(),
    research_calls: async () => (await P.researchCalls()).reverse(),
    card_history: () => all("card_history", "*", "date"),
    reports: () => all("reports", "id,name,date,kind,markdown", "date"),
  };

  // --- live updates: one channel, debounced per group, polling backup. Identical results are dropped
  // (signature check) so a realtime event + the next poll never cause two renders.
  const subs = { feed: new Set(), alerts: new Set(), data: new Set() }, sig = {}, timers = {};
  const refresh = async (k) => {
    if (k === "data") { subs.data.forEach((cb) => cb()); return; }
    try { const rows = await fetchers[k](); const s = rows.length + "|" + JSON.stringify(rows.at(-1) ?? null);
      if (s === sig[k]) return; sig[k] = s; subs[k].forEach((cb) => cb(rows)); } catch (e) { console.warn(k, e.message || e); }
  };
  const bump = (k, ms = 400) => { clearTimeout(timers[k]); timers[k] = setTimeout(() => refresh(k), ms); };
  let started = false;
  const start = () => {
    if (started) return; started = true;
    const ch = sb.channel("cc-live");
    for (const t of ["feed", "alerts", "active_snapshot", "scans", "watchlist"])
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => bump(t === "feed" || t === "alerts" ? t : "data", t === "active_snapshot" ? 1500 : 400));
    ch.subscribe((status) => { if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn("realtime:", status, "(polling continues)"); });
    setInterval(() => { refresh("feed"); refresh("alerts"); }, CONFIG.POLL_MS);   // backup poll
  };
  return {
    kind: "supabase", needsAuth: true,
    fetchTable: (k) => { if (!fetchers[k]) throw new Error("unknown table " + k); return fetchers[k](); },
    subscribe: (k, cb) => { subs[k].add(cb); start(); refresh(k); return () => subs[k].delete(cb); },
    onDataChange: (cb) => { subs.data.add(cb); start(); return () => subs.data.delete(cb); },
    session: () => P.auth.session(),
    hasAccess: () => P.auth.hasAccess(),
    signIn: (email) => P.auth.sendMagicLink(email),
    signOut: () => P.auth.signOut(),
    onAuth: (cb) => P.auth.onChange(cb),
  };
}

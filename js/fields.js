// ONE place mapping app fields -> Supabase columns (confirmed schema, 2026-10-19).
// The local dev export (tools/export_snapshot.py) writes identical column names, so this applies to both backends.
export const TABLES = {
  watchlist:       { fields: { id: "id", name: "name", set: "set_name", number: "number", rarity: "rarity", language: "language", buy_below: "buy_below", sell_above: "sell_above", sold: "sold", sort_order: "sort_order",
    // reference price (migration reference_price); buy_below = manual if set, else auto
    reference: "reference", sold_median_recent: "sold_median_recent", sold_window_days: "sold_window_days", sold_n: "sold_n", active_p25: "active_p25", active_n: "active_n", k: "k",
    auto_buy_below: "auto_buy_below", manual_buy_below: "manual_buy_below", target_source: "target_source", flags: "flags", sold_trend_7d_pct: "sold_trend_7d_pct", reference_updated_at: "reference_updated_at", target_pct: "target_pct", target_source_kind: "target_source_kind",
    // TREND (Alert Desk, migration 20261019_trend_tier; names confirmed). No daily series column yet -> curve derived from sold_sales (labelled).
    // App keys = column names (post-trim, canonical). Never recompute these client-side.
    trend_slope_pct_day: "trend_slope_pct_day", pct_off_peak: "pct_off_peak", trend_accel_pct_day: "trend_accel_pct_day", phase: "phase", fair_now: "fair_now",
    median_3d: "median_3d", median_3d_n: "median_3d_n", median_7d: "median_7d", median_7d_n: "median_7d_n", median_14d: "median_14d", median_14d_n: "median_14d_n",
    median_since_release: "median_since_release", median_since_release_n: "median_since_release_n",
    // Post-trim daily history jsonb [{date, n, median, roll3_median}], oldest first; n=0 days have median null. Primary chart source.
    daily_history: "daily_history",
    peak_median: "peak_median", peak_date: "peak_date", trend_since: "trend_since", trend_window_days: "trend_window_days", trend_n: "trend_n", trend_line_today: "trend_line_today", fair_now_capped: "fair_now_capped",
    peak_n: "peak_n", outliers_trimmed: "outliers_trimmed", sold_7d_median: "sold_7d_median", sold_7d_n: "sold_7d_n",
    // canonical research call (migration 20261019_canon_research) — primary source for the bottom view; research_calls is the fallback
    research_call_id: "research_call_id", research_date: "research_date", research_zone_low: "research_zone_low", research_zone_high: "research_zone_high", research_confidence: "research_confidence",
    research_reason: "research_reason", research_falling_knife: "research_falling_knife", research_expected_bottom_window: "research_expected_bottom_window", research_expected_bottom_start: "research_expected_bottom_start",
    research_expected_bottom_end: "research_expected_bottom_end", research_bottom_centre: "research_bottom_centre", research_phase: "research_phase", research_kind: "research_kind", research_method: "research_method",
    research_category: "research_category", research_zone_method: "research_zone_method" } },
  sold_sales:      { fields: { card_id: "card_id", item_id: "item_id", price: "price_usd", sold_date: "sold_date", condition: "condition", title: "title", url: "url", seller: "seller", seller_feedback: "seller_feedback" } },
  active_snapshot: { fields: { card_id: "card_id", scanned_at: "scanned_at", ebay_total: "ebay_total", reputable_count: "reputable_count", bin_count: "bin_count", auction_count: "auction_count", lowest_total: "lowest_total", lowest: "lowest_reputable", listings: "listings",
    // fallbacks for the lowest listing when its jsonb lacks the per-listing fields
    lowest_item_usd: "lowest_item_usd", lowest_shipping_usd: "lowest_shipping_usd", lowest_tax_rate: "lowest_tax_rate", lowest_tax_usd: "lowest_tax_usd", lowest_total_with_tax_usd: "lowest_total_with_tax_usd", lowest_tax_note: "lowest_tax_note", auctions_ending_soon: "auctions_ending_soon" } },
  scans:           { fields: { ts: "ts", cards_scanned: "cards_scanned", cards_requested: "cards_requested", errors: "errors", calls_today: "calls_today", daily_limit: "daily_limit" } },
  alerts:          { fields: { ts: "ts", card_id: "card_id", card: "card", number: "number", language: "language", price_kind: "price_kind", direction: "direction", value: "value", target: "target", link: "link", data: "data",
    item_usd: "item_usd", shipping_usd: "shipping_usd", tax_rate: "tax_rate", tax_usd: "tax_usd", total_with_tax_usd: "total_with_tax_usd", tax_note: "tax_note", alert_text: "alert_text", status: "status", status_reason: "status_reason", status_checked_at: "status_checked_at", flags: "flags",
    tier: "tier" /* DEAL | WATCH; null = legacy -> DEAL */, tier_reason: "tier_reason", phase: "phase", zone_low: "zone_low", zone_high: "zone_high", zone_call_date: "zone_call_date", zone_distance_pct: "zone_distance_pct", zone_pct_vs_low: "zone_pct_vs_low", zone_pct_vs_high: "zone_pct_vs_high", zone_mid: "zone_mid", deal_ceiling: "deal_ceiling", research_call_id: "research_call_id", research_confidence: "research_confidence", research_falling_knife: "research_falling_knife", research_bottom_window: "research_bottom_window" } },
  feed:            { fields: { ts: "ts", from: "from_bot", to: "to_bot", type: "type", text: "text" } },
  research_calls:  { fields: { date: "date", card_id: "card_id", card: "card", call: "call", prediction: "prediction", confidence: "confidence", phase: "phase", zone_low: "zone_low", zone_high: "zone_high", buy_below: "buy_below", status: "status", data: "data", evidence_links: "evidence_links", review_by: "review_by" } },
  card_history:    { fields: { ts: "ts", date: "date", card_id: "card_id", median_7d: "median_7d", median_30d: "median_30d", sales_7d: "sales_7d", sales_30d: "sales_30d", last_sale: "last_sale", trend: "trend", active_count: "active_reputable_count", ebay_total: "ebay_total", lowest_ask: "lowest_reputable_ask", ask_vs_median_7d_pct: "ask_vs_median_7d_pct", outliers_dropped: "outliers_dropped" } },
  reports:         { fields: { id: "id", title: "name", date: "date", kind: "kind", body: "markdown" } },
};
// Listing objects inside active_snapshot.lowest_reputable / listings[] / auctions_ending_soon[].
// `image` exists in the data but is deliberately NOT mapped (seller photos of copyrighted card art).
export const LISTING = { item_id: "item_id", title: "title", url: "url", total: "total", price: "price", shipping: "shipping", shipping_unknown: "shipping_unknown",
  seller: "seller", feedback: "seller_feedback", feedback_pct: "seller_feedback_pct", condition: "condition", condition_id: "condition_id",
  // All-in price fields (Alert Desk, migration 20261019_tax_fields). `total` stays item + shipping.
  item_usd: "item_usd", shipping_usd: "shipping_usd", tax_rate: "tax_rate", tax_usd: "tax_usd", total_with_tax_usd: "total_with_tax_usd", tax_note: "tax_note",
  is_auction: "is_auction", bids: "bids", end_date: "end_date", buying_options: "buying_options", location: "location", flags: "flags" };

export function mapRow(key, row) { const f = TABLES[key].fields, o = {}; for (const k in f) o[k] = row[f[k]] ?? null; return o; }
export function mapListing(l) { if (!l) return null; const o = {}; for (const k in LISTING) o[k] = l[LISTING[k]] ?? null; return o; }

// Alert columns -> listing-shaped price object for the price button (raw `data` only as a fallback for old rows).
const PF = ["item_usd", "shipping_usd", "tax_rate", "tax_usd", "total_with_tax_usd", "tax_note"];
export function alertPrice(a) {
  const d = a.data || {}, o = {};
  for (const k of PF) o[k] = a[k] ?? d[LISTING[k]] ?? null;
  const hasNew = PF.some((k) => k in a && a[k] !== undefined) || "item_usd" in d;
  return { ...o, has_price_fields: hasNew, total: a.price_kind === "lowest_active" ? a.value : null, price: d.price ?? null, shipping: d.shipping ?? null, shipping_unknown: d.shipping_unknown ?? null, item_id: d.item_id || a.card_id };
}
// Lowest listing: per-listing jsonb fields first, then the active_snapshot lowest_* columns.
export function withLowestFallback(l, snap) {
  if (!l) return l;
  const o = { ...l };
  for (const k of PF) if (o[k] == null && snap["lowest_" + k] != null) o[k] = snap["lowest_" + k];
  return o;
}
// Only status 'active' alerts are live. Null/missing status = legacy row (pre-status column), treated as active.
export const alertActive = (a) => a.status == null || a.status === "active";

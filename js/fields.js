// ONE place mapping app fields -> Supabase columns (confirmed schema, 2026-10-19).
// The local dev export (tools/export_snapshot.py) writes identical column names, so this applies to both backends.
export const TABLES = {
  watchlist:       { fields: { id: "id", name: "name", set: "set_name", number: "number", rarity: "rarity", language: "language", buy_below: "buy_below", sell_above: "sell_above", sold: "sold", sort_order: "sort_order" } },
  sold_sales:      { fields: { card_id: "card_id", item_id: "item_id", price: "price_usd", sold_date: "sold_date", condition: "condition", title: "title", url: "url", seller: "seller", seller_feedback: "seller_feedback" } },
  active_snapshot: { fields: { card_id: "card_id", scanned_at: "scanned_at", ebay_total: "ebay_total", reputable_count: "reputable_count", bin_count: "bin_count", auction_count: "auction_count", lowest_total: "lowest_total", lowest: "lowest_reputable", listings: "listings", auctions_ending_soon: "auctions_ending_soon" } },
  scans:           { fields: { ts: "ts", cards_scanned: "cards_scanned", cards_requested: "cards_requested", errors: "errors", calls_today: "calls_today", daily_limit: "daily_limit" } },
  alerts:          { fields: { ts: "ts", card_id: "card_id", card: "card", number: "number", language: "language", price_kind: "price_kind", direction: "direction", value: "value", target: "target", link: "link" } },
  feed:            { fields: { ts: "ts", from: "from_bot", to: "to_bot", type: "type", text: "text" } },
  research_calls:  { fields: { date: "date", card_id: "card_id", card: "card", call: "call", prediction: "prediction", confidence: "confidence", phase: "phase", zone_low: "zone_low", zone_high: "zone_high", buy_below: "buy_below", evidence_links: "evidence_links", review_by: "review_by" } },
  card_history:    { fields: { ts: "ts", date: "date", card_id: "card_id", median_7d: "median_7d", median_30d: "median_30d", sales_7d: "sales_7d", sales_30d: "sales_30d", last_sale: "last_sale", trend: "trend", active_count: "active_reputable_count", ebay_total: "ebay_total", lowest_ask: "lowest_reputable_ask", ask_vs_median_7d_pct: "ask_vs_median_7d_pct", outliers_dropped: "outliers_dropped" } },
  reports:         { fields: { id: "id", title: "name", date: "date", kind: "kind", body: "markdown" } },
};
// Listing objects inside active_snapshot.lowest_reputable / listings[] / auctions_ending_soon[].
// `image` exists in the data but is deliberately NOT mapped (seller photos of copyrighted card art).
export const LISTING = { item_id: "item_id", title: "title", url: "url", total: "total", price: "price", shipping: "shipping", shipping_unknown: "shipping_unknown",
  seller: "seller", feedback: "seller_feedback", feedback_pct: "seller_feedback_pct", condition: "condition", condition_id: "condition_id",
  is_auction: "is_auction", bids: "bids", end_date: "end_date", buying_options: "buying_options", location: "location", flags: "flags" };

export function mapRow(key, row) { const f = TABLES[key].fields, o = {}; for (const k in f) o[k] = row[f[k]] ?? null; return o; }
export function mapListing(l) { if (!l) return null; const o = {}; for (const k in LISTING) o[k] = l[LISTING[k]] ?? null; return o; }

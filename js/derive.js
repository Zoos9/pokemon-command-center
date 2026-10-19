// Join raw tables into one card model + deal / radar logic. Pure functions, no DOM.
import { CONFIG } from "./cfg.js";
import { mapListing, withLowestFallback } from "./fields.js";
import { median, num } from "./util.js";

const short = (name) => { const m = (name || "").match(/^(.*?)\s*\((.*)\)\s*$/); return m ? [m[1], m[2].split(",")[0]] : [name || "?", ""]; };

// A call is hidden when withdrawn; status comes from the column or, for older rows, the raw data jsonb.
export const callStatus = (r) => String(r.status ?? r.data?.status ?? "active").toLowerCase();
export function buildModel(t) {
  // Defense in depth: only cards currently on the watchlist are shown; withdrawn calls are ignored.
  const watchIds = new Set(t.watchlist.map((w) => w.id));
  t = { ...t, calls: t.calls.filter((r) => callStatus(r) !== "withdrawn" && (r.card_id === "SET" || watchIds.has(r.card_id))),
    active: t.active.filter((r) => watchIds.has(r.card_id)), history: t.history.filter((r) => watchIds.has(r.card_id)),
    sold: t.sold.filter((r) => watchIds.has(r.card_id)) };
  const hist = {}; for (const r of t.history) if (!hist[r.card_id] || (r.ts || "") > (hist[r.card_id].ts || "")) hist[r.card_id] = r;
  const calls = {}; for (const r of t.calls) if (r.card_id && r.card_id !== "SET" && (!calls[r.card_id] || (r.date || "") >= (calls[r.card_id].date || ""))) calls[r.card_id] = r;
  const act = {}; for (const r of t.active) act[r.card_id] = r;
  const sales = {}; for (const s of t.sold) (sales[s.card_id] ||= []).push(s);
  const cards = t.watchlist.map((w) => {
    const h = hist[w.id] || {}, c = calls[w.id] || {}, a = act[w.id] || {};
    const ss = (sales[w.id] || []).filter((s) => num(s.price) != null).sort((x, y) => (x.sold_date > y.sold_date ? 1 : -1));
    const byDay = {}; for (const s of ss) (byDay[s.sold_date] ||= []).push(+s.price);
    const daily = Object.keys(byDay).sort().map((d) => [d, median(byDay[d])]);
    let med7 = num(h.median_7d) ?? num(w.sold?.median);
    if (med7 == null && ss.length) { const last = new Date(ss.at(-1).sold_date); med7 = median(ss.filter((s) => (last - new Date(s.sold_date)) / 864e5 <= 7).map((s) => +s.price)); }
    const sug = { phase: c.phase ? String(c.phase).toLowerCase() : null, low: num(c.zone_low), high: num(c.zone_high), buy: num(c.buy_below), conf: c.confidence || null, prediction: c.prediction || null, review_by: c.review_by || null, links: c.evidence_links || [], call: c.call || null, date: c.date || null };
    const target = { buy: num(w.buy_below), sell: num(w.sell_above) };
    const lowest = withLowestFallback(mapListing(a.lowest), a); const listings = (a.listings || []).map(mapListing).filter(Boolean);
    const auctions = (a.auctions_ending_soon || []).map(mapListing).filter(Boolean).sort((x, y) => (x.end_date || "").localeCompare(y.end_date || ""));
    const lowestTotal = num(a.lowest_total) ?? lowest?.total ?? null;
    const effBuy = target.buy ?? sug.buy, src = target.buy != null ? "target" : sug.buy != null ? "suggested" : null;
    const [nm, variant] = short(w.name);
    return { id: w.id, name: nm, variant, full: w.name, number: w.number, lang: /jap/i.test(w.language || "") ? "JP" : "EN", rarity: w.rarity,
      target, sug, effBuy, src, med7, med30: num(h.median_30d), s7: num(h.sales_7d), s30: num(h.sales_30d), trend: h.trend || null,
      lastSale: h.last_sale || null, outliers: num(h.outliers_dropped), ebayTotal: num(h.ebay_total) ?? num(a.ebay_total), histDate: h.date || null, histCount: t.history.filter((r) => r.card_id === w.id).length, sales: ss, daily,
      lowest, lowestTotal, listings, auctions, binCount: num(a.bin_count), auctionCount: num(a.auction_count), scanned_at: a.scanned_at, activeCount: num(a.reputable_count) ?? num(h.active_count),
      dist: effBuy && med7 ? ((med7 - effBuy) / effBuy) * 100 : null,
      askVsMed: lowest?.total != null && med7 ? (lowest.total / med7 - 1) * 100 : null };
  });
  const setCall = t.calls.filter((r) => r.card_id === "SET").sort((x, y) => (x.date || "").localeCompare(y.date || "")).at(-1) || null;
  return { cards, byId: Object.fromEntries(cards.map((c) => [c.id, c])), setCall };
}

const okSeller = (l) => l && l.total != null && (l.feedback == null || +l.feedback >= CONFIG.MIN_SELLER_FEEDBACK);
// Flags that aren't about legitimacy (shipping just not quoted) are shown separately, not as warnings.
export const warnFlags = (l) => (l?.flags || []).filter((f) => !/shipping not quoted|auction, current bid/i.test(f));
export function deals(cards) {
  const anyTargets = cards.some((c) => c.target.buy != null || c.target.sell != null);
  const confirmed = cards.filter((c) => c.target.buy != null && okSeller(c.lowest) && c.lowest.total <= c.target.buy).sort((a, b) => a.lowest.total / a.target.buy - b.lowest.total / b.target.buy);
  const sellNow = cards.filter((c) => c.target.sell != null && c.med7 != null && c.med7 >= c.target.sell);
  const sugAll = cards.filter((c) => c.target.buy == null && c.sug.buy != null && okSeller(c.lowest) && c.lowest.total <= c.sug.buy);
  const suggested = sugAll.filter((c) => c.med7 >= CONFIG.MIN_CARD_VALUE && c.sug.buy < c.med7).sort((a, b) => a.lowest.total / a.sug.buy - b.lowest.total / b.sug.buy);
  const bulk = sugAll.filter((c) => !suggested.includes(c));
  const closest = cards.filter((c) => c.effBuy && c.lowest?.total != null && c.med7 >= CONFIG.MIN_CARD_VALUE && !confirmed.includes(c) && !suggested.includes(c))
    .map((c) => ({ c, gap: (c.lowest.total / c.effBuy - 1) * 100 })).sort((a, b) => a.gap - b.gap)[0] || null;
  return { anyTargets, confirmed, sellNow, suggested, bulk, closest };
}

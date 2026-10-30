// Join raw tables into one card model + deal / radar logic. Pure functions, no DOM.
import { CONFIG } from "./cfg.js";
import { mapListing, withLowestFallback, pick } from "./fields.js";
import { median, num } from "./util.js";
import { roiFor, upsideFor, exitFor, retailFor, DEFAULT_FEES } from "./roi.js";

const short = (name) => { const m = (name || "").match(/^(.*?)\s*\((.*)\)\s*$/); return m ? [m[1], m[2].split(",")[0]] : [name || "?", ""]; };

// A call is hidden when withdrawn; status comes from the column or, for older rows, the raw data jsonb.
export const callStatus = (r) => String(r.status ?? r.data?.status ?? "active").toLowerCase();
function trimSales(ss) {
  if (!ss.length) return ss;
  const m = median(ss.map((s) => +s.price));
  const a = ss.filter((s) => +s.price >= 0.33 * m && +s.price <= 3 * m);
  return a.filter((s, i) => { const t = Date.parse(s.sold_date); const nb = a.filter((o, j) => j !== i && Math.abs(Date.parse(o.sold_date) - t) <= 3 * 864e5).map((o) => +o.price);
    if (nb.length < 3) return true; const mm = median(nb); return +s.price >= 0.33 * mm && +s.price <= 3 * mm; });
}
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
    const kept = trimSales(ss);   // chart only: same rule as scanner/trend.py (0.33x–3x whole-history, then centred ±3d band)
    const byDay = {}; for (const s of kept) (byDay[s.sold_date] ||= []).push(+s.price);
    const daily = Object.keys(byDay).sort().map((d) => [d, median(byDay[d])]);
    const med7 = num(w.median_7d) ?? num(h.median_7d) ?? num(w.sold?.median);   // canonical post-trim first; no client recompute
    const rz = w.research_zone_low != null && w.research_zone_high != null;  // watchlist research_* is primary, research_calls fallback
    const sug = { phase: (w.research_phase || c.phase) ? String(w.research_phase || c.phase).toLowerCase() : null, low: rz ? num(w.research_zone_low) : num(c.zone_low), high: rz ? num(w.research_zone_high) : num(c.zone_high), buy: num(c.buy_below), conf: (rz && w.research_confidence) || c.confidence || null,
      kind: rz ? w.research_kind || null : null, centre: rz ? num(w.research_bottom_centre) : null, knife: w.research_falling_knife === true, wStart: w.research_expected_bottom_start || null, wEnd: w.research_expected_bottom_end || null,
      wText: w.research_expected_bottom_window || null, category: w.research_category || null, method: w.research_zone_method || null, zoneSrc: rz ? "watchlist" : c.zone_low != null ? "research_calls" : null, prediction: c.prediction || null, review_by: c.review_by || null, window: null, reason: (rz && w.research_reason) || null, dataStatus: w.research_data_status || null, insuff: w.research_insufficient_reason || (/insufficient/i.test(w.research_data_status || "") ? "insufficient data (no reason given)" : null), noteAt: w.research_note_updated_at || null, links: c.evidence_links || [], call: c.call || null, date: c.date || null };
    const target = { buy: num(w.buy_below), sell: num(w.sell_above) };
    const lowest = withLowestFallback(mapListing(a.lowest), a); const listings = (a.listings || []).map(mapListing).filter(Boolean);
    const auctions = (a.auctions_ending_soon || []).map(mapListing).filter(Boolean).sort((x, y) => (x.end_date || "").localeCompare(y.end_date || ""));
    const lowestTotal = num(a.lowest_total) ?? lowest?.total ?? null;
    const effBuy = target.buy ?? sug.buy, src = target.buy != null ? "target" : sug.buy != null ? "suggested" : null;
    const ref = { reference: num(w.reference), soldMed: num(w.sold_median_recent), win: num(w.sold_window_days), soldN: num(w.sold_n), p25: num(w.active_p25), activeN: num(w.active_n), k: num(w.k),
      sourceText: w.target_source || null, auto: num(w.auto_buy_below), manual: num(w.manual_buy_below), source: w.target_source || null, trend7: num(w.sold_trend_7d_pct), updated: w.reference_updated_at || null, pct: num(w.target_pct), kind: w.target_source_kind || null, fair: num(w.fair_now), fairCapped: w.fair_now_capped === true, lineToday: num(w.trend_line_today),
      leading: num(pick(w, "leading_ask_ref")), undercutN: num(w.undercut_n), undercutShare: num(w.undercut_share), competitiveN: num(pick(w, "competitive_n")), asksTotalN: num(pick(w, "asks_total_n")), askFloor: num(w.ask_floor), staleN: num(w.stale_n), p10: num(w.active_p10) };
    const wflags = Array.isArray(w.flags) ? w.flags : [];
    const dh = Array.isArray(w.daily_history) && w.daily_history.length ? w.daily_history : null;
    const rpk = num(w.research_robust_peak), fn = num(w.fair_now);
    const trendData = { daily: dh, slope: num(w.trend_slope_pct_day), off_peak: rpk != null && fn != null ? Math.round((fn / rpk - 1) * 1000) / 10 : num(w.pct_off_peak), peakSrc: rpk != null ? "research robust peak" : "trend peak", off_peak_trend: num(w.pct_off_peak), accel: num(w.trend_accel_pct_day), phase: w.phase || null, trimmedN: ss.length - kept.length, fair_now: num(w.fair_now), peak: rpk ?? num(w.peak_median), peak_date: rpk != null ? w.research_robust_peak_date : w.peak_date || null, win: num(w.trend_window_days), n: num(w.trend_n), line_today: num(w.trend_line_today), peak_n: num(w.peak_n), zone_mid: num(w.zone_mid), deal_ceiling: num(w.deal_ceiling), ceil_basis: w.deal_ceiling_basis || null, outliers: num(w.outliers_trimmed), s7med: num(w.sold_7d_median), s7n: num(w.sold_7d_n), postPeakSlope: num(pick(w, "post_peak_slope")), slopeBasis: w.slope_basis || null };
    const [nm, variant] = short(w.name);
    return { id: w.id, name: nm, variant, full: w.name, number: w.number, lang: /jap/i.test(w.language || "") ? "JP" : "EN", rarity: w.rarity,
      target, sug, effBuy, src, ref, wflags, trendData, med7, med30: num(h.median_30d), s7: num(h.sales_7d), s30: num(h.sales_30d), trend: h.trend || null,
      lastSale: h.last_sale || null, outliers: num(h.outliers_dropped), ebayTotal: num(h.ebay_total) ?? num(a.ebay_total), histDate: h.date || null, histCount: t.history.filter((r) => r.card_id === w.id).length, sales: ss, daily,
      lowest, lowestTotal, listings, auctions, binCount: num(a.bin_count), auctionCount: num(a.auction_count), scanned_at: a.scanned_at, synced_at: w.synced_at || null, trendAt: w.trend_changed_at || null, refAt: w.reference_updated_at || null, activeCount: num(a.reputable_count) ?? num(h.active_count),
      dist: effBuy && med7 ? ((med7 - effBuy) / effBuy) * 100 : null,
      askVsMed: lowest?.total != null && med7 ? (lowest.total / med7 - 1) * 100 : null };
  });
  for (const c of cards) c.roi = roiOf(c, t.watchlist.find((w) => w.id === c.id));
  const setCall = t.calls.filter((r) => r.card_id === "SET").sort((x, y) => (x.date || "").localeCompare(y.date || "")).at(-1) || null;
  return { cards, byId: Object.fromEntries(cards.map((c) => [c.id, c])), setCall };
}

// ROI after eBay fees (display only). Target: your sell_above first, else the researcher's 12-mo estimate (watchlist.json target_12mo).
export const FEES = CONFIG.FEES ? { ...DEFAULT_FEES, ...CONFIG.FEES, ship: { ...DEFAULT_FEES.ship, ...(CONFIG.FEES.ship || {}) } } : DEFAULT_FEES;
function roiOf(c, w) {
  const d = (w && w.data) || {}, t12 = num(w?.target_12mo ?? d.target_12mo), up = w?.upside_12mo ?? d.upside_12mo ?? null, upMid = num(up?.mid);
  // Target priority: your sell_above > research target_12mo (opportunities-2026-10-25.md) > precedent est. mid (upside_12mo).
  const target = c.target.sell ?? t12 ?? upMid, targetSrc = c.target.sell != null ? "sell_above" : t12 != null ? "research" : upMid != null ? "precedent" : null;
  const ask = okSeller(c.lowest) ? c.lowest.total : null, category = w?.research_category ?? d.research_category ?? c.sug.category;
  const r = roiFor({ name: c.full, category, ask, buyBelow: c.target.buy, target, targetSrc, targetZoneAnchored: /^predicted bottom zone/.test(up?.anchor_kind || ""),
    targetConf: targetSrc === "precedent" ? up?.confidence ?? null : w?.target_12mo_confidence ?? d.target_12mo_confidence ?? null, zoneLow: c.sug.low, zoneHigh: c.sug.high, med7: c.med7 }, FEES);
  r.targetNote = targetSrc === "research" ? (w?.target_12mo_source ?? d.target_12mo_source ?? "research estimate") : targetSrc === "precedent" ? `precedent est. (${up?.method || "upside_12mo"}, n=${up?.n_precedents ?? "?"})` : null;
  r.upside = upsideFor(up, r.kind, ask, c.target.buy, FEES);
  r.exit = exitFor(w?.exit_plan ?? d.exit_plan ?? null, w?.sell_signal ?? d.sell_signal ?? null, r.kind, ask, c.target.buy, FEES);   // backtested exit plan, display only
  r.retail = retailFor(w?.retail_msrp ?? d.retail_msrp ?? null, r.kind, FEES);   // retail MSRP buy board (sealed), display only
  return r;
}
// Retail MSRP buy board: sealed rows whose verdict is a buy, ranked by the stored score (flip profit, or profit at the LOW hold case).
export function retailBuys(cards, n = 5) { return cards.filter((c) => c.roi?.retail && !c.roi.retail.none && /^(flip|hold)$/.test(c.roi.retail.code)).sort((a, b) => (b.roi.retail.score ?? -1e9) - (a.roi.retail.score ?? -1e9)).slice(0, n); }
export function netUpside(cards, n = 5) { return cards.filter((c) => c.roi?.atAsk?.multAtTarget != null).sort((a, b) => b.roi.atAsk.multAtTarget - a.roi.atAsk.multAtTarget).slice(0, n); }
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

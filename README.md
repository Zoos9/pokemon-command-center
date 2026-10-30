# Command Center (web)

Static, client-side card-price dashboard for GitHub Pages (https://zoos9.github.io/pokemon-command-center/).
Plain HTML/CSS/ES modules, no build step. Hash routes: `#/deals` `#/radar` `#/cards` `#/card/<id>` `#/team`.

## Files
```
index.html               app shell (loads js/config.js, then js/app.js as a module)
manifest.webmanifest     PWA manifest (relative start_url/scope)
sw.js                    service worker: app shell cache-first, data network-first
icons/                   icon-192, icon-512, maskable-512 (original ◆ mark)
css/app.css              all styles (desktop + ≤600px phone layout with bottom tabs)
js/config.js             window.POKE_CONFIG: Supabase URL + publishable key, poll intervals, deal filter
js/cfg.js                reads POKE_CONFIG; picks backend (local on localhost, else supabase)
js/pokedata.js           Pokemon Lead's PokeData layer (copy of site/js/data.js), used by the supabase adapter
js/data.js               ONE data interface: getWatchlist, getSoldSales, getActiveSnapshot, getScans, getAlerts,
                         getFeed, getResearchCalls, getCardHistory, getReports, subscribeFeed, subscribeAlerts
js/fields.js             ONE place mapping app fields -> table columns (+ SUPABASE_OVERRIDES)
js/adapters/supabase.js  wraps window.PokeData (auth, polling via PokeData.subscribe) + paged bulk reads
js/adapters/local.js     dev only: reads ../web-data/*.json, polls
js/derive.js             joins tables into the card model; deal / target / suggested-zone logic
js/charts.js             inline SVG: sparklines, price chart, radar
js/roi.js                ROI after eBay fees + exit plan + retail MSRP board (pure; constants in config.js `fees`)
js/app.js                router + views
```
Dev-only tools live outside the deployed folder, in `/home/box/pokemon-team/web-dev-tools/`:
- `export_snapshot.py`: writes the team files to `/home/box/pokemon-team/web-data/*.json`, mirroring the Supabase rows. Never deployed.
- `shoot.py`: Playwright screenshots, console-error check, and a Supabase sign-in smoke test.

## Run locally
```
python3 /home/box/pokemon-team/web-dev-tools/export_snapshot.py --watch 60 &                      # refresh ../web-data every 60s
cd /home/box/pokemon-team/.webdev && python3 -m http.server 8792 --bind 127.0.0.1   # .webdev = symlinks web/ + web-data/
open http://127.0.0.1:8792/web/                    # local JSON (real files, no sign-in)
open http://127.0.0.1:8792/web/?backend=supabase   # force the Supabase path (sign-in screen)
```

## Deploy
Run `/home/box/pokemon-team/sync/deploy_site.sh /home/box/pokemon-team/web`. It rsyncs web/ into the site repo (no `--delete`), refuses to run if it finds secret-looking strings, then commits and pushes to `origin main`. All paths are relative, so the app works under `/pokemon-command-center/`. The overlapping files (`index.html`, `js/app.js`, `js/data.js`, `js/config.js`) replace the placeholder versions. The leftover `site/README.md` is harmless. Private data is never inside web/.

## Targets vs suggested
- **Your targets:** `watchlist.buy_below` / `sell_above`. They're primary; deals under them show as "✅ Under your target" (confirmed), and they're the only thing that drives alerts.
- **Suggested zone:** the researcher's `research_calls.call`, e.g. "declining; buy zone $132-$176; suggested buy_below $165". It's always labelled "suggested", and deals under it show as "💡 Under suggested zone · not an alert".
- **Deal filter:** lowest reputable ask (seller feedback ≥ 30), and the card's 7-day median must be at least $5 with buy-below < median. Matches below $5 go into the collapsed bulk bin.
- **Headline:** with no targets set, it reads "NO TARGETS SET — no confirmed deals yet".

## Supabase schema (confirmed 2026-10-19)
The column map lives in `js/fields.js`. The local export (`web-dev-tools/export_snapshot.py`) runs the same row builders as `sync/push_to_supabase.py`, so local and Supabase rows have identical shapes.

| table | columns used |
|---|---|
| watchlist | id, name, set_name, number, rarity, language, buy_below, sell_above, sold (jsonb; `.median` is a fallback), sort_order |
| sold_sales | card_id, item_id, sold_date, price_usd, title, url, seller, seller_feedback, condition |
| active_snapshot | card_id, scanned_at, ebay_total, reputable_count, bin_count, auction_count, lowest_total, lowest_reputable, listings[], auctions_ending_soon[] |
| listing jsonb | item_id, title, url, total, price, shipping, shipping_unknown, seller, seller_feedback, seller_feedback_pct, condition, condition_id, is_auction, bids, end_date, buying_options, location, flags. `image` exists but is **not shown**, because seller photos show copyrighted card art. |
| scans | ts, cards_scanned, cards_requested, errors, calls_today, daily_limit |
| alerts | ts, card_id, card, number, language, price_kind (sold_median / lowest_active), direction (below_buy / above_sell), value, target, link |
| feed | ts, from_bot, to_bot, type, text |
| research_calls | date, card_id, phase, zone_low, zone_high, buy_below, confidence (low/med), call (display only), prediction, evidence_links, review_by. A null zone is shown as "no suggested zone yet". `card_id = 'SET'` is shown as a set-wide banner. |
| card_history | ts, date, card_id, median_7d, median_30d, sales_7d, sales_30d, last_sale, trend, active_reputable_count, ebay_total, lowest_reputable_ask, ask_vs_median_7d_pct, outliers_dropped |
| reports | id, name, date, kind, markdown |
| allowed_emails | own row only; drives `PokeData.auth.hasAccess()` |

**Listing flags:**
- "feedback NN%" and "under 40% of sold median, verify" show as red ⚠ badges.
- "shipping not quoted" shows as a yellow "+ship?" note.
- "auction, current bid" is informational.
- A clean listing gets "✓ seller N fb, no flags".

**Live updates:** Supabase realtime (`postgres_changes`) on feed, alerts, active_snapshot, scans and watchlist, all on one channel. Events are debounced. Polling every 30s for feed and alerts is the backup. Results identical to the last fetch are dropped, and the page skips re-renders when its HTML hasn't changed, so an event plus a poll never renders twice.

## Fee model: ROI after eBay fees (added 2026-10-26)
Display only. It never changes alerts, `buy_below` (still 70% of reference, BUY_FRACTION 0.7), seller filters, or item+shipping pricing. Code is in `web/js/roi.js`. The constants live in `web/js/config.js` under `fees` and are easy to edit. Test: `node web-dev-tools/roi_test.mjs`.
- **Cost basis** = buy price (item + shipping) × 1.065. The 6.5% is the sales tax Zoos pays at ZIP 62305.
- **Net proceeds** = sale × (1 − 13.25%) − $0.40 − outbound shipping.
- **Net multiple** = net ÷ cost. The sale price needed for m× = (m × cost + 0.40 + ship) ÷ 0.8675, solved for break-even (1×), 1.5×, 2× and 3×.
- **Outbound shipping defaults** (estimates for label plus supplies):
  - raw single selling under $20: $1.25 (plain envelope)
  - raw single at $20 or more: $5.00 (tracked bubble mailer)
  - ETB, booster bundle or other small sealed: $13.00
  - booster box or Ultra-Premium Collection: $22.00
  - Kind comes from `research_category` and the name. Anything `Sealed*` is sealed; "Booster Box", "Ultra-Premium Collection" and `Sealed:Premium` count as box. Everything else is a single.
- **12-mo target**: `sell_above` if set. Otherwise it's `target_12mo` in watchlist.json, a research estimate copied from `research/opportunities-2026-10-25.md` and labelled "research est.". Otherwise (since 2026-10-28) it's the mid of `upside_12mo`, labelled "precedent est." (research/upside_12mo.py; see research/README.md). Items with none of these show "No 12-mo target yet" and are never given an invented number. For those, the Deal cards show the net if the item were resold now at the 7d sold median.
- **12-mo precedent upside** (`upside_12mo`, `roi.js upsideFor`): card page shows the low–high range, mid, confidence, n analogs and the net multiple after fees at low/mid/high, at the lowest ask and at buy-below. Deal cards and the Cards grid show the range. **2× candidate** badge = zone-anchored estimate, n ≥ 5, mid nets ≥ 2× at buy-below or at today's ask. A precedent target anchored on a presale/launch price never makes the BUY badge. Test: `web-dev-tools/upside_ui_test.py` (headless, local data).
- **Retail MSRP board** (`retail_msrp`, `roi.js retailFor`, research/msrp_board.py): sealed card pages show a 🏬 Retail MSRP panel (MSRP + source, cost incl. 6.5% tax, flip-now net multiple/profit at the 7d sold median, 12-mo hold net multiples at the precedent low/mid/high, exit-plan multiple, verdict, presale flag, observed store prices). Deals home shows "🏬 Best retail buys" (top 5 flip/hold verdicts by score). Display only. Tests: `node web-dev-tools/msrp_test.mjs`, `web-dev-tools/msrp_ui_test.py`.
- **Card page**: shows cost basis, break-even, 1.5×/2×/3× sale prices, and net, multiple and profit at target. Each is shown at the lowest reputable ask (seller 30+ fb) and at buy_below.
- **Exit plan**: the sell zone is the 2× net price. Stop-loss or re-evaluate if the 7d sold median breaks below the predicted bottom `zone_low`. If there's no zone, the trigger is 20% under the buy price.
- **Deal cards**: badge thresholds are:
  - "❌ loses money" below 1.0×
  - "⚠ thin margin" below 1.25× (`thinMarginX`)
  - "✓ 1.5×+" at 1.5× or more
- **Home page**: "Best net upside" lists the top 5 by net multiple at target from today's ask. **BUY** means ask ≤ buy_below and ≥1.5× at target.

## Backtested exit plan (added 2026-10-29)
Display only. `roi.js exitFor()` reads watchlist `exit_plan` / `sell_signal` (research/exit_plan.py, nightly; Supabase: `data` jsonb) and
recomputes net and net multiples at today's ask and buy-below with the same fee model. Card page: "🎯 Exit plan · backtested est." panel
(target sell, net after fees, net multiple at ask / buy-below, sell window, time stop, rule, SELL/HOLD/n/a badge). Deal cards and the
cards grid show a one-line exit estimate with the badge. The older 2×-net "Exit plan" text is now labelled "Fee-math check". It never
sets sell_above and never alerts. Tests: `node web-dev-tools/exit_test.mjs`, `web-dev-tools/exit_ui_test.py`. Method: research/README.md.

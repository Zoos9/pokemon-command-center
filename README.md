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
js/app.js                router + views
tools/export_snapshot.py dev: team files -> /home/box/pokemon-team/web-data/*.json (OUTSIDE web/, never deployed)
tools/shoot.py           Playwright screenshots + console-error check + Supabase sign-in smoke test
```

## Run locally
```
python3 tools/export_snapshot.py --watch 60 &                      # refresh ../web-data every 60s
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

## Supabase columns the app expects (confirm)
| table | columns used |
|---|---|
| watchlist | id, name, set_name, number, rarity, language, buy_below, sell_above, sold (jsonb, `.median` used as fallback), sort_order |
| sold_sales | card_id, item_id, sold_date, price_usd, title, url, seller, seller_feedback, condition, ts |
| active_snapshot | card_id, scanned_at, ebay_total, reputable_count, lowest_reputable (jsonb listing), listings (jsonb[]), auctions_ending_soon (jsonb[]) |
| listing jsonb | total, url, title, seller, seller_feedback, seller_feedback_pct, condition |
| scans | ts, cards_scanned, cards_requested, errors (jsonb[] of {card_id,error}), calls_today, daily_limit |
| alerts | ts, card_id, card, number, price_kind, direction (below_buy/above_sell), value, target, link |
| feed | ts, from_bot, to_bot, type, text |
| research_calls | date, card_id, card, call (text parsed for phase/zone/buy_below), prediction, confidence, evidence_links, review_by |
| card_history | ts, date, card_id, median_7d, median_30d, sales_7d, sales_30d, trend, lowest_reputable_ask, ask_vs_median_7d_pct, active_reputable_count |
| reports | id, name, date, kind, markdown |
| allowed_emails | used by PokeData.auth.hasAccess() |

Renamed columns live in `js/fields.js` (`TABLES`, `SUPABASE_OVERRIDES`).
Realtime isn't enabled on the project, so feed and alerts are polled through `PokeData.subscribe` every `pollMs`. Everything else reloads every `dataPollMs`.

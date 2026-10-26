// Public config (classic script → window.POKE_CONFIG). Safe to commit: the publishable key only works
// through RLS (allowlisted emails can read; nobody can write). Same shape as site/js/config.js, plus UI settings.
window.POKE_CONFIG = {
  supabaseUrl: "https://jmrsrcgkamehuigaeshi.supabase.co",
  supabaseKey: "sb_publishable_ViE5UYqaEJOUGba5gMGIsA_rLosXcZr",
  pollMs: 30000,            // feed / alerts / snapshot polling
  dataPollMs: 120000,       // full reload of sales, history, research
  minSellerFeedback: 30,    // deal filter
  minCardValue: 5,          // cards with 7d median below this go to the bulk bin
  // Backend: "supabase" in production. On localhost/127.0.0.1 the app uses the local JSON snapshot
  // (../web-data/*.json from tools/export_snapshot.py) unless the URL has ?backend=supabase.
  localDataUrl: "../web-data/",
  // ROI after eBay fees (js/roi.js; documented in README.md "Fee model"). Display only: never changes alerts or buy_below.
  fees: {
    ebayFeePct: 0.1325,     // eBay final value fee on the whole sale (item + shipping charged)
    perOrderFee: 0.40,      // eBay per-order fee
    taxRate: 0.065,         // sales tax Zoos pays on purchases (ZIP 62305) -> cost basis = buy × 1.065
    ship: {                 // outbound shipping Zoos pays when he sells (labels + supplies, best guess; edit freely)
      pwe: 1.25,            // raw single in a plain envelope (PWE, untracked), sale under pweMaxSale
      pweMaxSale: 20,       // singles selling at/above this go tracked
      bmwt: 5.00,           // raw single, bubble mailer with tracking (USPS Ground Advantage)
      etb: 13.00,           // ETB / booster bundle / small sealed box
      box: 22.00,           // booster box / Ultra-Premium Collection
    },
    thinMarginX: 1.25,      // Deal cards: net multiple below this = "thin margin"; below 1.0 = loses money
    stopFallbackPct: 20,    // exit plan when there's no predicted bottom zone: re-evaluate at this % under the buy
  },
};

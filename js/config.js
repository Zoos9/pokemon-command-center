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
};

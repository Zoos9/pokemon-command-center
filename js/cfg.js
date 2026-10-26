// Reads window.POKE_CONFIG (js/config.js) into the shape the app modules use.
const c = window.POKE_CONFIG || {};
const local = ["localhost", "127.0.0.1"].includes(location.hostname) && !/[?&]backend=supabase/.test(location.search);
export const CONFIG = {
  SUPABASE_URL: c.supabaseUrl || "", SUPABASE_KEY: c.supabaseKey || "",
  BACKEND: local || !c.supabaseUrl ? "local" : "supabase",
  LOCAL_DATA_URL: c.localDataUrl || "../web-data/",
  POLL_MS: c.pollMs || 30000, DATA_POLL_MS: c.dataPollMs || 120000,
  MIN_SELLER_FEEDBACK: c.minSellerFeedback ?? 30, MIN_CARD_VALUE: c.minCardValue ?? 5,
  FEES: c.fees ? { ...c.fees, ship: { ...(c.fees.ship || {}) } } : null,   // null -> roi.js DEFAULT_FEES
};

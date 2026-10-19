// Dev adapter: reads ./data/<table>.json written by tools/export_snapshot.py, polls for updates.
import { CONFIG } from "../cfg.js";
export function createLocal() {
  const get = async (t) => {
    const r = await fetch(`${CONFIG.LOCAL_DATA_URL}${t}.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) { if (r.status === 404) return []; throw new Error(`${t}: HTTP ${r.status}`); }
    return r.json();
  };
  const poll = (t, cb) => {
    let last = null;
    const tick = async () => { try { const rows = await get(t); const sig = rows.length + "|" + JSON.stringify(rows.at(-1) || null); if (sig !== last) { last = sig; cb(rows); } } catch (e) { console.warn(e.message); } };
    tick(); const id = setInterval(tick, CONFIG.POLL_MS); return () => clearInterval(id);
  };
  return { kind: "local", needsAuth: false, fetchTable: get, subscribe: poll, session: async () => null };
}

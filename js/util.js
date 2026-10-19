export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const money = (x) => (x == null || isNaN(x) ? "—" : x < 10 ? `$${(+x).toFixed(2)}` : `$${Math.round(x).toLocaleString("en-US")}`);
export const pct = (x, d = 0) => (x == null || isNaN(x) ? "—" : `${x > 0 ? "+" : ""}${x.toFixed(d)}%`);
const TZ = "America/Chicago";
export const tCT = (iso) => { if (!iso) return "—"; const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }) + " CT"; };
export const dCT = (iso) => { if (!iso) return "—"; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " CT"; };
export const ago = (iso) => { const m = (Date.now() - new Date(iso)) / 60000; if (isNaN(m)) return ""; if (m < 1) return "just now"; if (m < 60) return `${Math.round(m)}m ago`; if (m < 1440) return `${Math.round(m / 60)}h ago`; return `${Math.round(m / 1440)}d ago`; };
export const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const num = (v) => (v === null || v === undefined || v === "" || isNaN(+v) ? null : +v);

// Copied verbatim from /home/box/pokemon-team/site/js/data.js (Pokemon Lead). Defines window.PokeData.
// Data layer: everything that talks to Supabase lives here. UI code should only use window.PokeData.
(function () {
  const cfg = window.POKE_CONFIG;
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    // Session lives in this origin's localStorage under an explicit key, so an installed PWA keeps it across launches.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit",
            storage: window.localStorage, storageKey: "cc-auth" },
  });
  const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
  async function q(p) { const { data, error } = await p; if (error) throw error; return data || []; }

  const auth = {
    // Restore on startup: getSession() reads localStorage; if the access token is expired/near expiry but the
    // refresh token is valid (e.g. iOS killed the app overnight), refresh before deciding to show sign-in.
    async session() {
      let s = (await sb.auth.getSession()).data.session;
      if (s && (!s.expires_at || s.expires_at * 1000 < Date.now() + 60000)) {
        const r = await sb.auth.refreshSession(); s = r.data?.session || (r.error ? null : s);
      }
      if (!s && localStorage.getItem("cc-auth")) {          // stored session that getSession couldn't use: try refresh once
        const r = await sb.auth.refreshSession().catch(() => null); s = r?.data?.session || null;
      }
      return s;
    },
    onChange(cb) { return sb.auth.onAuthStateChange((_e, s) => cb(s)); },
    async sendMagicLink(email) {
      const redirect = window.location.origin + window.location.pathname;
      const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: redirect } });
      if (error) throw error;
    },
    // In-app sign-in: the same email carries a 6-8 digit code ({{ .Token }}); verifying it here creates the
    // session inside the installed app (the magic link would open the browser, which has separate storage).
    async verifyCode(email, token) {
      const { data, error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: String(token).trim(), type: "email" });
      if (error) throw error;
      return data.session;
    },
    async signOut() { await sb.auth.signOut(); },
    // true if the signed-in email is on the allowlist (RLS lets a user see only their own allowlist row)
    async hasAccess() { const r = await q(sb.from("allowed_emails").select("email").limit(1)); return r.length > 0; },
  };

  async function meta() {
    const rows = await q(sb.from("sync_meta").select("key,value,synced_at"));
    return Object.fromEntries(rows.map((r) => [r.key, { ...r.value && { value: r.value }, synced_at: r.synced_at }]));
  }
  const feed = (limit = 300) => q(sb.from("feed").select("*").order("ts", { ascending: false }).limit(limit));
  const alerts = (limit = 200) => q(sb.from("alerts").select("*").order("ts", { ascending: false }).limit(limit));
  const scans = (limit = 20) => q(sb.from("scans").select("*").order("ts", { ascending: false }).limit(limit));
  const reports = () => q(sb.from("reports").select("id,name,date,kind,synced_at").order("date", { ascending: false }));
  async function report(id) { const r = await q(sb.from("reports").select("*").eq("id", id).limit(1)); return r[0] || null; }
  async function latestResearchReport() {
    const r = await q(sb.from("reports").select("*").eq("kind", "research").order("date", { ascending: false }).limit(1));
    return r[0] || null;
  }
  const cardHistory = (cardId) => q(sb.from("card_history").select("*").eq("card_id", cardId).order("date"));
  const researchCalls = () => q(sb.from("research_calls").select("*").order("date", { ascending: false }));
  const soldSales = (cardId, limit = 200) =>
    q(sb.from("sold_sales").select("card_id,sold_date,price_usd,title,url,seller,seller_feedback,condition")
      .eq("card_id", cardId).order("sold_date", { ascending: false }).limit(limit));

  // Watchlist merged with each card's active snapshot and derived statuses (same rules as the box dashboard).
  async function watchlist() {
    const [w, a] = await Promise.all([
      q(sb.from("watchlist").select("*").order("sort_order")),
      q(sb.from("active_snapshot").select("*")),
    ]);
    const act = Object.fromEntries(a.map((x) => [x.card_id, x]));
    return w.map((c) => {
      const s = c.sold || {}, snap = act[c.id] || null, low = snap && snap.lowest_reputable;
      const buy = num(c.buy_below), sell = num(c.sell_above), med = num(s.median), lt = low ? num(low.total) : null;
      let status = med == null ? "no sold data" : buy == null && sell == null ? "no targets"
        : buy != null && med < buy ? "below buy target" : sell != null && med > sell ? "above sell target" : "in range";
      let active_status = null;
      if (lt != null) active_status = buy != null && lt < buy ? "below buy" : sell != null && lt > sell ? "above sell" : null;
      return { ...c, buy_below: buy, sell_above: sell, sold_median: med, snapshot: snap, lowest_active: low || null, status, active_status };
    });
  }
  // Reputable active listings past a target (BIN + auctions ending soon), best first.
  function dealsFrom(rows) {
    const out = [];
    for (const c of rows) {
      const snap = c.snapshot; if (!snap) continue;
      for (const l of [...(snap.listings || []), ...(snap.auctions_ending_soon || [])]) {
        const t = num(l.total); if (t == null) continue;
        const side = c.buy_below != null && t < c.buy_below ? "under buy" : c.sell_above != null && t > c.sell_above ? "over sell" : null;
        if (side) out.push({ ...l, side, card_id: c.id, card: c.name, number: c.number, language: c.language,
          target: side === "under buy" ? c.buy_below : c.sell_above, sold_median: c.sold_median });
      }
    }
    return out.sort((x, y) => (x.side !== y.side ? (x.side === "under buy" ? -1 : 1)
      : x.side === "under buy" ? (x.total - x.target) / x.target - (y.total - y.target) / y.target
      : (y.total - y.target) / y.target - (x.total - x.target) / x.target));
  }
  // Everything the main screen needs in one call.
  async function snapshot() {
    const [m, f, w, al, sc, rep] = await Promise.all([meta(), feed(), watchlist(), alerts(), scans(1), latestResearchReport()]);
    const team = ((m.team && m.team.value) || []).map((b) => {
      const last = f.find((e) => e.from_bot === b.name);
      return { ...b, last_ts: last ? last.ts : null, last_text: last ? last.text : null };
    });
    return { team, feed: f, watchlist: w, deals: dealsFrom(w), alerts: al, last_scan: sc[0] || null,
      report: rep, last_sync: m.last_sync ? m.last_sync.value : null };
  }
  // Poll + realtime nudges (realtime only fires if tables are added to the supabase_realtime publication).
  function subscribe(cb, ms = cfg.pollMs) {
    let stopped = false, t;
    const tick = async () => { if (stopped) return; try { cb(await snapshot(), null); } catch (e) { cb(null, e); } t = setTimeout(tick, ms); };
    tick();
    const ch = sb.channel("poke-changes").on("postgres_changes", { event: "*", schema: "public" }, () => { clearTimeout(t); tick(); }).subscribe();
    return () => { stopped = true; clearTimeout(t); sb.removeChannel(ch); };
  }

  window.PokeData = { client: sb, auth, meta, feed, alerts, scans, reports, report, latestResearchReport,
    cardHistory, researchCalls, soldSales, watchlist, dealsFrom, snapshot, subscribe };
})();

// Placeholder UI. Dashboard Designer replaces this; keep using window.PokeData for data.
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (v) => (v == null ? "—" : "$" + Number(v).toFixed(2));
  const when = (t) => (t ? new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
  const safeUrl = (u) => (/^https:\/\//.test(u || "") ? u : null);
  const link = (u, txt) => (safeUrl(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${txt}</a>` : "");
  let stop = null;

  function show(view) { for (const v of ["loading", "login", "denied", "app"]) $(v).hidden = v !== view; }

  function render(s) {
    $("status").textContent = `Synced ${when(s.last_sync && s.last_sync.ts)} · last scan ${when(s.last_scan && s.last_scan.ts)}`;
    $("team").innerHTML = s.team.map((b) => `<li style="border-color:${esc(b.color)}"><b>${esc(b.name)}</b> <small>${esc(b.role)}</small><br><small>${when(b.last_ts)}: ${esc((b.last_text || "").slice(0, 140))}</small></li>`).join("");
    $("deals").innerHTML = s.deals.length ? s.deals.slice(0, 50).map((d) => `<li><b>${esc(d.card)}</b> ${esc(d.language)} #${esc(d.number)} — <b>${money(d.total)}</b> (${esc(d.side)} ${money(d.target)}, sold med ${money(d.sold_median)}) · ${esc(d.seller)} (${esc(d.seller_feedback)}) ${link(d.url, "View ↗")}</li>`).join("")
      : `<li class="empty">${s.watchlist.some((c) => c.buy_below != null || c.sell_above != null) ? "No reputable listings past your targets right now." : "Set buy/sell targets to see deals."}</li>`;
    $("alerts").innerHTML = s.alerts.length ? s.alerts.map((a) => `<li><b>${esc(a.card)}</b> ${esc(a.language)} — ${esc(a.price_kind)} ${money(a.value)} ${esc(a.direction)} ${money(a.target)} · ${when(a.ts)} ${link(a.link, "↗")}</li>`).join("") : `<li class="empty">No alerts yet.</li>`;
    $("watch").innerHTML = s.watchlist.map((c) => `<tr><td><b>${esc(c.name)}</b><br><small>${esc(c.language)} #${esc(c.number)}</small></td>
      <td>${money(c.sold_median)}<br><small>${c.sold ? esc(c.sold.n) + " sales" : ""}</small></td>
      <td>${c.lowest_active ? money(c.lowest_active.total) + " " + link(c.lowest_active.url, "↗") + `<br><small>${esc(c.lowest_active.seller)} (${esc(c.lowest_active.seller_feedback)})</small>` : "—"}</td>
      <td>${money(c.buy_below)} / ${money(c.sell_above)}<br><small>${esc(c.status)}${c.active_status ? " · active " + esc(c.active_status) : ""}</small></td></tr>`).join("");
    $("feed").innerHTML = s.feed.slice(0, 100).map((e) => `<li><small>${when(e.ts)}</small> <b>${esc(e.from_bot)}</b> → ${esc(e.to_bot)}: ${esc(e.text)}</li>`).join("");
    $("report").textContent = s.report ? `${s.report.name} (${s.report.date})\n\n${s.report.markdown}` : "No research report yet.";
  }

  async function route(session) {
    if (stop) { stop(); stop = null; }
    if (!session) return show("login");
    $("who").textContent = session.user.email;
    try { if (!(await PokeData.auth.hasAccess())) return show("denied"); } catch (e) { return show("denied"); }
    show("app");
    stop = PokeData.subscribe((s, err) => { if (err) $("status").textContent = "Connection problem, retrying… " + (err.message || err); else render(s); });
  }

  $("loginForm").addEventListener("submit", async (ev) => {
    ev.preventDefault(); $("loginMsg").textContent = "Sending…";
    try { await PokeData.auth.sendMagicLink($("email").value); $("loginMsg").textContent = "Check your email for the sign-in link. Open it on this device."; }
    catch (e) { $("loginMsg").textContent = "Couldn't send the link: " + (e.message || e); }
  });
  for (const id of ["signOut", "signOut2"]) $(id).addEventListener("click", () => PokeData.auth.signOut());
  PokeData.auth.onChange((s) => route(s));
  PokeData.auth.session().then(route);
})();

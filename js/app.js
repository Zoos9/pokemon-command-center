import { CONFIG } from "./cfg.js";
import * as D from "./data.js";
import { buildModel, deals, warnFlags } from "./derive.js";
import { spark, priceChart, radar, phaseColor } from "./charts.js";
import { esc, money, pct, tCT, dCT, ago } from "./util.js";

const TEAM = [
  { name: "Pokemon Lead", role: "Coordinator: splits work, keeps the team on track", color: "#ffcb05" },
  { name: "Price Scout", role: "eBay price checks (sold + active listings)", color: "#3b9cff" },
  { name: "Alert Desk", role: "Alerts you when prices cross your targets", color: "#ff4d4d" },
  { name: "Market Researcher", role: "Market research, phases, suggested zones", color: "#5ad17a" },
  { name: "Dashboard Designer", role: "Designs dashboards & decision tools", color: "#c86bff" },
];
const who = (n) => TEAM.find((t) => t.name === n)?.color || "#a9a3c9";
const S = { model: null, alerts: [], feed: [], scans: [], reports: [], error: null, q: "", sort: "dist", lang: "all" };
const $app = document.getElementById("app");
const small = () => matchMedia("(max-width:600px)").matches;
const route = () => (location.hash.replace(/^#\/?/, "") || "deals").split("/");

// ---------- shell
function shell(body, tab) {
  const scan = S.scans.at(-1), act = S.model?.cards.map((c) => c.scanned_at).filter(Boolean).sort().at(-1);
  const sold = S.model?.cards.flatMap((c) => c.sales.slice(-1).map((s) => s.sold_date)).sort().at(-1);
  const tabs = [["deals", "💸", "Deals"], ["radar", "📡", "Radar"], ["cards", "📈", "Cards"], ["team", "💬", "Team"]];
  const nav = tabs.map(([k, i, l]) => `<a href="#/${k}" class="${tab === k ? "on" : ""}" ${tab === k ? 'aria-current="page"' : ""}><b aria-hidden="true">${i}</b>${l}</a>`).join("");
  const scanErr = scan?.errors?.length ? ` · <span class="warn">${scan.errors.length} card${scan.errors.length > 1 ? "s" : ""} failed last scan</span>` : "";
  return `<header class="top"><a class="brand" href="#/deals"><span class="mk" aria-hidden="true">◆</span><span>COMMAND CENTER</span></a>
    <nav class="topnav">${nav}</nav>
    <div class="fresh">listings ${act ? `${tCT(act)} <small>(${ago(act)})</small>` : "—"} · sold thru ${sold || "—"}${scanErr}${D.backend()?.signOut ? ` · <button class="link" id="signout">sign out</button>` : ""}</div></header>
    ${S.error ? `<div class="err" role="alert">Data problem: ${esc(S.error)}</div>` : ""}
    <main>${body}</main><nav class="tabs">${nav}</nav>`;
}
const cardLink = (c, inner) => `<a class="cl" href="#/card/${encodeURIComponent(c.id)}">${inner}</a>`;
const cname = (c) => `<span class="lg">${c.lang}</span> <b>${esc(c.name)}</b> <small>${esc(c.number)}${c.variant ? " · " + esc(c.variant) : ""}</small>`;
const phase = (p) => (p ? `<span class="ph" style="background:${phaseColor(p)}">${esc(p)}</span>` : `<span class="ph none">no call</span>`);
const badges = (l) => { const w = warnFlags(l); return (w.length ? w.map((f) => `<span class="flag" title="Scanner flag: check before buying">⚠ ${esc(f)}</span>`).join("") : "") + (l?.shipping_unknown ? `<span class="ship" title="Total excludes shipping">+ shipping not quoted</span>` : ""); };
const legit = (l) => (warnFlags(l).length ? `<span class="flag">⚠ check listing</span>` : `<span class="okb">✓ seller ${l?.feedback ?? "?"} fb, no flags</span>`);
const fb = (l) => (l?.feedback != null ? `${(+l.feedback).toLocaleString()} fb${l.feedback_pct ? " · " + esc(l.feedback_pct) + (String(l.feedback_pct).includes("%") ? "" : "%") : ""}` : "fb n/a");

// ---------- Deals
function dealCard(c, kind) {
  const ref = kind === "target" ? c.target.buy : c.sug.buy, l = c.lowest;
  const under = c.med7 ? (1 - l.total / c.med7) * 100 : null;
  return `<article class="deal ${kind}">${cardLink(c, `<div class="tag">${kind === "target" ? "✅ UNDER YOUR TARGET" : "💡 UNDER SUGGESTED ZONE · not an alert"}</div>
    <div class="dt">${cname(c)}</div>${l.title ? `<div class="ltitle">“${esc(l.title)}”</div>` : ""}<div class="big">${money(l.total)}${l.shipping_unknown ? `<small class="shipq">+ship?</small>` : ""}</div>
    <div class="vs">7d sold median <b>${money(c.med7)}</b> · ${kind === "target" ? "your target" : "suggested buy-below"} <b>${money(ref)}</b></div>
    ${under != null ? `<div class="pill">▼ ${under.toFixed(0)}% under market</div>` : ""}
    <div class="sel">seller <b>${esc(l.seller || "?")}</b> · ${fb(l)} · ${esc(l.condition || "")}</div><div class="badges">${legit(l)}${badges(l)}</div>`)}
    ${l.url ? `<a class="ext" href="${esc(l.url)}" target="_blank" rel="noopener">Open on eBay ↗</a>` : ""}</article>`;
}
function vDeals() {
  const m = S.model, d = deals(m.cards);
  let head, sub;
  if (d.confirmed.length) { head = `<em>YES</em> — ${d.confirmed.length} listing${d.confirmed.length > 1 ? "s" : ""} under your target`; }
  else if (!d.anyTargets) { head = `<em class="amber">NO TARGETS SET</em> — no confirmed deals yet`; }
  else head = `<em class="no">NO</em> — nothing under your targets right now`;
  const cl = d.closest ? `Closest${d.confirmed.length ? " other" : ""}: ${cardLink(d.closest.c, `<b>${esc(d.closest.c.name)} ${d.closest.c.lang} ${esc(d.closest.c.number)}</b>`)} — lowest ask ${money(d.closest.c.lowest.total)} is ${pct(d.closest.gap)} vs ${d.closest.c.src === "target" ? "your target" : "suggested"} ${money(d.closest.c.effBuy)}.` : "";
  sub = !d.anyTargets ? `You haven't set buy_below / sell_above in the watchlist, so nothing can be confirmed or alerted. ${d.suggested.length ? `${d.suggested.length} listing${d.suggested.length > 1 ? "s are" : " is"} under the researcher's <b>suggested</b> zone — a hint, not a signal.` : "Nothing is under the researcher's suggested zone either."} ${cl}` : cl;
  const sell = d.sellNow.length ? `<section><h2>📤 Above your sell target</h2><div class="deals">${d.sellNow.map((c) => cardLink(c, `<article class="deal sell"><div class="tag">SELL SIGNAL</div><div class="dt">${cname(c)}</div><div class="big">${money(c.med7)}</div><div class="vs">7d median vs your sell target ${money(c.target.sell)}</div></article>`)).join("")}</div></section>` : "";
  const bulk = d.bulk.length ? `<details class="bulk"><summary>🧺 Bulk bin — ${d.bulk.length} sub-${money(CONFIG.MIN_CARD_VALUE)} card${d.bulk.length > 1 ? "s" : ""} at/under suggested buy-below</summary><div class="bulkl">${d.bulk.map((c) => cardLink(c, `${esc(c.name)} ${c.lang} ${esc(c.number)} <b>${money(c.lowest.total)}</b> <small>med ${money(c.med7)}</small>`)).join("")}</div></details>` : "";
  const near = m.cards.filter((c) => c.dist != null).sort((a, b) => a.dist - b.dist).slice(0, 12);
  const rows = near.map((c) => `<tr onclick="location.hash='#/card/${encodeURIComponent(c.id)}'"><td>${cardLink(c, cname(c))}</td><td>${phase(c.sug.phase)}</td><td class="n">${money(c.med7)}</td>
    <td class="n">${money(c.effBuy)}<small class="src ${c.src}">${c.src === "target" ? "yours" : "sugg."}</small></td>
    <td><div class="bar"><i style="width:${Math.max(4, Math.min(100, 100 - c.dist * 2))}%;background:${c.dist <= 10 ? "#2ee6a6" : c.dist <= 30 ? "#ffcb05" : "#ff9f1c"}"></i></div><small class="n">${c.dist <= 0 ? "in zone" : pct(c.dist) + " above"}</small></td>
    <td class="hide-s">${spark(c.daily.map((x) => x[1]), 90, 24)}</td><td class="n hide-s">${money(c.lowest?.total)}</td><td class="n hide-s">${c.s7 ?? "—"}</td></tr>`).join("");
  return `${setBanner()}<section class="hero"><h1 class="verdict">${head}</h1><p class="sub">${sub}</p></section>
    ${d.confirmed.length ? `<section><h2>✅ Under your target <small>confirmed · seller ${CONFIG.MIN_SELLER_FEEDBACK}+ fb</small></h2><div class="deals">${d.confirmed.map((c) => dealCard(c, "target")).join("")}</div></section>` : ""}
    ${sell}
    ${d.suggested.length ? `<section><h2>💡 Under suggested zone <small>researcher's zone, not your target · ${money(CONFIG.MIN_CARD_VALUE)}+ cards · seller ${CONFIG.MIN_SELLER_FEEDBACK}+ fb</small></h2><div class="deals">${d.suggested.map((c) => dealCard(c, "suggested")).join("")}</div></section>` : ""}
    ${bulk}
    <div class="split"><section><h2>🎯 Closest to buy zone</h2><table class="tbl"><thead><tr><th>Card</th><th>Phase</th><th>7d med</th><th>Buy &lt;</th><th>Distance</th><th class="hide-s">Trend</th><th class="hide-s">Low ask</th><th class="hide-s">Sales 7d</th></tr></thead><tbody>${rows}</tbody></table></section>
    <aside>${alertsBox(d.anyTargets)}<section class="panel"><h2>📡 Team live <a class="more" href="#/team">all →</a></h2>${feedList(6)}</section></aside></div>`;
}
function setBanner() {
  const sc = S.model.setCall; if (!sc) return "";
  return `<div class="setban" style="border-color:${phaseColor(sc.phase)}"><b style="color:${phaseColor(sc.phase)}">SET-WIDE: ${esc((sc.phase || "?").toUpperCase())}</b> <span>${esc(sc.prediction || sc.call || "")}</span> <small>confidence ${esc(sc.confidence || "?")} · ${esc(sc.date || "")}</small></div>`;
}
const KIND = { sold_median: "7d sold median", lowest_active: "lowest active listing" };
function alertsBox(anyTargets) {
  const a = S.alerts.slice(-5).reverse();
  return `<section class="panel alerts"><h2>🚨 Alerts</h2>${a.length ? a.map((x) => `<div class="al"><b>${x.direction === "above_sell" ? "📤 SELL" : "📥 BUY"}</b> ${esc(x.card)} ${esc(x.number || "")} — ${esc(KIND[x.price_kind] || x.price_kind || "price")} ${money(x.value)} is ${x.direction === "above_sell" ? "above your sell" : "below your buy"} target ${money(x.target)} <small>${dCT(x.ts)}</small>${x.link ? ` <a href="${esc(x.link)}" target="_blank" rel="noopener">↗</a>` : ""}</div>`).join("")
    : `<p class="empty">${anyTargets ? "No alerts fired yet." : "No alerts yet — set buy_below / sell_above targets to enable."}</p>`}</section>`;
}
function feedList(n) {
  const f = S.feed.slice(-n).reverse();
  return f.length ? f.map((x) => `<div class="fi" style="border-color:${who(x.from)}"><b style="color:${who(x.from)}">${esc(x.from)}</b>${x.to ? ` <small>→ ${esc(x.to)}</small>` : ""} <i>${tCT(x.ts)}</i><p>${esc(x.text)}</p></div>`).join("") : `<p class="empty">No team messages yet.</p>`;
}

// ---------- Radar
function vRadar() {
  const { svg, inz, out } = radar(S.model.cards, small());
  const list = [...inz, ...out].sort((a, b) => a.dist - b.dist).map((c) => `<li>${cardLink(c, `<span class="nm">${cname(c)}</span>${phase(c.sug.phase)}<span class="d n">${c.dist <= 2 ? "in zone" : "+" + c.dist.toFixed(0) + "%"}</span>`)}</li>`).join("");
  const lanes = ["hype", "declining", "basing", "recovering"].map((p) => { const cs = S.model.cards.filter((c) => c.sug.phase === p).sort((a, b) => (a.dist ?? 999) - (b.dist ?? 999));
    return `<div class="lane" style="border-color:${phaseColor(p)}"><h3 style="color:${phaseColor(p)}">${p.toUpperCase()} <em>${cs.length}</em></h3>${cs.map((c) => cardLink(c, `<div class="li"><b>${esc(c.name)}</b> <small>${c.lang} ${esc(c.number)}</small><span class="n">${money(c.med7)}</span></div>`)).join("") || `<p class="empty">none yet${p === "recovering" ? " — first card here is a bottom signal" : ""}</p>`}</div>`; }).join("");
  const noZone = S.model.cards.filter((c) => c.dist == null);
  return `${setBanner()}<section class="hero"><h1 class="verdict">Bottom radar</h1><p class="sub">Centre = buy zone (your target if set, otherwise the researcher's <b>suggested</b> buy-below). Distance = how far the 7-day sold median sits above it. Colour = research phase.</p></section>
  <div class="radarwrap"><div class="rbox">${svg}<div class="legend">${["hype", "declining", "basing", "recovering"].map((p) => `<span><i style="background:${phaseColor(p)}"></i>${p}</span>`).join("")}<span>dot size = card value</span></div></div>
  <section class="panel"><h2>Closest to zone</h2><ol class="rlist">${list}</ol>${noZone.length ? `<p class="empty">${noZone.length} card(s) have no zone yet: ${noZone.map((c) => esc(c.name) + " " + esc(c.number)).join(", ")}</p>` : ""}</section></div>
  <h2>Phase lanes <small>cards move left → right as they bottom out</small></h2><div class="lanes">${lanes}</div>`;
}

// ---------- Cards list
function vCards() {
  let cs = S.model.cards.filter((c) => (S.lang === "all" || c.lang === S.lang) && (!S.q || (c.full + " " + c.number).toLowerCase().includes(S.q.toLowerCase())));
  const sorters = { dist: (a, b) => (a.dist ?? 999) - (b.dist ?? 999), value: (a, b) => (b.med7 || 0) - (a.med7 || 0), name: (a, b) => a.name.localeCompare(b.name) };
  cs.sort(sorters[S.sort]);
  return `<section class="hero"><h1 class="verdict">All cards <small>${S.model.cards.length}</small></h1></section>
  <div class="filters"><input id="q" type="search" placeholder="Search card or number" value="${esc(S.q)}" aria-label="Search cards">
  <div class="seg">${["all", "EN", "JP"].map((l) => `<button data-lang="${l}" class="${S.lang === l ? "on" : ""}">${l}</button>`).join("")}</div>
  <select id="sort" aria-label="Sort">${[["dist", "Closest to zone"], ["value", "Highest value"], ["name", "Name"]].map(([k, l]) => `<option value="${k}" ${S.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select></div>
  <div class="grid">${cs.map((c) => cardLink(c, `<article class="mini"><div>${cname(c)}</div>${spark(c.daily.map((x) => x[1]), 150, 34, phaseColor(c.sug.phase))}<div class="mrow"><span class="n big2">${money(c.med7)}</span>${phase(c.sug.phase)}</div><div class="mrow s"><span>${c.dist == null ? "no zone" : c.dist <= 2 ? "in zone" : pct(c.dist) + " above " + (c.src === "target" ? "your target" : "suggested")}</span><span>ask ${money(c.lowest?.total)}</span></div></article>`)).join("") || `<p class="empty">No cards match.</p>`}</div>`;
}

// ---------- Card page
function vCard(id) {
  const c = S.model.byId[decodeURIComponent(id || "")];
  if (!c) return `<section class="hero"><h1 class="verdict">Card not found</h1><p class="sub"><a href="#/cards">Back to all cards</a></p></section>`;
  const l = c.lowest;
  const row = (x) => { const vs = c.med7 && x.total != null ? (x.total / c.med7 - 1) * 100 : null; const good = c.effBuy && x.total <= c.effBuy;
    return `<tr><td class="n ${good ? "good" : ""}">${money(x.total)}${x.shipping_unknown ? `<small class="shipq">+ship?</small>` : ""}</td><td>${esc(x.seller || "?")}<small>${fb(x)}</small>${x.title ? `<small class="lt">${esc(x.title)}</small>` : ""}${warnFlags(x).length ? `<div>${badges({ ...x, shipping_unknown: false })}</div>` : ""}</td><td class="hide-s">${esc(x.condition || "")}</td><td class="n ${vs != null && vs < 0 ? "good" : ""}">${pct(vs)}</td><td>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener" aria-label="Open listing on eBay">eBay ↗</a>` : ""}</td></tr>`; };
  const listings = c.listings.length ? c.listings.slice(0, 10).map(row).join("") + (c.listings.length > 10 ? `</tbody></table><details class="more-l"><summary>Show ${c.listings.length - 10} more listings</summary><table class="tbl lst"><tbody>${c.listings.slice(10).map(row).join("")}` : "") : "";
  const tgt = c.target.buy != null ? `<div class="st"><small>YOUR BUY TARGET</small><b class="yel">${money(c.target.buy)}</b>${c.med7 ? pct((c.med7 / c.target.buy - 1) * 100) + " to go" : ""}</div>`
    : c.sug.buy == null ? `<div class="st"><small>SUGGESTED BUY-BELOW <span class="sugg">research</span></small><b>—</b>no suggested zone yet<br><small>no target set</small></div>`
    : `<div class="st"><small>SUGGESTED BUY-BELOW <span class="sugg">research</span></small><b class="grn">${money(c.sug.buy)}</b>${c.dist != null ? (c.dist <= 0 ? "median in zone" : pct(c.dist) + " to go") : "no zone yet"}<br><small>no target set</small></div>`;
  return `<a class="back" href="#/cards">← All cards</a><section class="cardhead"><h1>${esc(c.name)} <span>${esc(c.number)}</span></h1><p>${c.variant ? esc(c.variant) + " · " : ""}${c.lang === "JP" ? "Japanese" : "English"} · raw · eBay sold comps, sellers ${CONFIG.MIN_SELLER_FEEDBACK}+ fb</p></section>
  <div class="stats"><div class="st"><small>7D SOLD MEDIAN</small><b>${money(c.med7)}</b>${c.s7 != null ? c.s7 + " sales" : ""}${c.trend ? ` · trend <b class="inl">${esc(c.trend)}</b>` : ""}<br>30d ${money(c.med30)}${c.s30 != null ? ` (${c.s30} sales)` : ""}${c.lastSale ? ` · last $${esc(c.lastSale.replace("@", " on "))}` : ""}</div>
  <div class="st"><small>LOWEST REPUTABLE ASK</small><b class="pink">${money(l?.total)}</b>${c.askVsMed != null ? pct(c.askVsMed, 1) + " vs median" : "no listing"}</div>${tgt}
  <div class="st"><small>ACTIVE (REPUTABLE)</small><b>${c.activeCount ?? "—"}</b>${c.ebayTotal != null ? `of ${c.ebayTotal.toLocaleString()} on eBay · ` : ""}scanned ${tCT(c.scanned_at)}</div></div>
  ${l ? `<div class="lowl">Lowest reputable: ${l.title ? `“${esc(l.title)}” ` : ""}<span class="badges">${legit(l)}${badges(l)}</span>${l.url ? ` <a href="${esc(l.url)}" target="_blank" rel="noopener">eBay ↗</a>` : ""}</div>` : ""}
  <div class="cardgrid"><section class="panel">${priceChart(c, small())}<p class="note">Dots are individual eBay sold comps${c.outliers ? ` (${c.outliers} outlier${c.outliers > 1 ? "s" : ""} dropped from the median)` : ""}. Medians come from ${c.histCount} history snapshot${c.histCount === 1 ? "" : "s"}${c.histDate ? ` (${esc(c.histDate)})` : ""}; the trend line will fill in as daily snapshots accumulate.</p></section>
  <div><section class="panel call" style="border-color:${phaseColor(c.sug.phase)}">${c.sug.call ? `<h2 style="color:${phaseColor(c.sug.phase)}">Research: ${esc((c.sug.phase || "").toUpperCase())}</h2><p>${esc(c.sug.call)}</p>${c.sug.prediction ? `<p class="pred">${esc(c.sug.prediction)}</p>` : ""}<p>confidence <b>${esc(c.sug.conf || "?")}</b> · call ${esc(c.sug.date || "")} · review by ${esc(c.sug.review_by || "—")}</p>${c.sug.links.length ? `<details><summary>${c.sug.links.length} sources</summary>${c.sug.links.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, "").slice(0, 60))}</a>`).join("")}</details>` : ""}` : `<p class="empty">No research call for this card yet.</p>`}</section>
  ${c.auctions.length ? `<section class="panel"><h2>⏱ Auctions ending soon</h2><table class="tbl lst"><tbody>${c.auctions.map((x) => `<tr><td class="n">${money(x.total)}<small>${x.bids ?? 0} bid${x.bids === 1 ? "" : "s"}</small></td><td>${esc(x.seller || "?")}<small>${fb(x)}</small>${x.title ? `<small class="lt">${esc(x.title)}</small>` : ""}</td><td><small>ends</small>${esc(dCT(x.end_date))}</td><td>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">eBay ↗</a>` : ""}</td></tr>`).join("")}</tbody></table></section>` : ""}
  <section class="panel"><h2>Live BIN listings <small>reputable sellers</small></h2>${listings ? `<table class="tbl lst"><tbody>${listings}</tbody></table>${c.listings.length > 10 ? "</details>" : ""}` : `<p class="empty">No reputable listings in the last scan.</p>`}</section></div></div>`;
}

// ---------- Team
function vTeam() {
  const last = {}; for (const f of S.feed) last[f.from] = f;
  const scan = S.scans.at(-1);
  return `<section class="hero"><h1 class="verdict">Team</h1><p class="sub">Live bot chatter. ${D.backend().kind === "supabase" ? "Realtime." : `Refreshes every ${CONFIG.POLL_MS / 1000}s.`}</p></section>
  <div class="roster">${TEAM.map((t) => `<div class="mem" style="border-color:${t.color}"><b style="color:${t.color}">${esc(t.name)}</b><small>${esc(t.role)}</small><span>${last[t.name] ? "active " + ago(last[t.name].ts) : "no messages yet"}</span></div>`).join("")}</div>
  <div class="split"><section class="panel"><h2>📡 Feed</h2>${feedList(80)}</section>
  <aside>${scan ? `<section class="panel"><h2>Last scan</h2><p>${dCT(scan.ts)} · ${scan.cards_scanned}/${scan.cards_requested} cards · API ${scan.calls_today}/${scan.daily_limit} today</p>${scan.errors?.length ? `<p class="warn">${scan.errors.length} errors: ${scan.errors.map((e) => esc(e.card_id)).join(", ")}</p>` : ""}</section>` : ""}
  <section class="panel"><h2>Reports</h2>${S.reports.length ? S.reports.slice().reverse().map((r) => `<details><summary>${esc(r.title)} <small>${esc(r.date || "")}</small></summary><pre>${esc(r.body)}</pre></details>`).join("") : `<p class="empty">No reports yet.</p>`}</section></aside></div>`;
}

// ---------- render / boot
let lastKey = "", lastHtml = "";
const detKey = (d) => (d.querySelector("summary")?.textContent || "").replace(/\d+/g, "#").slice(0, 60);
function render(force) {
  if (!S.model) return;
  const [r, arg] = route(), tab = r === "card" ? "cards" : r;
  const views = { deals: vDeals, radar: vRadar, cards: vCards, card: () => vCard(arg), team: vTeam };
  const y = window.scrollY, key = location.hash;
  const html = shell((views[r] || vDeals)(), views[r] ? tab : "deals");
  if (key === lastKey && html === lastHtml) return;           // nothing changed: leave the DOM alone
  // Preserve UI state across data refreshes: open <details>, horizontal strips, focused input.
  const same = key === lastKey;
  const openSet = same ? new Set([...$app.querySelectorAll("details[open]")].map(detKey)) : new Set();
  const scrollX = same ? [...$app.querySelectorAll(".deals,.lanes,.rlist")].map((e) => [e.scrollLeft, e.scrollTop]) : [];
  $app.innerHTML = html; lastHtml = html;
  if (same) {
    $app.querySelectorAll("details").forEach((d) => { if (openSet.has(detKey(d))) d.open = true; });
    $app.querySelectorAll(".deals,.lanes,.rlist").forEach((e, i) => { if (scrollX[i]) { e.scrollLeft = scrollX[i][0]; e.scrollTop = scrollX[i][1]; } });
  }
  if (key !== lastKey) window.scrollTo(0, 0); else window.scrollTo(0, y);
  lastKey = key;
  document.title = `${{ deals: "Deals", radar: "Radar", cards: "Cards", card: S.model.byId[decodeURIComponent(arg || "")]?.name || "Card", team: "Team" }[r] || "Deals"} · Command Center`;
  bind();
}
function bind() {
  const q = document.getElementById("q");
  if (q) { q.oninput = () => { S.q = q.value; const pos = q.selectionStart; render(); const n = document.getElementById("q"); n.focus(); n.setSelectionRange(pos, pos); }; }
  document.querySelectorAll("[data-lang]").forEach((b) => (b.onclick = () => { S.lang = b.dataset.lang; render(); }));
  const so = document.getElementById("sort"); if (so) so.onchange = () => { S.sort = so.value; render(); };
  const out = document.getElementById("signout"); if (out) out.onclick = async () => { await D.backend().signOut(); location.reload(); };
}
async function loadAll() {
  try {
    const [watchlist, sold, active, history, calls, scans, reports] = await Promise.all([D.getWatchlist(), D.getSoldSales(), D.getActiveSnapshot(), D.getCardHistory(), D.getResearchCalls(), D.getScans(), D.getReports()]);
    S.model = buildModel({ watchlist, sold, active, history, calls }); S.scans = scans; S.reports = reports; S.error = null;
  } catch (e) { console.error(e); S.error = e.message; if (!S.model) { $app.innerHTML = `<div class="center"><h1>Couldn't load data</h1><p>${esc(e.message)}</p></div>`; return; } }
  render();
}
// ---------- sign-in (email → 6-8 digit code verified in-app; link still works in a browser)
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const SI = { step: "email", email: localStorage.getItem("cc-last-email") || "", msg: "", err: "", cooldownUntil: 0 };
function authErr(e) {
  const m = (e?.message || String(e)).toLowerCase();
  if (/expired|invalid|otp|token/.test(m)) return "That code is wrong or has expired. Check the newest email, or resend a code.";
  if (/rate|too many|security purposes|seconds/.test(m)) return "Too many tries — wait a minute, then resend.";
  return e?.message || String(e);
}
function signInScreen() {
  const be = D.backend(), left = Math.max(0, Math.ceil((SI.cooldownUntil - Date.now()) / 1000));
  const tip = standalone() ? `<p class="tip">📱 You're in the installed app: <b>type the code</b> from the email. Don't tap the link — it opens your browser instead of this app.</p>`
    : `<p class="tip">Type the code from the email, or tap the link in it.</p>`;
  $app.innerHTML = `<div class="center signin"><div class="mk big" aria-hidden="true">◆</div><h1>Command Center</h1>${SI.step === "email"
    ? `<p>Sign in with your email. We'll send a one-time code.</p>
       <form id="si"><input type="email" id="em" required placeholder="you@example.com" autocomplete="email" inputmode="email" aria-label="Email" value="${esc(SI.email)}"><button>Send code</button></form>`
    : `<p>Code sent to <b>${esc(SI.email)}</b>.</p>${tip}
       <form id="vc"><input id="code" class="code" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" minlength="6" maxlength="8" placeholder="••••••" aria-label="One-time code" enterkeyhint="go"><button class="go">Sign in</button></form>
       <div class="sirow"><button class="link" id="resend" ${left ? "disabled" : ""}>${left ? `Resend in ${left}s` : "Resend code"}</button><button class="link" id="other">Use a different email</button></div>`}
    ${SI.err ? `<p class="msg bad" role="alert">${esc(SI.err)}</p>` : SI.msg ? `<p class="msg">${esc(SI.msg)}</p>` : ""}</div>`;
  const send = async (email) => {
    SI.err = ""; SI.msg = "";
    try { const r = await be.signIn(email); if (r && r.error) throw r.error; SI.email = email.trim().toLowerCase(); localStorage.setItem("cc-last-email", SI.email);
      SI.step = "code"; SI.cooldownUntil = Date.now() + 60000; SI.msg = "Check your inbox (and spam)."; }
    catch (e) { SI.err = authErr(e); }
    signInScreen();
  };
  const f1 = document.getElementById("si");
  if (f1) f1.onsubmit = (e) => { e.preventDefault(); e.target.querySelector("button").disabled = true; send(document.getElementById("em").value); };
  const f2 = document.getElementById("vc");
  if (f2) {
    const inp = document.getElementById("code"); inp.focus();
    inp.oninput = () => { inp.value = inp.value.replace(/\D/g, "").slice(0, 8); };
    f2.onsubmit = async (e) => { e.preventDefault(); const btn = f2.querySelector("button"); btn.disabled = true; btn.textContent = "Checking…";
      try { await be.verifyCode(SI.email, inp.value); location.reload(); }
      catch (err) { SI.err = authErr(err); SI.msg = ""; signInScreen(); } };
    document.getElementById("resend").onclick = () => { if (Date.now() >= SI.cooldownUntil) send(SI.email); };
    document.getElementById("other").onclick = () => { SI.step = "email"; SI.err = SI.msg = ""; signInScreen(); };
    const tick = () => { const b = document.getElementById("resend"); if (SI.step !== "code" || !b) return; const l = Math.max(0, Math.ceil((SI.cooldownUntil - Date.now()) / 1000)); b.textContent = l ? `Resend in ${l}s` : "Resend code"; b.disabled = !!l; if (l) setTimeout(tick, 1000); };
    if (left) setTimeout(tick, 1000);
  }
}
async function start() {
  await loadAll();
  D.subscribeFeed((rows) => { S.feed = rows; render(); });
  D.subscribeAlerts((rows) => { S.alerts = rows; render(); });
  let t; D.subscribeData(() => { clearTimeout(t); t = setTimeout(loadAll, 300); });   // realtime: listings/scans/watchlist changed
  setInterval(loadAll, CONFIG.DATA_POLL_MS);
  window.addEventListener("hashchange", () => render());
  matchMedia("(max-width:600px)").addEventListener("change", () => render());
}
(async () => {
  const be = await D.init();
  if (be.needsAuth) {
    const s = await be.session();
    if (!s) { signInScreen(); be.onAuth((s2) => { if (s2 && !document.getElementById("vc")) location.reload(); }); return; }
    if (be.hasAccess && !(await be.hasAccess().catch(() => false))) {
      $app.innerHTML = `<div class="center signin"><div class="mk big" aria-hidden="true">◆</div><h1>No access</h1><p>${esc(s.user?.email || "This account")} isn't on the allowlist.</p><p><button id="so2">Sign out</button></p></div>`;
      document.getElementById("so2").onclick = async () => { await be.signOut(); location.reload(); }; return;
    }
  }
  start();
})();
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch((e) => console.warn("sw", e)));

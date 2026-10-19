import { CONFIG } from "./cfg.js";
import * as D from "./data.js";
import { buildModel, deals, warnFlags } from "./derive.js";
import { spark, priceChart, radar, phaseColor } from "./charts.js";
import { esc, money, pct, tCT, dCT, ago } from "./util.js";
import { priceBtn } from "./price.js";
import { alertPrice, alertActive } from "./fields.js";
import { bottomSection, bottomModel, meterHtml, phaseChip } from "./bottom.js";

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
    <div class="fresh">listings ${act ? `${tCT(act)} <small>(${ago(act)})</small>` : "—"} · sold thru ${sold || "—"}${scanErr}${D.backend()?.signOut ? ` · <a class="link" href="#/account">🔑 password</a> · <button class="link" id="signout">sign out</button>` : ""}</div></header>${pwBanner()}
    ${S.error ? `<div class="err" role="alert">Data problem: ${esc(S.error)}</div>` : ""}
    <main>${body}</main><nav class="tabs">${nav}</nav>`;
}
const cardLink = (c, inner) => `<a class="cl" href="#/card/${encodeURIComponent(c.id)}">${inner}</a>`;
const cname = (c) => `<span class="lg">${c.lang}</span> <b>${esc(c.name)}</b> <small>${esc(c.number)}${c.variant ? " · " + esc(c.variant) : ""}</small>`;
const phase = (p) => (p ? `<span class="ph" style="background:${phaseColor(p)}">${esc(p)}</span>` : `<span class="ph none">no call</span>`);
const badges = (l) => { const w = warnFlags(l); return (w.length ? w.map((f) => `<span class="flag" title="Scanner flag: check before buying">⚠ ${esc(f)}</span>`).join("") : "") + (l?.shipping_unknown ? `<span class="ship" title="Total excludes shipping">+ shipping not quoted</span>` : ""); };
const legit = (l) => (warnFlags(l).length ? `<span class="flag">⚠ check listing</span>` : `<span class="okb">✓ seller ${l?.feedback ?? "?"} fb, no flags</span>`);
const fb = (l) => (l?.feedback != null ? `${(+l.feedback).toLocaleString()} fb${l.feedback_pct ? " · " + esc(l.feedback_pct) + (String(l.feedback_pct).includes("%") ? "" : "%") : ""}` : "fb n/a");

// Reference-price flags: thin data = amber, market dropping / still falling = red. compact = icon-size (phone rows).
const FLAG_ICON = { "thin data": "◔", "market dropping": "▼", "still falling": "⇊" };
const flagBadges = (fl, compact) => (fl || []).map((f) => `<span class="rf ${/thin/i.test(f) ? "amber" : /dropping|falling/i.test(f) ? "red" : "grey"}${compact ? " ic" : ""}" title="${esc(f)}">${compact ? (FLAG_ICON[f] || "⚠") : "⚠ " + esc(f)}</span>`).join("");
const cardAlertFlags = (c) => [...new Set(S.alerts.filter((a) => alertActive(a) && a.card_id === c.id).flatMap((a) => a.flags || []))];
// reference = lower of sold_median_recent or active_p25 × k (k = sold-to-ask ratio, asks side only); buy_below = target_pct × reference.
const KIND_BADGE = { manual: ["man", "MANUAL"], auto_sold: ["auto", "AUTO · SOLD"], auto_asks: ["auto", "AUTO · ASKS"] };
function targetExplainer(c) {
  const r = c.ref; if (c.target.buy == null && r.reference == null) return "";
  const kind = r.kind || (r.manual != null ? "manual" : null);
  const [bc, bl] = KIND_BADGE[kind] || ["nod", "no data"];
  const badge = `<span class="tsrc ${bc}" title="${esc(r.source || "")}">${bl}</span>`;
  const askAdj = r.p25 != null && r.k != null ? r.p25 * r.k : null;
  const fairV = r.fair ?? r.soldMed, fairL = r.fair != null ? "fair now" : "sold"; const sold = `<span class="${kind === "auto_sold" ? "won" : ""}">${fairL} ${c2(fairV)}${r.fairCapped ? " <small>(capped)</small>" : ""}</span>`;
  const asks = r.p25 == null ? `<span>asks n/a</span>` : `<span class="${kind === "auto_asks" ? "won" : ""}">asks ${c2(r.p25)}${r.k != null ? ` × ${r.k} = ${c2(askAdj)}` : ""}</span>`;
  const pctTxt = r.pct != null ? `${Math.round(r.pct * 1000) / 10}% of ` : "";
  const autoV = r.manual != null ? r.auto : c.target.buy;
  const head = r.manual != null ? `Target ${c2(c.target.buy)} ${badge}<small class="autov">auto ${c2(autoV)} = ${pctTxt}${c2(r.reference)}</small>` : `Target ${c2(c.target.buy)} = ${pctTxt}${c2(r.reference)} ${badge}`;
  const ref = r.reference != null ? `<div class="tref">reference = lower of ${sold} or ${asks}${kind === "auto_sold" || kind === "auto_asks" ? ` → <b>${c2(r.reference)}</b>` : ""}</div>` : "";
  const tr = r.trend7 != null ? ` · 7d sold trend <b class="${r.trend7 < 0 ? "neg" : "pos"}">${r.trend7 < 0 ? "▼" : r.trend7 > 0 ? "▲" : "▶"} ${r.trend7 > 0 ? "+" : ""}${r.trend7.toFixed(1)}%</b>` : ` · trend n/a (needs 3+ sales per week)`;
  return `<section class="texp"><div class="tline">${head}</div>${ref}<div class="tsub">sold: last ${r.win ?? "?"}d, n=${r.soldN ?? "?"} · asks n=${r.activeN ?? "?"}${tr}${r.updated ? ` · updated ${dCT(r.updated)}` : ""}</div>${c.wflags.length ? `<div class="tflags">${flagBadges(c.wflags)}</div>` : ""}${c.sug.buy != null ? `<div class="tsug">Researcher's suggested buy-below ${money(c.sug.buy)}${c.sug.low != null && c.sug.high != null ? ` (zone ${money(c.sug.low)}–${money(c.sug.high)})` : ""} · context only</div>` : ""}</section>`;
}

// ---------- Deals
function dealCard(c, kind) {
  const ref = kind === "target" ? c.target.buy : c.sug.buy, l = c.lowest, refLabel = kind === "target" ? "your target" : "suggested buy-below";
  const under = c.med7 ? (1 - l.total / c.med7) * 100 : null;
  // The price breakdown sits OUTSIDE the card link so tapping it expands instead of navigating.
  return `<article class="deal ${kind}">${cardLink(c, `<div class="tag">${kind === "target" ? "✅ UNDER YOUR TARGET" : "💡 UNDER SUGGESTED ZONE · not an alert"}</div>
    <div class="dt">${cname(c)}</div>${l.title ? `<div class="ltitle">“${esc(l.title)}”</div>` : ""}`)}
    ${(() => { const bm = bottomModel(c), mt = meterHtml(bm, true), ch = phaseChip(bm); return mt || ch ? `<div class="dbot">${ch}${mt}</div>` : ""; })()}<div class="big">${priceBtn(l, { key: "deal-" + c.id, target: ref, targetLabel: refLabel })}</div>
    ${cardLink(c, `<div class="vs">7d sold median <b>${money(c.med7)}</b> · ${refLabel} <b>${money(ref)}</b> <small>(item+ship ${money(l.total)})</small></div>
    ${under != null ? `<div class="pill">▼ ${under.toFixed(0)}% under market</div>` : ""}
    <div class="sel">seller <b>${esc(l.seller || "?")}</b> · ${fb(l)} · ${esc(l.condition || "")}</div><div class="badges">${legit(l)}${badges(l)}${flagBadges([...new Set([...cardAlertFlags(c), ...c.wflags])])}</div>`)}
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
  const rows = near.map((c) => `<tr onclick="location.hash='#/card/${encodeURIComponent(c.id)}'"><td>${cardLink(c, cname(c))} ${flagBadges(c.wflags, true)}</td><td>${phase(c.sug.phase)}</td><td class="n">${money(c.med7)}</td>
    <td class="n">${money(c.effBuy)}<small class="src ${c.src}">${c.src === "target" ? "yours" : "sugg."}</small></td>
    <td><div class="bar"><i style="width:${Math.max(4, Math.min(100, 100 - c.dist * 2))}%;background:${c.dist <= 10 ? "#2ee6a6" : c.dist <= 30 ? "#ffcb05" : "#ff9f1c"}"></i></div><small class="n">${c.dist <= 0 ? "in zone" : pct(c.dist) + " above"}</small></td>
    <td class="hide-s">${spark(c.daily.map((x) => x[1]), 90, 24)}</td><td class="n hide-s">${priceBtn(c.lowest, { key: "near-" + c.id, pop: true, compact: true, target: c.effBuy, targetLabel: c.src === "target" ? "your target" : "suggested" })}</td><td class="n hide-s">${c.s7 ?? "—"}</td></tr>`).join("");
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
const c2 = (v) => v == null || isNaN(+v) ? "—" : "$" + (+v).toFixed(2);
function pastPrice(x) {
  const it = x.item_usd ?? x.value, sh = x.shipping_usd;
  const base = it == null ? "" : sh != null ? `· was ${c2(+it + +sh)} item+ship` : `· was ${c2(it)} item, shipping unknown`;
  return base + (x.total_with_tax_usd != null ? ` (${c2(x.total_with_tax_usd)} all-in)` : "");
}
function pastAlerts() {
  const p = S.alerts.filter((x) => !alertActive(x)).reverse();
  if (!p.length) return "";
  return `<details class="past" data-k="past-alerts"><summary>Past alerts (${p.length})</summary>${p.map((x) => `<div class="pal"><span class="pst">${esc(x.status)}</span> ${esc(x.card)} ${esc(x.number || "")} ${pastPrice(x)}${x.status_reason ? `<div class="psr">${esc(x.status_reason)}</div>` : ""}<small>fired ${dCT(x.ts)}${x.status_checked_at ? ` · checked ${dCT(x.status_checked_at)}` : ""}</small></div>`).join("")}</details>`;
}
const alTier = (x) => (String(x.tier || "DEAL").toUpperCase() === "WATCH" ? "WATCH" : "DEAL");
const alLbl = (x) => (alTier(x) === "WATCH" ? "👀 watching" : x.direction === "above_sell" ? "📤 SELL" : "📥 BUY");
const alZone = (x) => { if (x.zone_low == null || x.zone_high == null) return "";
  const d = x.zone_distance_pct, t = d == null ? "" : +d === 0 ? " · inside the zone" : +d > 0 ? ` · ${(+d).toFixed(0)}% above zone` : ` · ${Math.abs(+d).toFixed(0)}% below zone`;
  return `<div class="alz">bottom zone ${money(x.zone_low)}–${money(x.zone_high)}${t}${x.phase ? ` · ${esc(x.phase)}` : ""}</div>`; };
const alRow = (x) => x.alert_text ? `<div class="al"><b>${alLbl(x)}</b> ${esc(x.alert_text)} ${x.price_kind === "lowest_active" ? `<div class="alp">${priceBtn(alertPrice(x), { key: "al-" + (x.ts || "") + x.card_id, compact: true, target: x.target, targetLabel: x.direction === "above_sell" ? "your sell target" : "your buy target" })}</div>` : ""}${alZone(x)}${alTier(x) === "WATCH" && x.tier_reason ? `<div class="twr">why watch: ${esc(x.tier_reason)}</div>` : ""}${flagBadges(x.flags)}<small>${dCT(x.ts)}</small>${x.link ? ` <a href="${esc(x.link)}" target="_blank" rel="noopener">↗</a>` : ""}</div>` : `<div class="al"><b>${alLbl(x)}</b> ${esc(x.card)} ${esc(x.number || "")} — ${esc(KIND[x.price_kind] || x.price_kind || "price")} ${x.price_kind === "lowest_active" ? priceBtn(alertPrice(x), { key: "al-" + (x.ts || "") + x.card_id, compact: true, target: x.target, targetLabel: x.direction === "above_sell" ? "your sell target" : "your buy target" }) : money(x.value)} is ${x.direction === "above_sell" ? "above your sell" : "below your buy"} target ${money(x.target)} ${alZone(x)}${alTier(x) === "WATCH" && x.tier_reason ? `<div class="twr">why watch: ${esc(x.tier_reason)}</div>` : ""}${flagBadges(x.flags)}<small>${dCT(x.ts)}</small>${x.link ? ` <a href="${esc(x.link)}" target="_blank" rel="noopener">↗</a>` : ""}</div>`;
function alertsBox(anyTargets) {
  const a = S.alerts.filter(alertActive).slice(-8).reverse(), deal = a.filter((x) => alTier(x) === "DEAL"), watch = a.filter((x) => alTier(x) === "WATCH");
  return `<section class="panel alerts"><h2>🚨 Alerts</h2>${a.length ? `${deal.length ? `<div class="altier deal"><h3>🔥 DEAL <small>pushed</small></h3>${deal.map(alRow).join("")}</div>` : ""}${watch.length ? `<div class="altier watch"><h3>👀 Watching (still falling) <small>under target, not pushed — not a buy signal yet</small></h3>${watch.map(alRow).join("")}</div>` : ""}`
    : `<p class="empty">${anyTargets ? (S.alerts.length ? "No live alerts right now." : "No alerts fired yet.") : "No alerts yet — set buy_below / sell_above targets to enable."}</p>`}${pastAlerts()}</section>`;
}
function feedList(n) {
  const f = S.feed.slice(-n).reverse();
  return f.length ? f.map((x) => `<div class="fi" style="border-color:${who(x.from)}"><b style="color:${who(x.from)}">${esc(x.from)}</b>${x.to ? ` <small>→ ${esc(x.to)}</small>` : ""} <i>${tCT(x.ts)}</i><p>${esc(x.text)}</p></div>`).join("") : `<p class="empty">No team messages yet.</p>`;
}

// ---------- Radar
function vRadar() {
  const { svg, inz, out } = radar(S.model.cards, small());
  const list = [...inz, ...out].sort((a, b) => a.dist - b.dist).map((c) => `<li>${cardLink(c, `<span class="nm">${cname(c)} ${flagBadges(c.wflags, true)}</span>${phase(c.sug.phase)}<span class="d n">${c.dist <= 2 ? "in zone" : "+" + c.dist.toFixed(0) + "%"}</span>`)}</li>`).join("");
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
  <div class="grid">${cs.map((c) => cardLink(c, `<article class="mini"><div>${cname(c)}</div>${spark(c.daily.map((x) => x[1]), 150, 34, phaseColor(c.sug.phase))}<div class="mrow"><span class="n big2">${money(c.med7)}</span>${phase(c.sug.phase)}</div><div class="mrow s"><span>${c.dist == null ? "no zone" : c.dist <= 2 ? "in zone" : pct(c.dist) + " above " + (c.src === "target" ? "your target" : "suggested")}</span><span>ask</span></div></article>`)).join("") || `<p class="empty">No cards match.</p>`}</div>`;
}

// ---------- Card page
function vCard(id) {
  const c = S.model.byId[decodeURIComponent(id || "")];
  if (!c) return `<section class="hero"><h1 class="verdict">Card not found</h1><p class="sub"><a href="#/cards">Back to all cards</a></p></section>`;
  const l = c.lowest;
  const row = (x) => { const vs = c.med7 && x.total != null ? (x.total / c.med7 - 1) * 100 : null; const good = c.effBuy && x.total <= c.effBuy;
    return `<tr><td class="n ${good ? "good" : ""}">${priceBtn(x, { key: "ls-" + (x.item_id || x.url), pop: true, compact: true, target: c.effBuy, targetLabel: c.src === "target" ? "your target" : "suggested" })}</td><td>${esc(x.seller || "?")}<small>${fb(x)}</small>${x.title ? `<small class="lt">${esc(x.title)}</small>` : ""}${warnFlags(x).length ? `<div>${badges({ ...x, shipping_unknown: false })}</div>` : ""}</td><td class="hide-s">${esc(x.condition || "")}</td><td class="n ${vs != null && vs < 0 ? "good" : ""}">${pct(vs)}</td><td>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener" aria-label="Open listing on eBay">eBay ↗</a>` : ""}</td></tr>`; };
  const listings = c.listings.length ? c.listings.slice(0, 10).map(row).join("") + (c.listings.length > 10 ? `</tbody></table><details class="more-l"><summary>Show ${c.listings.length - 10} more listings</summary><table class="tbl lst"><tbody>${c.listings.slice(10).map(row).join("")}` : "") : "";
  const tgt = c.target.buy != null ? `<div class="st"><small>YOUR BUY TARGET · ${c.ref.kind === "manual" || c.ref.manual != null ? "manual" : c.ref.kind ? "auto" : "no data"}</small><b class="yel">${money(c.target.buy)}</b>${c.med7 ? pct((c.med7 / c.target.buy - 1) * 100) + " to go" : ""}${c.sug.buy != null ? `<br><small>suggested ${money(c.sug.buy)} (research)</small>` : ""}</div>`
    : c.sug.buy == null ? `<div class="st"><small>SUGGESTED BUY-BELOW <span class="sugg">research</span></small><b>—</b>no suggested zone yet<br><small>no target set</small></div>`
    : `<div class="st"><small>SUGGESTED BUY-BELOW <span class="sugg">research</span></small><b class="grn">${money(c.sug.buy)}</b>${c.dist != null ? (c.dist <= 0 ? "median in zone" : pct(c.dist) + " to go") : "no zone yet"}<br><small>no target set</small></div>`;
  return `<a class="back" href="#/cards">← All cards</a><section class="cardhead"><h1>${esc(c.name)} <span>${esc(c.number)}</span></h1><p>${c.variant ? esc(c.variant) + " · " : ""}${c.lang === "JP" ? "Japanese" : "English"} · raw · eBay sold comps, sellers ${CONFIG.MIN_SELLER_FEEDBACK}+ fb</p></section>
  ${targetExplainer(c)}<div class="stats"><div class="st"><small>7D SOLD MEDIAN</small><b>${money(c.med7)}</b>${c.s7 != null ? c.s7 + " sales" : ""}${c.trend ? ` · trend <b class="inl">${esc(c.trend)}</b>` : ""}<br>30d ${money(c.med30)}${c.s30 != null ? ` (${c.s30} sales)` : ""}${c.lastSale ? ` · last $${esc(c.lastSale.replace("@", " on "))}` : ""}</div>
  <div class="st"><small>LOWEST REPUTABLE ASK</small><b class="pink">${money(l?.total)}</b>${c.askVsMed != null ? pct(c.askVsMed, 1) + " vs median" : "no listing"}</div>${tgt}
  <div class="st"><small>ACTIVE (REPUTABLE)</small><b>${c.activeCount ?? "—"}</b>${c.ebayTotal != null ? `of ${c.ebayTotal.toLocaleString()} on eBay · ` : ""}scanned ${tCT(c.scanned_at)}</div></div>
  ${l ? `<div class="lowl"><div class="lowp">Lowest reputable ${priceBtn(l, { key: "low-" + c.id, target: c.effBuy, targetLabel: c.src === "target" ? "your target" : "suggested buy-below" })}</div>${l.title ? `“${esc(l.title)}” ` : ""}<span class="badges">${legit(l)}${badges(l)}</span>${l.url ? ` <a href="${esc(l.url)}" target="_blank" rel="noopener">eBay ↗</a>` : ""}</div>` : ""}
  ${bottomSection(c, small())}<div class="cardgrid"><section class="panel">${priceChart(c, small())}<p class="note">Dots are individual eBay sold comps${c.outliers ? ` (${c.outliers} outlier${c.outliers > 1 ? "s" : ""} dropped from the median)` : ""}. Medians come from ${c.histCount} history snapshot${c.histCount === 1 ? "" : "s"}${c.histDate ? ` (${esc(c.histDate)})` : ""}; the trend line will fill in as daily snapshots accumulate.</p></section>
  <div><section class="panel call" style="border-color:${phaseColor(c.sug.phase)}">${c.sug.call ? `<h2 style="color:${phaseColor(c.sug.phase)}">Research: ${esc((c.sug.phase || "").toUpperCase())}</h2><p>${esc(c.sug.call)}</p>${c.sug.prediction ? `<p class="pred">${esc(c.sug.prediction)}</p>` : ""}<p>confidence <b>${esc(c.sug.conf || "?")}</b> · call ${esc(c.sug.date || "")} · review by ${esc(c.sug.review_by || "—")}</p>${c.sug.links.length ? `<details><summary>${c.sug.links.length} sources</summary>${c.sug.links.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, "").slice(0, 60))}</a>`).join("")}</details>` : ""}` : `<p class="empty">No research call for this card yet.</p>`}</section>
  ${c.auctions.length ? `<section class="panel"><h2>⏱ Auctions ending soon</h2><table class="tbl lst"><tbody>${c.auctions.map((x) => `<tr><td class="n">${priceBtn(x, { key: "au-" + (x.item_id || x.url), pop: true, compact: true, target: c.effBuy, targetLabel: c.src === "target" ? "your target" : "suggested" })}<small>${x.bids ?? 0} bid${x.bids === 1 ? "" : "s"}</small></td><td>${esc(x.seller || "?")}<small>${fb(x)}</small>${x.title ? `<small class="lt">${esc(x.title)}</small>` : ""}</td><td><small>ends</small>${esc(dCT(x.end_date))}</td><td>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">eBay ↗</a>` : ""}</td></tr>`).join("")}</tbody></table></section>` : ""}
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
  ${D.backend().kind === "supabase" ? `<section class="panel"><h2>Account</h2><p><a class="link" href="#/account">🔑 Set or change password</a></p></section>` : ""}<section class="panel"><h2>Reports</h2>${S.reports.length ? S.reports.slice().reverse().map((r) => `<details><summary>${esc(r.title)} <small>${esc(r.date || "")}</small></summary><pre>${esc(r.body)}</pre></details>`).join("") : `<p class="empty">No reports yet.</p>`}</section></aside></div>`;
}

// ---------- render / boot
let lastKey = "", lastHtml = "";
const detKey = (d) => d.dataset.k || (d.querySelector("summary")?.textContent || "").replace(/\d+/g, "#").slice(0, 60);
function render(force) {
  if (!S.model) return;
  const [r, arg] = route(), tab = r === "card" ? "cards" : r;
  const views = { deals: vDeals, radar: vRadar, cards: vCards, card: () => vCard(arg), team: vTeam, account: vAccount };
  const y = window.scrollY, key = location.hash;
  if (r === "account" && key === lastKey && !force) return;   // don't wipe a half-typed password on data polls
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
  document.querySelectorAll("details.pt > summary").forEach((sm) => (sm.onclick = (e) => { e.preventDefault(); e.stopPropagation(); const d = sm.parentElement; d.open = !d.open; }));
  const q = document.getElementById("q");
  if (q) { q.oninput = () => { S.q = q.value; const pos = q.selectionStart; render(); const n = document.getElementById("q"); n.focus(); n.setSelectionRange(pos, pos); }; }
  document.querySelectorAll("[data-lang]").forEach((b) => (b.onclick = () => { S.lang = b.dataset.lang; render(); }));
  const so = document.getElementById("sort"); if (so) so.onchange = () => { S.sort = so.value; render(); };
  bindAccount();
  const off = document.getElementById("pwoff"); if (off) off.onclick = () => { localStorage.setItem("cc-pw-banner-off", "1"); lastHtml = ""; render(); };
  const out = document.getElementById("signout"); if (out) out.onclick = async () => { await D.backend().signOut(); location.reload(); };
}
async function loadAll() {
  try {
    const [watchlist, sold, active, history, calls, scans, reports] = await Promise.all([D.getWatchlist(), D.getSoldSales(), D.getActiveSnapshot(), D.getCardHistory(), D.getResearchCalls(), D.getScans(), D.getReports()]);
    S.model = buildModel({ watchlist, sold, active, history, calls }); S.scans = scans; S.reports = reports; S.error = null;
  } catch (e) { console.error(e); S.error = e.message; if (!S.model) { $app.innerHTML = `<div class="center"><h1>Couldn't load data</h1><p>${esc(e.message)}</p></div>`; return; } }
  render();
}
// ---------- sign-in: email + password (primary, works in the home-screen app without SMTP);
// magic link = fallback for Safari; code box hidden behind "I have a code".
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const SI = { mode: "password", email: localStorage.getItem("cc-last-email") || "", msg: "", err: "", cooldownUntil: 0, showPw: false };
function authErr(e, ctx) {
  const m = (e?.message || String(e)).toLowerCase(), code = (e?.code || "").toLowerCase();
  if (ctx === "password" && (/invalid login credentials|invalid_credentials/.test(m + code)))
    return "Wrong email or password. If you've never set a password, use “Email me a sign-in link” in Safari first, then set one under 🔑 Password.";
  if (/email not confirmed/.test(m)) return "This email isn't confirmed yet — use the sign-in link email once in Safari.";
  if (/expired|invalid|otp|token/.test(m)) return "That code is wrong or has expired. Check the newest email, or send a new link.";
  if (/rate|too many|security purposes|seconds/.test(m)) return "Too many tries — wait a minute and try again.";
  if (/failed to fetch|network/.test(m)) return "No connection — check your internet and try again.";
  return e?.message || String(e);
}
const eye = (id) => `<button type="button" class="pwtoggle" data-for="${id}" aria-label="Show password">${SI.showPw ? "Hide" : "Show"}</button>`;
function signInScreen() {
  const be = D.backend(), left = Math.max(0, Math.ceil((SI.cooldownUntil - Date.now()) / 1000));
  const saf = standalone() ? `<p class="tip">📱 You're in the home-screen app. The sign-in link opens in <b>Safari</b>, not here — so sign in there once, set a password (🔑 Password in the header), then come back and sign in here with it.</p>` : "";
  let body;
  if (SI.mode === "password") body = `<p>Sign in with your email and password.</p>
    <form id="pw" autocomplete="on"><input type="email" id="em" name="email" required placeholder="you@example.com" autocomplete="email" inputmode="email" aria-label="Email" value="${esc(SI.email)}">
    <div class="pwrow"><input type="${SI.showPw ? "text" : "password"}" id="pass" name="password" required placeholder="Password" autocomplete="current-password" aria-label="Password">${eye("pass")}</div>
    <button class="go">Sign in</button></form>
    <div class="sirow"><button class="link" id="tolink">Email me a sign-in link</button><button class="link" id="tocode">I have a code</button></div>`;
  else if (SI.mode === "link") body = `<p>No password yet? We'll email you a sign-in link. <b>Open it in Safari</b>, then set a password under 🔑 Password.</p>${saf}
    <form id="ln"><input type="email" id="em" required placeholder="you@example.com" autocomplete="email" inputmode="email" aria-label="Email" value="${esc(SI.email)}"><button class="go" ${left ? "disabled" : ""}>${left ? `Wait ${left}s` : "Email me a link"}</button></form>
    <div class="sirow"><button class="link" id="topw">← Sign in with password</button><button class="link" id="tocode">I have a code</button></div>`;
  else body = `<p>Enter the code from your email${SI.email ? ` for <b>${esc(SI.email)}</b>` : ""}.</p>
    <form id="vc">${SI.email ? "" : `<input type="email" id="em" required placeholder="you@example.com" autocomplete="email" aria-label="Email">`}<input id="code" class="code" required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" minlength="6" maxlength="8" placeholder="••••••" aria-label="One-time code"><button class="go">Sign in</button></form>
    <div class="sirow"><button class="link" id="topw">← Sign in with password</button></div>`;
  $app.innerHTML = `<div class="center signin"><div class="mk big" aria-hidden="true">◆</div><h1>Command Center</h1>${body}
    ${SI.err ? `<p class="msg bad" role="alert">${esc(SI.err)}</p>` : SI.msg ? `<p class="msg">${esc(SI.msg)}</p>` : ""}</div>`;
  const go = (mode) => { SI.mode = mode; SI.err = SI.msg = ""; signInScreen(); };
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on("tolink", () => go("link")); on("tocode", () => go("code")); on("topw", () => go("password"));
  document.querySelectorAll(".pwtoggle").forEach((b) => (b.onclick = () => { SI.showPw = !SI.showPw; const inp = document.getElementById(b.dataset.for); inp.type = SI.showPw ? "text" : "password"; b.textContent = SI.showPw ? "Hide" : "Show"; }));
  const remember = (em) => { SI.email = em.trim().toLowerCase(); localStorage.setItem("cc-last-email", SI.email); };
  const f = document.getElementById("pw");
  if (f) f.onsubmit = async (e) => { e.preventDefault(); const btn = f.querySelector(".go"); btn.disabled = true; btn.textContent = "Signing in…";
    const em = document.getElementById("em").value; remember(em);
    try { await be.signInWithPassword(em, document.getElementById("pass").value); localStorage.setItem("cc-pw-set", "1"); location.reload(); }
    catch (err) { SI.err = authErr(err, "password"); SI.msg = ""; signInScreen(); } };
  const l = document.getElementById("ln");
  if (l) l.onsubmit = async (e) => { e.preventDefault(); const em = document.getElementById("em").value; remember(em); SI.err = SI.msg = "";
    try { const r = await be.signIn(em); if (r && r.error) throw r.error; SI.cooldownUntil = Date.now() + 60000; SI.msg = standalone() ? "Sent. Open the email in Safari (not this app), set a password there, then come back." : "Sent — check your inbox (and spam), then open the link."; }
    catch (err) { SI.err = authErr(err); }
    signInScreen(); };
  if (l && left) setTimeout(() => SI.mode === "link" && signInScreen(), 1000);
  const v = document.getElementById("vc");
  if (v) { const inp = document.getElementById("code"); inp.oninput = () => { inp.value = inp.value.replace(/\D/g, "").slice(0, 8); };
    v.onsubmit = async (e) => { e.preventDefault(); const emEl = document.getElementById("em"); if (emEl) remember(emEl.value);
      try { await be.verifyCode(SI.email, inp.value); location.reload(); } catch (err) { SI.err = authErr(err); signInScreen(); } }; }
}

// ---------- account: set / change password
function jwtAmr() { try { const raw = JSON.parse(localStorage.getItem("cc-auth") || "{}"); const p = JSON.parse(atob(raw.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return (p.amr || []).map((a) => a.method || a); } catch { return []; } }
const needsPwBanner = () => D.backend()?.kind === "supabase" && !localStorage.getItem("cc-pw-set") && !localStorage.getItem("cc-pw-banner-off") && !jwtAmr().includes("password");
const pwBanner = () => (needsPwBanner() ? `<div class="pwban">🔑 Set a password so the home-screen app can sign you in without email links. <a href="#/account">Set password</a> <button class="link" id="pwoff" aria-label="Dismiss">Not now</button></div>` : "");
const ACC = { msg: "", err: "" };
function vAccount() {
  if (D.backend().kind !== "supabase") return `<section class="hero"><h1 class="verdict">Account</h1><p class="sub">Local dev mode — no account.</p></section>`;
  return `<section class="hero"><h1 class="verdict">🔑 Password</h1><p class="sub">Set a password once; then sign in with email + password in the home-screen app (iPhone Keychain can save it).</p></section>
  <section class="panel acct"><form id="setpw" autocomplete="on"><input type="email" name="email" autocomplete="username" value="${esc(localStorage.getItem("cc-last-email") || "")}" hidden>
  <label>New password<div class="pwrow"><input type="password" id="np1" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters">${eye("np1")}</div></label>
  <label>Confirm password<input type="password" id="np2" required minlength="8" autocomplete="new-password" placeholder="Type it again"></label>
  <button class="go">Save password</button></form>
  ${ACC.err ? `<p class="msg bad" role="alert">${esc(ACC.err)}</p>` : ACC.msg ? `<p class="msg">${esc(ACC.msg)}</p>` : ""}
  <p class="empty">Signed in as ${esc(localStorage.getItem("cc-last-email") || "you")}. <button class="link" id="signout2">Sign out</button></p></section>`;
}
function bindAccount() {
  const f = document.getElementById("setpw"); if (!f) return;
  document.querySelectorAll(".pwtoggle").forEach((b) => (b.onclick = () => { const i = document.getElementById(b.dataset.for); const show = i.type === "password"; i.type = show ? "text" : "password"; document.getElementById("np2").type = i.type; b.textContent = show ? "Hide" : "Show"; }));
  f.onsubmit = async (e) => { e.preventDefault(); ACC.err = ACC.msg = "";
    const a = document.getElementById("np1").value, b = document.getElementById("np2").value;
    if (a.length < 8) ACC.err = "Use at least 8 characters.";
    else if (a !== b) ACC.err = "The two passwords don't match.";
    else { const btn = f.querySelector(".go"); btn.disabled = true; btn.textContent = "Saving…";
      try { await D.backend().setPassword(a); localStorage.setItem("cc-pw-set", "1"); ACC.msg = "Password saved. In the home-screen app, sign in with your email and this password."; }
      catch (err) { const m = (err?.message || "").toLowerCase();
        ACC.err = /reauth|recent|nonce|secure password/.test(m) ? "For security, Supabase needs a fresh sign-in before changing the password. Sign out, sign in again with the email link (in Safari), then set the password right away."
          : /same|different from the old/.test(m) ? "That's already your password — nothing to change."
          : /weak|short|characters/.test(m) ? "Password too weak: " + err.message : authErr(err); } }
    render(true); };
  const so = document.getElementById("signout2"); if (so) so.onclick = async () => { await D.backend().signOut(); location.reload(); };
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

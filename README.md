# Pokémon Command Center

Static, client-side dashboard for Zoos's Pokémon card team. Hosted on GitHub Pages; data comes from Supabase
(project `pokemon-team`) and is readable only by signed-in, allowlisted emails (RLS). No data or secrets live here.

- `js/config.js` – public Supabase URL + publishable key (safe under RLS)
- `js/data.js` – data layer (`window.PokeData`): auth, queries, derived watchlist/deals, polling
- `js/app.js` + `index.html` – placeholder UI; replace freely, keep using `PokeData`

Deploy: commit to `main`; Pages serves the repo root (`.nojekyll` present).

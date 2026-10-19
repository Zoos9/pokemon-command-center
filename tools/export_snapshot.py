#!/usr/bin/env python3
"""Local dev mirror of the Supabase tables. Uses the SAME row builders as sync/push_to_supabase.py,
so web-data/<table>.json has exactly the Supabase column shapes. Written OUTSIDE web/ (never deployed).
  python3 tools/export_snapshot.py             # once
  python3 tools/export_snapshot.py --watch 60  # re-export every 60s
"""
import importlib.util, json, os, sys, time
BASE = os.environ.get("POKE_TEAM_DIR", "/home/box/pokemon-team")
OUT = os.environ.get("WEB_DATA_DIR", os.path.join(BASE, "web-data"))
spec = importlib.util.spec_from_file_location("pts", os.path.join(BASE, "sync", "push_to_supabase.py"))
pts = importlib.util.module_from_spec(spec); spec.loader.exec_module(pts)   # builders only; no network, no token

def strip(r):
    r = {k: v for k, v in r.items() if k != "data"}          # raw copy column: not used by the app
    for k in ("lowest_reputable", "lowest_flagged"):
        if isinstance(r.get(k), dict): r[k] = {a: b for a, b in r[k].items() if a != "image"}
    for k in ("listings", "auctions_ending_soon"):
        if isinstance(r.get(k), list): r[k] = [{a: b for a, b in (l or {}).items() if a != "image"} for l in r[k]]
    return r

def export():
    os.makedirs(OUT, exist_ok=True); counts = {}
    for table, _pk, build in pts.BUILDERS:
        rows = [strip(r) for r in build()]
        counts[table] = len(rows)
        tmp = os.path.join(OUT, table + ".json.tmp")
        json.dump(rows, open(tmp, "w"), ensure_ascii=False, separators=(",", ":"), default=str)
        os.replace(tmp, os.path.join(OUT, table + ".json"))
    return counts

if __name__ == "__main__":
    if "--watch" in sys.argv:
        n = int(sys.argv[sys.argv.index("--watch") + 1])
        while True:
            try: export()
            except Exception as e: print("export error", e, flush=True)
            time.sleep(n)
    else: print(export())

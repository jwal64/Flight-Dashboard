#!/usr/bin/env python3
"""
ESPN Fantasy Football League Exporter  --  no cookies required (public-league method)

Pulls every season you ask for from ESPN's public read API and writes ONE FILE
PER CATEGORY PER SEASON, organized into category folders:

  espn_export/
    raw/<year>.json                     full untouched payload per season
    standings/standings_<year>.csv      records, points for/against, final rank, owners
    matchups/matchups_<year>.csv        every week's home/away score + winner
    draft/draft_<year>.csv              every pick: round, overall, team, player, bid
    transactions/transactions_<year>.csv  adds / drops / trades (best-effort)
    rosters/rosters_<year>.csv          final rosters by team with lineup slot

Default config is already set for league 98790873, seasons 2019-2025.

USAGE (zero pip installs -- standard library only, needs Python 3.7+):
    python3 espn_ffl_export.py
    python3 espn_ffl_export.py --league 98790873 --years 2019 2020 2021 2022 2023 2024 2025
    python3 espn_ffl_export.py --out ./my_folder

PRIVATE LEAGUES (optional, you asked to AVOID cookies so this is off by default):
    If a given season's league is private, the public endpoint returns 401/403.
    Only then do you need auth. You can supply it via environment variables without
    editing the file:
        export ESPN_S2='your_espn_s2_value'
        export ESPN_SWID='{your-swid-with-braces}'
    With those unset (the default), the script sends no cookies at all.
"""

import argparse
import csv
import json
import os
import time
import urllib.error
import urllib.request

# ---------------------------------------------------------------- config ----
DEFAULT_LEAGUE_ID = 98790873
DEFAULT_YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025]

# Modern endpoint works for 2018+. leagueHistory is a fallback for older years.
SEASONS_URL = ("https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/"
               "seasons/{year}/segments/0/leagues/{league}")
HISTORY_URL = ("https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/"
               "leagueHistory/{league}?seasonId={year}")
PLAYERS_URL = ("https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/"
               "seasons/{year}/players?view=players_wl")

# All the league views we want in a single request.
VIEWS = ["mTeam", "mRoster", "mMatchup", "mSettings", "mStandings",
         "mDraftDetail", "mTransactions2", "mSchedule", "mStatus"]

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

# ESPN lineup-slot ids -> readable position
SLOTS = {0: "QB", 1: "TQB", 2: "RB", 3: "RB/WR", 4: "WR", 5: "WR/TE", 6: "TE",
         7: "OP", 8: "DT", 9: "DE", 10: "LB", 11: "DL", 12: "CB", 13: "S",
         14: "DB", 15: "DP", 16: "D/ST", 17: "K", 18: "P", 19: "HC", 20: "BE",
         21: "IR", 23: "FLEX", 24: "ER", 25: "Rookie"}


# ------------------------------------------------------------- networking ---
def fetch(url, extra_headers=None):
    req = urllib.request.Request(url)
    req.add_header("User-Agent", UA)
    req.add_header("Accept", "application/json")
    for k, v in (extra_headers or {}).items():
        req.add_header(k, v)
    s2 = os.environ.get("ESPN_S2")
    swid = os.environ.get("ESPN_SWID")
    if s2 and swid:                                  # only if user opts in
        if not swid.startswith("{"):
            swid = "{" + swid + "}"
        req.add_header("Cookie", f"espn_s2={s2}; SWID={swid}")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def build_league_url(base, league, year):
    sep = "&" if "?" in base else "?"
    return f"{base.format(year=year, league=league)}{sep}" + "&".join(
        "view=" + v for v in VIEWS)


def normalize(data):
    # leagueHistory returns a list of season objects; seasons returns one object
    if isinstance(data, list):
        return data[0] if data else {}
    return data


def get_season(league, year):
    """Modern endpoint first; fall back to leagueHistory on 404."""
    try:
        return normalize(fetch(build_league_url(SEASONS_URL, league, year))), "seasons"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return normalize(fetch(build_league_url(HISTORY_URL, league, year))), "leagueHistory"
        raise


def fetch_player_map(year):
    """season-wide playerId -> fullName (best-effort)."""
    try:
        data = fetch(PLAYERS_URL.format(year=year),
                     extra_headers={"x-fantasy-filter":
                                    json.dumps({"filterActive": {"value": True}})})
    except Exception:
        return {}
    out = {}
    if isinstance(data, list):
        for p in data:
            if isinstance(p, dict) and p.get("id") is not None and p.get("fullName"):
                out[p["id"]] = p["fullName"]
    return out


# --------------------------------------------------------------- parsing ----
def team_name(t):
    if t.get("name"):
        return t["name"].strip()
    full = ((t.get("location") or "") + " " + (t.get("nickname") or "")).strip()
    return full or f"Team {t.get('id')}"


def member_map(league):
    out = {}
    for m in league.get("members") or []:
        disp = m.get("displayName") or (
            (m.get("firstName") or "") + " " + (m.get("lastName") or "")).strip()
        if m.get("id"):
            out[m["id"]] = disp or m["id"]
    return out


def augment_player_map(node, out):
    """Recursively fill any playerId -> fullName found in the league payload."""
    if isinstance(node, dict):
        if node.get("fullName") and isinstance(node.get("id"), int):
            out.setdefault(node["id"], node["fullName"])
        pl = node.get("player")
        if isinstance(pl, dict) and pl.get("fullName") and isinstance(pl.get("id"), int):
            out.setdefault(pl["id"], pl["fullName"])
        for v in node.values():
            augment_player_map(v, out)
    elif isinstance(node, list):
        for v in node:
            augment_player_map(v, out)


def standings_rows(league, year):
    members = member_map(league)
    teams = {t.get("id"): t for t in league.get("teams") or []}
    rows = []
    for t in teams.values():
        rec = (t.get("record") or {}).get("overall") or {}
        owners = "; ".join(members.get(o, o) for o in (t.get("owners") or []))
        rows.append({
            "season": year, "teamId": t.get("id"), "team": team_name(t),
            "abbrev": t.get("abbrev", ""), "owners": owners,
            "wins": rec.get("wins"), "losses": rec.get("losses"),
            "ties": rec.get("ties"),
            "pointsFor": round(rec.get("pointsFor") or 0, 2),
            "pointsAgainst": round(rec.get("pointsAgainst") or 0, 2),
            "playoffSeed": t.get("playoffSeed"),
            "finalRank": t.get("rankCalculatedFinal") or t.get("rankFinal"),
        })
    rows.sort(key=lambda r: (r["finalRank"] is None, r["finalRank"] or 999))
    return rows


def matchup_rows(league, year):
    names = {t.get("id"): team_name(t) for t in league.get("teams") or []}
    rows = []
    for g in league.get("schedule") or []:
        h, a = g.get("home") or {}, g.get("away") or {}
        rows.append({
            "season": year, "week": g.get("matchupPeriodId"),
            "playoffTier": g.get("playoffTierType", ""),
            "homeTeam": names.get(h.get("teamId"), ""),
            "homeScore": round(h.get("totalPoints") or 0, 2),
            "awayTeam": names.get(a.get("teamId"), ""),
            "awayScore": round(a.get("totalPoints") or 0, 2),
            "winner": g.get("winner", ""),
        })
    return rows


def draft_rows(league, year, pmap):
    names = {t.get("id"): team_name(t) for t in league.get("teams") or []}
    rows = []
    for p in ((league.get("draftDetail") or {}).get("picks")) or []:
        rows.append({
            "season": year, "round": p.get("roundId"),
            "pickInRound": p.get("roundPickNumber"),
            "overall": p.get("overallPickNumber"),
            "team": names.get(p.get("teamId"), p.get("teamId")),
            "playerId": p.get("playerId"),
            "player": pmap.get(p.get("playerId"), ""),
            "bidAmount": p.get("bidAmount"), "keeper": p.get("keeper"),
        })
    return rows


def transaction_rows(league, year, pmap):
    names = {t.get("id"): team_name(t) for t in league.get("teams") or []}
    rows = []
    for tx in league.get("transactions") or []:
        items = tx.get("items") or [{}]
        for it in items:
            rows.append({
                "season": year, "type": tx.get("type"), "status": tx.get("status"),
                "team": names.get(tx.get("teamId"), tx.get("teamId")),
                "player": pmap.get(it.get("playerId"), it.get("playerId") or ""),
                "itemType": it.get("type", ""),
                "fromTeam": names.get(it.get("fromTeamId"), "") if it.get("fromTeamId") else "",
                "toTeam": names.get(it.get("toTeamId"), "") if it.get("toTeamId") else "",
            })
    return rows


def roster_rows(league, year, pmap):
    names = {t.get("id"): team_name(t) for t in league.get("teams") or []}
    rows = []
    for t in league.get("teams") or []:
        for e in ((t.get("roster") or {}).get("entries")) or []:
            pl = (e.get("playerPoolEntry") or {}).get("player") or {}
            rows.append({
                "season": year, "team": names.get(t.get("id"), t.get("id")),
                "playerId": pl.get("id"),
                "player": pl.get("fullName") or pmap.get(pl.get("id"), ""),
                "slot": SLOTS.get(e.get("lineupSlotId"), e.get("lineupSlotId")),
                "acquisition": e.get("acquisitionType", ""),
            })
    return rows


def write_csv(path, rows):
    if not rows:
        return 0
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    return len(rows)


# ------------------------------------------------------------------ main ----
def main():
    ap = argparse.ArgumentParser(
        description="Export ESPN fantasy football data (public-league method, no cookies).")
    ap.add_argument("--league", type=int, default=DEFAULT_LEAGUE_ID)
    ap.add_argument("--years", type=int, nargs="+", default=DEFAULT_YEARS)
    ap.add_argument("--out", default="espn_export")
    ap.add_argument("--sleep", type=float, default=1.0,
                    help="seconds to wait between seasons (be polite to ESPN)")
    args = ap.parse_args()

    raw_dir = os.path.join(args.out, "raw")
    os.makedirs(raw_dir, exist_ok=True)

    # one folder per category; each gets its own file per season
    categories = ["standings", "matchups", "draft", "transactions", "rosters"]
    cat_dir = {c: os.path.join(args.out, c) for c in categories}
    for d in cat_dir.values():
        os.makedirs(d, exist_ok=True)

    totals = {c: 0 for c in categories}
    ok, failed = [], []

    for year in args.years:
        print(f"[{year}] league {args.league} ...", flush=True)
        try:
            league, source = get_season(args.league, year)
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                print(f"  -> {year}: ACCESS DENIED ({e.code}). This season is a PRIVATE "
                      f"league. Set ESPN_S2 + ESPN_SWID env vars to include it.")
            elif e.code == 404:
                print(f"  -> {year}: NOT FOUND (404). No league for this season.")
            else:
                print(f"  -> {year}: HTTP {e.code} {e.reason}")
            failed.append(year)
            continue
        except urllib.error.URLError as e:
            print(f"  -> {year}: network error: {e.reason}")
            failed.append(year)
            continue
        except Exception as e:                       # noqa: BLE001
            print(f"  -> {year}: error: {e}")
            failed.append(year)
            continue

        with open(os.path.join(raw_dir, f"{year}.json"), "w", encoding="utf-8") as f:
            json.dump(league, f, indent=2)

        pmap = fetch_player_map(year)                # authoritative names
        augment_player_map(league, pmap)             # fill any gaps from payload

        per_cat = {
            "standings":    standings_rows(league, year),
            "matchups":     matchup_rows(league, year),
            "draft":        draft_rows(league, year, pmap),
            "transactions": transaction_rows(league, year, pmap),
            "rosters":      roster_rows(league, year, pmap),
        }
        counts = {}
        for c, rows in per_cat.items():
            counts[c] = write_csv(os.path.join(cat_dir[c], f"{c}_{year}.csv"), rows)
            totals[c] += counts[c]

        lname = (league.get("settings") or {}).get("name", "")
        print(f"  -> {year}: OK via {source}  '{lname}'  teams={counts['standings']} "
              f"matchups={counts['matchups']} picks={counts['draft']} "
              f"txns={counts['transactions']} players_named={len(pmap)}")
        ok.append(year)
        time.sleep(args.sleep)

    print("\n==== SUMMARY ====")
    print(f"Seasons OK:     {ok}")
    print(f"Seasons failed: {failed}")
    print(f"Raw JSON:  {raw_dir}/<year>.json")
    for c in categories:
        print(f"{c+':':14}{cat_dir[c]}/{c}_<year>.csv   (rows total: {totals[c]})")
    if failed:
        print("\nFailed seasons are almost always a private league (needs the optional "
              "ESPN_S2/ESPN_SWID env vars) or a year the league didn't exist.")


if __name__ == "__main__":
    main()

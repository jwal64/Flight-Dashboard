# Fantasy Football Exporter

Export your ESPN Fantasy Football league (every season) to CSV + JSON files.

## One-click web app (easiest)

```bash
python3 app.py
```

Then open the link it prints:

**http://localhost:8000**

Click **⬇ Export my file** and a `.zip` of all your data downloads automatically.
You can change the league ID and seasons right on the page. No `pip install`
needed — it uses the Python standard library only (Python 3.7+).

Set a different port if 8000 is taken:

```bash
PORT=9000 python3 app.py
```

## Command line (no browser)

```bash
python3 espn_ffl_export.py
python3 espn_ffl_export.py --league 98790873 --years 2019 2020 2021 2022 2023 2024 2025
python3 espn_ffl_export.py --out ./my_folder
```

## What you get

```
espn_export/
  raw/<year>.json                   full payload per season
  standings/standings_<year>.csv    records, points for/against, final rank, owners
  matchups/matchups_<year>.csv      every week's home/away score + winner
  draft/draft_<year>.csv            every pick: round, overall, team, player, bid
  transactions/transactions_<year>.csv  adds / drops / trades
  rosters/rosters_<year>.csv        final rosters by team with lineup slot
```

## Private leagues (optional)

Public leagues need no login. If a season is private, ESPN returns 401/403.
Only then, supply auth via environment variables (no file edits):

```bash
export ESPN_S2='your_espn_s2_value'
export ESPN_SWID='{your-swid-with-braces}'
```

With those unset (the default), no cookies are sent.

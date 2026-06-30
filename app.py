#!/usr/bin/env python3
"""
One-click web exporter for ESPN Fantasy Football data.

Run it:
    python3 app.py

Then open the link it prints (http://localhost:8000) and click the button.
It runs the same export as espn_ffl_export.py and hands you back a single .zip
to download. Standard library only -- no pip installs.
"""

import io
import os
import shutil
import tempfile
import urllib.parse
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import espn_ffl_export as exporter

HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fantasy Football Export</title>
<style>
  :root {{ color-scheme: light dark; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    max-width: 520px; margin: 8vh auto; padding: 0 20px; line-height: 1.5;
  }}
  h1 {{ font-size: 1.6rem; margin-bottom: .25rem; }}
  p.sub {{ color: #777; margin-top: 0; }}
  label {{ display: block; margin: 1rem 0 .25rem; font-weight: 600; }}
  input {{
    width: 100%; padding: .6rem .7rem; font-size: 1rem; box-sizing: border-box;
    border: 1px solid #bbb; border-radius: 8px;
  }}
  button {{
    margin-top: 1.5rem; width: 100%; padding: .9rem; font-size: 1.1rem;
    font-weight: 700; color: #fff; background: #0b6e4f; border: 0;
    border-radius: 10px; cursor: pointer;
  }}
  button:hover {{ background: #0a5f44; }}
  small {{ color: #888; }}
</style>
</head>
<body>
  <h1>🏈 Export my league</h1>
  <p class="sub">Click the button to download every season as a single .zip of CSV + JSON files.</p>
  <form action="/export" method="get">
    <label for="league">League ID</label>
    <input id="league" name="league" value="{league}" inputmode="numeric">

    <label for="years">Seasons</label>
    <input id="years" name="years" value="{years}">
    <small>Space-separated years, e.g. 2019 2020 2021 2022 2023 2024 2025</small>

    <button type="submit">⬇ Export my file</button>
  </form>
  <p><small>This may take a minute while it talks to ESPN. The download starts automatically when it's done.</small></p>
</body>
</html>
"""


def render_page():
    return PAGE.format(
        league=exporter.DEFAULT_LEAGUE_ID,
        years=" ".join(str(y) for y in exporter.DEFAULT_YEARS),
    )


def build_zip(league_id, years):
    """Run the export into a temp dir, return (zip_bytes, summary)."""
    workdir = tempfile.mkdtemp(prefix="espn_export_")
    try:
        out_dir = os.path.join(workdir, "espn_export")
        summary = exporter.run_export(league_id, years, out_dir, sleep=0.5)

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _dirs, files in os.walk(out_dir):
                for name in files:
                    full = os.path.join(root, name)
                    arc = os.path.relpath(full, workdir)
                    zf.write(full, arc)
        return buf.getvalue(), summary
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quieter console
        print("  " + (fmt % args))

    def _send_html(self, html, code=200):
        body = html.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            self._send_html(render_page())
            return
        if parsed.path == "/export":
            self.handle_export(urllib.parse.parse_qs(parsed.query))
            return
        self.send_error(404, "Not found")

    def handle_export(self, params):
        try:
            league_id = int((params.get("league", [exporter.DEFAULT_LEAGUE_ID])[0]).strip())
        except (ValueError, AttributeError):
            self._send_html("<p>Invalid league id. <a href='/'>Go back</a>.</p>", 400)
            return

        years_raw = (params.get("years", [""])[0]).replace(",", " ").split()
        try:
            years = [int(y) for y in years_raw] or exporter.DEFAULT_YEARS
        except ValueError:
            self._send_html("<p>Invalid years. <a href='/'>Go back</a>.</p>", 400)
            return

        print(f"Export requested: league={league_id} years={years}")
        try:
            data, summary = build_zip(league_id, years)
        except Exception as e:  # noqa: BLE001
            self._send_html(f"<p>Export failed: {e}. <a href='/'>Try again</a>.</p>", 500)
            return

        if not summary["ok"]:
            self._send_html(
                "<p>No seasons could be exported (private league or wrong id). "
                "<a href='/'>Go back</a>.</p>", 502)
            return

        fname = f"espn_export_{league_id}.zip"
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Disposition", f'attachment; filename="{fname}"')
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
        print(f"  -> sent {fname} ({len(data)} bytes), seasons ok: {summary['ok']}")


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    shown = "localhost" if HOST in ("0.0.0.0", "") else HOST
    print("=" * 56)
    print("  Fantasy Football Exporter is running.")
    print(f"  Open this link:  http://{shown}:{PORT}")
    print("  Then click the button. Ctrl+C here to stop.")
    print("=" * 56)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.shutdown()


if __name__ == "__main__":
    main()

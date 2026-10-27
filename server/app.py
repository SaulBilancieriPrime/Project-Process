"""Project Process API. Azure SQL + entra.Employee lookup."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request
from werkzeug.serving import WSGIRequestHandler

SERVER_DIR = Path(__file__).resolve().parent
ROOT = SERVER_DIR.parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))
load_dotenv(ROOT / ".env")

from db import DATABASE, SERVER, connect, in_azure, installed_sql_drivers, local_connection_hint  # noqa: E402
from employees import DEFAULT_LIMIT, MAX_LIMIT, search_employees  # noqa: E402

app = Flask(__name__)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://127.0.0.1:5173").rstrip("/")
PROBE_PATHS = {"/", "/favicon.ico"}


class QuietProbes(WSGIRequestHandler):
    """Cursor and browsers probe GET /; that is not an API failure."""

    def log_request(self, code: int | str = "-", size: int | str = "-") -> None:
        if getattr(self, "path", "") in PROBE_PATHS:
            return
        super().log_request(code, size)


def _help_page() -> Response:
    html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Project Process API</title>
</head>
<body style="font-family: Segoe UI, sans-serif; padding: 24px; color: #1b1b1b;">
  <h1 style="font-size: 18px;">Project Process API</h1>
  <p>This port serves <code>/api</code> only. Open the app at
    <a href="{FRONTEND_URL}">{FRONTEND_URL}</a>.</p>
  <p>Start it with <code>npm run dev</code> in a second terminal.</p>
</body>
</html>"""
    return Response(html, status=200, mimetype="text/html")


@app.get("/")
def root():
    return _help_page()


@app.get("/favicon.ico")
def favicon():
    return ("", 204)


@app.get("/api/health")
def health():
    info = {
        "ok": True,
        "sql": False,
        "server": SERVER,
        "database": DATABASE,
        "azure": in_azure(),
        "odbcDrivers": installed_sql_drivers(),
    }
    try:
        cn = connect()
        try:
            cn.execute("SELECT 1")
        finally:
            cn.close()
        info["sql"] = True
    except Exception as exc:  # noqa: BLE001
        info["ok"] = False
        info["error"] = str(exc)
        if not in_azure():
            info["detail"] = local_connection_hint(exc)
    return jsonify(info), 200 if info["ok"] else 503


@app.get("/api/employees")
def employees():
    query = (request.args.get("q") or "").strip()
    try:
        limit = int(request.args.get("limit") or DEFAULT_LIMIT)
    except ValueError:
        return jsonify({"ok": False, "error": "limit must be an integer."}), 400
    if limit < 1 or limit > MAX_LIMIT:
        return jsonify({"ok": False, "error": f"limit must be between 1 and {MAX_LIMIT}."}), 400
    try:
        people = search_employees(query, limit)
    except Exception as exc:  # noqa: BLE001
        app.logger.error("Employee search failed: %s", exc)
        body: dict = {"ok": False, "error": "Could not load Entra users from Azure SQL."}
        if not in_azure():
            body["detail"] = local_connection_hint(exc)
        return jsonify(body), 503
    return jsonify({"ok": True, "employees": people})


def main():
    port = int(os.environ.get("PORT", "5174"))
    print(f"Project Process API  ->  http://127.0.0.1:{port}/api/health")
    print(f"Open the app at      ->  {FRONTEND_URL}")
    print(f"Azure SQL            ->  {SERVER}/{DATABASE}")
    print("GET / probes are hidden. Use the Vite URL for the UI.")
    app.run(host="127.0.0.1", port=port, debug=False, request_handler=QuietProbes)


if __name__ == "__main__":
    main()

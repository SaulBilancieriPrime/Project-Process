"""Azure SQL access for Project Process (same host as PM_MANUAL)."""

from __future__ import annotations

import os
import struct
from pathlib import Path

SQL_COPT_SS_ACCESS_TOKEN = 1256
TOKEN_SCOPE = "https://database.windows.net/.default"

SERVER = os.environ.get("AZURE_SQL_SERVER", "sql-prime-it.database.windows.net")
DATABASE = os.environ.get("AZURE_SQL_DATABASE", "atg-requirements")


def in_azure() -> bool:
    return bool(
        os.getenv("WEBSITE_INSTANCE_ID")
        or os.getenv("IDENTITY_ENDPOINT")
        or os.getenv("MSI_ENDPOINT")
    )


def installed_sql_drivers() -> list[str]:
    try:
        import pyodbc
    except ImportError:
        return []
    preferred = [
        "ODBC Driver 18 for SQL Server",
        "ODBC Driver 17 for SQL Server",
        "ODBC Driver 13 for SQL Server",
    ]
    seen = set(pyodbc.drivers())
    ordered = [d for d in preferred if d in seen]
    for name in seen:
        if "SQL Server" in name and name not in ordered:
            ordered.append(name)
    return ordered


def _ensure_local_azure_path() -> None:
    """DefaultAzureCredential uses `az` on PATH; Windows often installs it outside PATH."""
    if in_azure():
        return
    path = os.environ.get("PATH", "")
    candidates = [
        Path(os.environ.get("ProgramFiles", "")) / "Microsoft SDKs" / "Azure" / "CLI2" / "wbin",
        Path(os.environ.get("ProgramFiles(x86)", "")) / "Microsoft SDKs" / "Azure" / "CLI2" / "wbin",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Azure CLI" / "wbin",
    ]
    for folder in candidates:
        if not folder.is_dir():
            continue
        entry = str(folder)
        if entry.casefold() not in path.casefold():
            os.environ["PATH"] = entry + os.pathsep + path
            path = os.environ["PATH"]


def _token_struct() -> bytes:
    from azure.identity import DefaultAzureCredential, ManagedIdentityCredential

    if in_azure():
        cred = ManagedIdentityCredential()
    else:
        _ensure_local_azure_path()
        cred = DefaultAzureCredential(
            exclude_interactive_browser_credential=True,
            exclude_managed_identity_credential=True,
            exclude_broker_credential=True,
        )
    token = cred.get_token(TOKEN_SCOPE).token
    raw = token.encode("utf-16-le")
    return struct.pack(f"<I{len(raw)}s", len(raw), raw)


def connect():
    drivers = installed_sql_drivers()
    if not drivers:
        raise RuntimeError(
            "No ODBC SQL Server driver found for this Python. "
            "Install Microsoft ODBC Driver 18 for SQL Server (64-bit), then restart the API."
        )

    sql_timeout = 5 if not in_azure() else 30
    token_struct = _token_struct()
    last = None
    import pyodbc

    for driver in drivers:
        conn_str = (
            f"Driver={{{driver}}};"
            f"Server=tcp:{SERVER},1433;"
            f"Database={DATABASE};"
            f"Encrypt=yes;TrustServerCertificate=no;Connection Timeout={sql_timeout};"
        )
        try:
            return pyodbc.connect(
                conn_str,
                attrs_before={SQL_COPT_SS_ACCESS_TOKEN: token_struct},
                timeout=sql_timeout,
            )
        except Exception as exc:  # noqa: BLE001
            if not _is_missing_driver_error(exc):
                last = exc
            elif last is None:
                last = exc
            continue

    if in_azure():
        try:
            import mssql_python

            return mssql_python.connect(
                f"Server={SERVER};Database={DATABASE};Authentication=ActiveDirectoryMSI;"
                "Encrypt=yes;TrustServerCertificate=no;"
            )
        except Exception as exc:  # noqa: BLE001
            last = exc

    raise RuntimeError(f"Could not connect to Azure SQL: {last}")


def _is_missing_driver_error(exc: BaseException) -> bool:
    text = str(exc)
    return "IM002" in text or "Data source name not found" in text


def local_connection_hint(exc: BaseException) -> str:
    text = str(exc)
    drivers = installed_sql_drivers()
    if not drivers:
        return (
            "No ODBC SQL Server driver visible to this Python. Install "
            "Microsoft ODBC Driver 18 for SQL Server (64-bit), then restart the API "
            "using the project venv: .\\.venv\\Scripts\\python.exe server\\app.py"
        )
    if "DefaultAzureCredential" in text or "AzureCliCredential" in text:
        return (
            "Local Azure sign-in is required. In the API terminal run `az login`, "
            "then restart the API with .\\.venv\\Scripts\\python.exe server\\app.py "
            "(same as PM_MANUAL local SQL)."
        )
    if _is_missing_driver_error(text) and len(drivers) == 1 and drivers[0] == "SQL Server":
        return (
            "Only the legacy 'SQL Server' ODBC driver is installed. Install "
            "ODBC Driver 18 for SQL Server (64-bit), then restart the API."
        )
    if "18456" in text or "Login failed" in text:
        return (
            "Your account may lack access to atg-requirements. Ask IT for read on entra.Employee "
            "(same permission PM_MANUAL uses)."
        )
    if "08001" in text or "timeout" in text.lower():
        return "Could not reach Azure SQL. Check VPN or network access to sql-prime-it.database.windows.net."
    first = text.split("\n")[0].strip()
    if first.startswith("Could not connect to Azure SQL:"):
        first = first.split(":", 1)[-1].strip()
    return first[:400] if first else "See the API terminal log for details."

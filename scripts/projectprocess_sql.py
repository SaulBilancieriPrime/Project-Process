"""Create or upgrade the projectprocess schema in atg-requirements (Map, Node, Link, ChangeLog).

The app no longer runs DDL itself; run this once per schema change with an identity that has DDL rights.
The app's own identity only needs db_datareader and db_datawriter.

    python scripts/projectprocess_sql.py               # create tables, add columns and indexes (safe for old app builds)
    python scripts/projectprocess_sql.py --drop-legacy # also drop Map.settings_json, Node.fx, Node.fy

Run --drop-legacy only after every deployed build is on the version that no longer reads those columns.
"""

from __future__ import annotations

import os
import struct
import sys

SQL_COPT_SS_ACCESS_TOKEN = 1256
TOKEN_SCOPE = "https://database.windows.net/.default"
SERVERS = [
    os.environ.get("AZURE_SQL_SERVER", "").strip(),
    "sql-primeae-eastus2.database.windows.net",
    "sql-prime-it.database.windows.net",
]
DATABASE = os.environ.get("AZURE_SQL_DATABASE", "atg-requirements")
SCHEMA = "projectprocess"


def _in_azure() -> bool:
    return bool(
        os.getenv("WEBSITE_INSTANCE_ID")
        or os.getenv("IDENTITY_ENDPOINT")
        or os.getenv("MSI_ENDPOINT")
    )


def _token_struct() -> bytes:
    from azure.identity import DefaultAzureCredential, ManagedIdentityCredential

    if _in_azure():
        cred = ManagedIdentityCredential()
    else:
        cred = DefaultAzureCredential(
            exclude_interactive_browser_credential=True,
            exclude_managed_identity_credential=True,
            exclude_broker_credential=True,
        )
    token = cred.get_token(TOKEN_SCOPE).token
    raw = token.encode("utf-16-le")
    return struct.pack(f"<I{len(raw)}s", len(raw), raw)


def connect():
    last = None
    sql_timeout = 8 if not _in_azure() else 30
    try:
        import pyodbc

        token_struct = _token_struct()
        drivers = ["ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server"]
        for server in [s for s in SERVERS if s]:
            for driver in drivers:
                conn_str = (
                    f"Driver={{{driver}}};"
                    f"Server=tcp:{server},1433;"
                    f"Database={DATABASE};"
                    f"Encrypt=yes;TrustServerCertificate=no;Connection Timeout={sql_timeout};"
                )
                try:
                    cn = pyodbc.connect(
                        conn_str,
                        attrs_before={SQL_COPT_SS_ACCESS_TOKEN: token_struct},
                        timeout=sql_timeout,
                    )
                    print(f"Connected {server} / {DATABASE}")
                    return cn
                except Exception as exc:  # noqa: BLE001
                    last = exc
    except Exception as exc:  # noqa: BLE001
        last = exc
    try:
        import mssql_python

        for server in [s for s in SERVERS if s]:
            try:
                cn = mssql_python.connect(
                    f"Server={server};Database={DATABASE};Authentication=ActiveDirectoryDefault;"
                    "Encrypt=yes;TrustServerCertificate=no;"
                )
                print(f"Connected {server} / {DATABASE} (mssql-python)")
                return cn
            except Exception as exc:  # noqa: BLE001
                last = exc
    except Exception as exc:  # noqa: BLE001
        last = exc
    raise RuntimeError(f"Could not connect to Azure SQL: {last}")


def _add_column(table: str, column: str, definition: str) -> str:
    return (
        f"IF COL_LENGTH(N'{SCHEMA}.{table}', N'{column}') IS NULL "
        f"ALTER TABLE {SCHEMA}.{table} ADD {column} {definition};"
    )


def _drop_column(table: str, column: str) -> str:
    return (
        f"IF COL_LENGTH(N'{SCHEMA}.{table}', N'{column}') IS NOT NULL "
        f"ALTER TABLE {SCHEMA}.{table} DROP COLUMN {column};"
    )


def _index(name: str, table: str, columns: str) -> str:
    return (
        f"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'{name}' "
        f"AND object_id = OBJECT_ID(N'{SCHEMA}.{table}')) "
        f"CREATE INDEX {name} ON {SCHEMA}.{table}({columns});"
    )


# Each statement runs in its own batch so later statements can see columns added earlier.
STATEMENTS = [
    f"IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'{SCHEMA}') EXEC(N'CREATE SCHEMA {SCHEMA}');",
    f"""
IF OBJECT_ID(N'{SCHEMA}.Map', N'U') IS NULL
CREATE TABLE {SCHEMA}.Map (
    id int NOT NULL CONSTRAINT PK_projectprocess_Map PRIMARY KEY,
    revision bigint NOT NULL CONSTRAINT DF_projectprocess_Map_rev DEFAULT (0),
    updated_at datetime2 NOT NULL,
    updated_by nvarchar(200) NULL
);""",
    f"""
IF OBJECT_ID(N'{SCHEMA}.Node', N'U') IS NULL
CREATE TABLE {SCHEMA}.Node (
    id nvarchar(160) NOT NULL CONSTRAINT PK_projectprocess_Node PRIMARY KEY,
    title nvarchar(400) NOT NULL,
    description nvarchar(max) NULL,
    level int NOT NULL CONSTRAINT DF_projectprocess_Node_level DEFAULT (0),
    parent_id nvarchar(160) NULL,
    type nvarchar(20) NOT NULL,
    color nvarchar(32) NULL,
    employee nvarchar(200) NULL,
    employee_email nvarchar(200) NULL,
    size float NOT NULL CONSTRAINT DF_projectprocess_Node_size DEFAULT (1),
    x float NULL,
    y float NULL,
    version int NOT NULL CONSTRAINT DF_projectprocess_Node_ver DEFAULT (1),
    is_deleted bit NOT NULL CONSTRAINT DF_projectprocess_Node_del DEFAULT (0),
    updated_rev bigint NOT NULL CONSTRAINT DF_projectprocess_Node_rev DEFAULT (0),
    updated_client nvarchar(64) NULL,
    updated_at datetime2 NOT NULL,
    updated_by nvarchar(200) NULL
);""",
    f"""
IF OBJECT_ID(N'{SCHEMA}.Link', N'U') IS NULL
CREATE TABLE {SCHEMA}.Link (
    id nvarchar(160) NOT NULL CONSTRAINT PK_projectprocess_Link PRIMARY KEY,
    source_id nvarchar(160) NOT NULL,
    target_id nvarchar(160) NOT NULL,
    kind nvarchar(20) NOT NULL,
    arrows nvarchar(20) NOT NULL,
    version int NOT NULL CONSTRAINT DF_projectprocess_Link_ver DEFAULT (1),
    is_deleted bit NOT NULL CONSTRAINT DF_projectprocess_Link_del DEFAULT (0),
    updated_rev bigint NOT NULL CONSTRAINT DF_projectprocess_Link_rev DEFAULT (0),
    updated_client nvarchar(64) NULL,
    updated_at datetime2 NOT NULL,
    updated_by nvarchar(200) NULL
);""",
    f"""
IF OBJECT_ID(N'{SCHEMA}.ChangeLog', N'U') IS NULL
CREATE TABLE {SCHEMA}.ChangeLog (
    change_id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_projectprocess_ChangeLog PRIMARY KEY,
    revision bigint NOT NULL,
    changed_at datetime2 NOT NULL,
    changed_by nvarchar(200) NULL,
    action nvarchar(40) NOT NULL,
    target nvarchar(20) NOT NULL,
    target_id nvarchar(160) NULL,
    payload_json nvarchar(max) NULL
);""",
    # Upgrades for databases created by earlier versions of the app.
    _add_column("Node", "updated_rev", "bigint NOT NULL CONSTRAINT DF_projectprocess_Node_rev DEFAULT (0)"),
    _add_column("Node", "updated_client", "nvarchar(64) NULL"),
    _add_column("Link", "version", "int NOT NULL CONSTRAINT DF_projectprocess_Link_ver DEFAULT (1)"),
    _add_column("Link", "updated_rev", "bigint NOT NULL CONSTRAINT DF_projectprocess_Link_rev DEFAULT (0)"),
    _add_column("Link", "updated_client", "nvarchar(64) NULL"),
    _index("IX_projectprocess_Link_ends", "Link", "source_id, target_id"),
    _index("IX_projectprocess_Node_rev", "Node", "updated_rev"),
    _index("IX_projectprocess_Link_rev", "Link", "updated_rev"),
    _index("IX_projectprocess_ChangeLog_rev", "ChangeLog", "revision"),
    _index("IX_projectprocess_ChangeLog_at", "ChangeLog", "changed_at"),
]

LEGACY_DROPS = [
    _drop_column("Map", "settings_json"),
    _drop_column("Node", "fx"),
    _drop_column("Node", "fy"),
]


def ensure_schema(cn, drop_legacy: bool = False) -> None:
    cn.autocommit = True
    for statement in STATEMENTS + (LEGACY_DROPS if drop_legacy else []):
        cn.execute(statement)
    cn.autocommit = False


def main() -> None:
    drop_legacy = "--drop-legacy" in sys.argv[1:]
    cn = connect()
    try:
        ensure_schema(cn, drop_legacy)
        if drop_legacy:
            print("Dropped legacy columns Map.settings_json / Node.fx / Node.fy")
        print(f"Ready {SCHEMA}.Map / Node / Link / ChangeLog")
        nodes = cn.execute(f"SELECT COUNT(*) FROM {SCHEMA}.Node WHERE is_deleted = 0").fetchone()[0]
        links = cn.execute(f"SELECT COUNT(*) FROM {SCHEMA}.Link WHERE is_deleted = 0").fetchone()[0]
        print(f"{SCHEMA}.Node={nodes} {SCHEMA}.Link={links} (empty tables seed on first app load)")
    finally:
        cn.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(exc, file=sys.stderr)
        raise

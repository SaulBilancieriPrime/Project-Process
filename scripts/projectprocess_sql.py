"""Create projectprocess schema in atg-requirements (Map, Node, Link, ChangeLog)."""

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


DDL = f"""
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'{SCHEMA}')
    EXEC(N'CREATE SCHEMA {SCHEMA}');

IF OBJECT_ID(N'{SCHEMA}.Map', N'U') IS NULL
CREATE TABLE {SCHEMA}.Map (
    id int NOT NULL CONSTRAINT PK_projectprocess_Map PRIMARY KEY,
    settings_json nvarchar(max) NOT NULL,
    revision bigint NOT NULL CONSTRAINT DF_projectprocess_Map_rev DEFAULT (1),
    updated_at datetime2 NOT NULL,
    updated_by nvarchar(200) NULL
);

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
    fx float NULL,
    fy float NULL,
    version int NOT NULL CONSTRAINT DF_projectprocess_Node_ver DEFAULT (1),
    is_deleted bit NOT NULL CONSTRAINT DF_projectprocess_Node_del DEFAULT (0),
    updated_at datetime2 NOT NULL,
    updated_by nvarchar(200) NULL
);

IF OBJECT_ID(N'{SCHEMA}.Link', N'U') IS NULL
CREATE TABLE {SCHEMA}.Link (
    id nvarchar(160) NOT NULL CONSTRAINT PK_projectprocess_Link PRIMARY KEY,
        source_id nvarchar(160) NOT NULL,
        target_id nvarchar(160) NOT NULL,
    kind nvarchar(20) NOT NULL,
    arrows nvarchar(20) NOT NULL,
    is_deleted bit NOT NULL CONSTRAINT DF_projectprocess_Link_del DEFAULT (0),
    updated_at datetime2 NOT NULL,
    updated_by nvarchar(200) NULL
);
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = N'IX_projectprocess_Link_ends' AND object_id = OBJECT_ID(N'{SCHEMA}.Link')
)
    CREATE INDEX IX_projectprocess_Link_ends ON {SCHEMA}.Link(source_id, target_id);

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
);
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = N'IX_projectprocess_ChangeLog_rev' AND object_id = OBJECT_ID(N'{SCHEMA}.ChangeLog')
)
    CREATE INDEX IX_projectprocess_ChangeLog_rev ON {SCHEMA}.ChangeLog(revision);
"""


def ensure_schema(cn) -> None:
    cn.autocommit = True
    cn.execute(DDL)
    cn.autocommit = False


def main() -> None:
    cn = connect()
    try:
        ensure_schema(cn)
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

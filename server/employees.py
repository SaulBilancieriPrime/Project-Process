"""Read Entra users from Azure SQL schema entra.Employee."""

from __future__ import annotations

from db import connect

MAX_LIMIT = 50
DEFAULT_LIMIT = 20


def _text(value: object) -> str:
    return str(value or "").strip()


def _to_employee(row: tuple) -> dict:
    object_id, display_name, given_name, surname, mail, upn, enabled = row
    email = _text(mail) or _text(upn)
    name = _text(display_name) or " ".join(part for part in (_text(given_name), _text(surname)) if part) or email
    return {
        "id": _text(object_id),
        "name": name,
        "email": email,
        "upn": _text(upn),
        "enabled": bool(enabled),
    }


def search_employees(query: str = "", limit: int = DEFAULT_LIMIT) -> list[dict]:
    cap = max(1, min(int(limit or DEFAULT_LIMIT), MAX_LIMIT))
    needle = f"%{_text(query)}%" if _text(query) else ""
    cn = connect()
    try:
        cur = cn.cursor()
        if needle:
            cur.execute(
                f"""
                SELECT TOP ({cap})
                    objectId, displayName, givenName, surname, mail, userPrincipalName, accountEnabled
                FROM entra.Employee
                WHERE ISNULL(accountEnabled, 1) = 1
                  AND (
                    displayName LIKE ?
                    OR givenName LIKE ?
                    OR surname LIKE ?
                    OR mail LIKE ?
                    OR userPrincipalName LIKE ?
                  )
                ORDER BY displayName
                """,
                needle,
                needle,
                needle,
                needle,
                needle,
            )
        else:
            cur.execute(
                f"""
                SELECT TOP ({cap})
                    objectId, displayName, givenName, surname, mail, userPrincipalName, accountEnabled
                FROM entra.Employee
                WHERE ISNULL(accountEnabled, 1) = 1
                ORDER BY displayName
                """
            )
        return [_to_employee(row) for row in cur.fetchall()]
    finally:
        cn.close()

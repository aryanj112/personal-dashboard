from __future__ import annotations

import sqlite3
from datetime import date as dt_date, timedelta
from typing import Any


def dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def iso_today() -> str:
    return dt_date.today().isoformat()


def week_start(day: dt_date) -> dt_date:
    return day - timedelta(days=day.weekday())

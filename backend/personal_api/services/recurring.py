from __future__ import annotations

import json
import sqlite3
from datetime import date as dt_date, timedelta
from typing import Any

from ..schemas import RecurringTaskCreate, RecurringTaskUpdate


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    d["days_of_week"] = json.loads(d["days_of_week"])
    d["is_active"] = bool(d["is_active"])
    return d


def list_recurring_tasks(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, text, priority, days_of_week, start_date, end_date, is_active, created_at
        FROM recurring_tasks
        ORDER BY is_active DESC, id DESC
        """
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


def create_recurring_task(
    conn: sqlite3.Connection, payload: RecurringTaskCreate
) -> dict[str, Any]:
    days = sorted(set(d for d in payload.days_of_week if 0 <= d <= 6))
    cursor = conn.execute(
        """
        INSERT INTO recurring_tasks(text, priority, days_of_week, start_date, end_date)
        VALUES(?, ?, ?, ?, ?)
        """,
        (
            payload.text.strip(),
            payload.priority,
            json.dumps(days),
            dt_date.today().isoformat(),
            payload.end_date.isoformat() if payload.end_date else None,
        ),
    )
    row = conn.execute(
        "SELECT id, text, priority, days_of_week, start_date, end_date, is_active, created_at FROM recurring_tasks WHERE id = ?",
        (cursor.lastrowid,),
    ).fetchone()
    return _row_to_dict(row)


def update_recurring_task(
    conn: sqlite3.Connection, task_id: int, payload: RecurringTaskUpdate
) -> dict[str, Any] | None:
    existing = conn.execute(
        "SELECT id, text, priority, days_of_week, start_date, end_date, is_active FROM recurring_tasks WHERE id = ?",
        (task_id,),
    ).fetchone()
    if not existing:
        return None

    new_days = (
        json.dumps(sorted(set(d for d in payload.days_of_week if 0 <= d <= 6)))
        if payload.days_of_week is not None
        else existing["days_of_week"]
    )
    conn.execute(
        """
        UPDATE recurring_tasks
        SET text = ?, priority = ?, days_of_week = ?, end_date = ?, is_active = ?
        WHERE id = ?
        """,
        (
            payload.text.strip() if payload.text is not None else existing["text"],
            payload.priority if payload.priority is not None else existing["priority"],
            new_days,
            payload.end_date.isoformat() if payload.end_date is not None else existing["end_date"],
            (1 if payload.is_active else 0) if payload.is_active is not None else existing["is_active"],
            task_id,
        ),
    )
    row = conn.execute(
        "SELECT id, text, priority, days_of_week, start_date, end_date, is_active, created_at FROM recurring_tasks WHERE id = ?",
        (task_id,),
    ).fetchone()
    return _row_to_dict(row)


def delete_recurring_task(conn: sqlite3.Connection, task_id: int) -> bool:
    # Detach any generated tasks so they become standalone
    conn.execute(
        "UPDATE tasks SET recurring_task_id = NULL WHERE recurring_task_id = ?",
        (task_id,),
    )
    deleted = conn.execute("DELETE FROM recurring_tasks WHERE id = ?", (task_id,))
    return deleted.rowcount > 0


def generate_tasks_for_range(
    conn: sqlite3.Connection, start: dt_date, end: dt_date
) -> None:
    """
    For every active recurring task, insert a task row for each date in
    [start, end] where the weekday matches — skipping dates that already
    have a task for that recurring_task_id.
    """
    recurring = conn.execute(
        """
        SELECT id, text, priority, days_of_week, start_date, end_date
        FROM recurring_tasks
        WHERE is_active = 1
        """
    ).fetchall()
    if not recurring:
        return

    current = start
    while current <= end:
        weekday = current.weekday()  # 0=Mon … 6=Sun
        date_str = current.isoformat()

        for rec in recurring:
            # Never generate before the rule actually started.
            if rec["start_date"] and rec["start_date"] > date_str:
                continue

            # Respect the rule's own end date
            if rec["end_date"] and rec["end_date"] < date_str:
                continue

            days: list[int] = json.loads(rec["days_of_week"])
            if weekday not in days:
                continue

            # Skip if an instance already exists for this date
            exists = conn.execute(
                "SELECT 1 FROM tasks WHERE recurring_task_id = ? AND task_date = ?",
                (rec["id"], date_str),
            ).fetchone()
            if exists:
                continue

            next_sort = conn.execute(
                "SELECT COALESCE(MAX(sort_order), -1) + 1 AS s FROM tasks WHERE task_date = ? AND is_misc = 0",
                (date_str,),
            ).fetchone()["s"]
            conn.execute(
                """
                INSERT INTO tasks(text, task_date, completed, priority, sort_order, is_misc, recurring_task_id)
                VALUES(?, ?, 0, ?, ?, 0, ?)
                """,
                (rec["text"], date_str, rec["priority"], next_sort, rec["id"]),
            )

        current += timedelta(days=1)

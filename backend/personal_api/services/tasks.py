from __future__ import annotations

import sqlite3
from typing import Any


def serialize_task(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    return {
        **d,
        "completed": bool(row["completed"]),
        "is_misc": bool(row["is_misc"]),
        "priority": row["priority"] or "medium",
        "url": d.get("url") or "",
    }


def list_tasks_for_date(
    conn: sqlite3.Connection, target_date: str
) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, text, task_date, completed, notes, sort_order, checklist_id, priority, is_misc, url, recurring_task_id
        FROM tasks
        WHERE task_date = ? AND is_misc = 0
        ORDER BY sort_order, id
        """,
        (target_date,),
    ).fetchall()
    return [serialize_task(row) for row in rows]


def list_tasks_for_week(
    conn: sqlite3.Connection, start_date: str, end_date: str
) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, text, task_date, completed, notes, sort_order, checklist_id, priority, is_misc, url, recurring_task_id
        FROM tasks
        WHERE task_date >= ? AND task_date <= ? AND is_misc = 0
        ORDER BY task_date, sort_order, id
        """,
        (start_date, end_date),
    ).fetchall()
    return [serialize_task(row) for row in rows]


def list_overdue_tasks(
    conn: sqlite3.Connection, target_date: str
) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, text, task_date, completed, notes, sort_order, checklist_id, priority, is_misc, url, recurring_task_id
        FROM tasks
        WHERE task_date < ? AND completed = 0 AND is_misc = 0
        ORDER BY task_date ASC, sort_order ASC, id ASC
        """,
        (target_date,),
    ).fetchall()
    return [serialize_task(row) for row in rows]


def list_misc_tasks(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, text, task_date, completed, notes, sort_order, checklist_id, priority, is_misc, url, recurring_task_id
        FROM tasks
        WHERE is_misc = 1
        ORDER BY completed ASC, sort_order ASC, id ASC
        """,
    ).fetchall()
    return [serialize_task(row) for row in rows]


def list_goals(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, text, created_at
        FROM goals
        ORDER BY created_at DESC, id DESC
        """
    ).fetchall()
    return [dict(row) for row in rows]


def list_checklists_for_date(
    conn: sqlite3.Connection, target_date: str
) -> list[dict[str, Any]]:
    trackers = conn.execute(
        """
        SELECT id, text, starting_count, total_goal, daily_goal, sort_order
        FROM checklist_trackers
        ORDER BY sort_order, id
        """
    ).fetchall()
    if not trackers:
        return []

    totals = {
        row["checklist_id"]: row["amount_total"]
        for row in conn.execute(
            """
            SELECT checklist_id, COALESCE(SUM(amount), 0) AS amount_total
            FROM checklist_logs
            GROUP BY checklist_id
            """
        ).fetchall()
    }
    today_amounts = {
        row["checklist_id"]: row["amount"]
        for row in conn.execute(
            """
            SELECT checklist_id, amount
            FROM checklist_logs
            WHERE log_date = ?
            """,
            (target_date,),
        ).fetchall()
    }
    task_links = {
        row["checklist_id"]: {
            "task_id": row["id"],
            "task_completed": bool(row["completed"]),
        }
        for row in conn.execute(
            """
            SELECT id, checklist_id, completed
            FROM tasks
            WHERE task_date = ? AND checklist_id IS NOT NULL
            ORDER BY id DESC
            """,
            (target_date,),
        ).fetchall()
    }

    return [
        {
            "id": row["id"],
            "text": row["text"],
            "starting_count": row["starting_count"],
            "current_count": row["starting_count"] + totals.get(row["id"], 0),
            "total_goal": row["total_goal"],
            "daily_goal": row["daily_goal"],
            "today_count": today_amounts.get(row["id"], 0),
            "sort_order": row["sort_order"],
            "task_id": task_links.get(row["id"], {}).get("task_id"),
            "task_completed": task_links.get(row["id"], {}).get("task_completed", False),
        }
        for row in trackers
    ]


def get_checklist_for_date(
    conn: sqlite3.Connection, checklist_id: int, target_date: str
) -> dict[str, Any] | None:
    items = list_checklists_for_date(conn, target_date)
    return next((item for item in items if item["id"] == checklist_id), None)

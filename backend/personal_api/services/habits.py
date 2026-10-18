from __future__ import annotations

import sqlite3
from datetime import date as dt_date, timedelta
from typing import Any

from ..schemas import HabitLogUpsert, HabitSickDayUpsert
from .tasks import list_checklists_for_date, list_goals, list_misc_tasks, list_overdue_tasks, list_tasks_for_date

SESSION_BACKED_HABIT_TABLES = {
    "Guitar": "guitar_sessions",
    "Exercise": "workout_sessions",
}
SESSION_BACKED_HABIT_NAMES = tuple(SESSION_BACKED_HABIT_TABLES.keys())


def get_habits(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT id, name, is_active, sort_order FROM habits WHERE is_active = 1 AND deleted_at IS NULL ORDER BY sort_order, id"
    ).fetchall()
    return [{**dict(row), "is_active": bool(row["is_active"])} for row in rows]


def is_session_backed_habit(name: str) -> bool:
    return name in SESSION_BACKED_HABIT_TABLES


def _has_session_on_date(conn: sqlite3.Connection, session_table: str, target_date: str) -> bool:
    return (
        conn.execute(
            f"SELECT 1 FROM {session_table} WHERE session_date = ? LIMIT 1",
            (target_date,),
        ).fetchone()
        is not None
    )


def _session_dates_for_table(
    conn: sqlite3.Connection, session_table: str, *, start_date: str | None = None
) -> set[str]:
    if start_date is None:
        rows = conn.execute(
            f"SELECT DISTINCT session_date FROM {session_table}"
        ).fetchall()
    else:
        rows = conn.execute(
            f"SELECT DISTINCT session_date FROM {session_table} WHERE session_date >= ?",
            (start_date,),
        ).fetchall()
    return {row["session_date"] for row in rows}


def _completion_dates_for_habit(conn: sqlite3.Connection, habit_id: int) -> set[str]:
    habit = conn.execute(
        "SELECT name FROM habits WHERE id = ?",
        (habit_id,),
    ).fetchone()
    if not habit:
        return set()

    session_table = SESSION_BACKED_HABIT_TABLES.get(habit["name"])
    if session_table:
        return _session_dates_for_table(conn, session_table)

    completed_rows = conn.execute(
        """
        SELECT log_date
        FROM habit_logs
        WHERE habit_id = ? AND completed = 1
        ORDER BY log_date DESC
        """,
        (habit_id,),
    ).fetchall()
    return {row["log_date"] for row in completed_rows}


def _sick_dates_for_habit(conn: sqlite3.Connection, habit_id: int) -> set[str]:
    rows = conn.execute(
        "SELECT sick_date FROM habit_sick_days WHERE habit_id = ?",
        (habit_id,),
    ).fetchall()
    return {row["sick_date"] for row in rows}


def set_sick_day_for_all_habits(
    conn: sqlite3.Connection, payload: HabitSickDayUpsert
) -> dict[str, Any]:
    sick_date = payload.date.isoformat()
    habits = get_habits(conn)
    if payload.is_sick:
        for habit in habits:
            if habit["name"] in SESSION_BACKED_HABIT_TABLES:
                session_table = SESSION_BACKED_HABIT_TABLES[habit["name"]]
                completed = _has_session_on_date(conn, session_table, sick_date)
            else:
                completed = conn.execute(
                    "SELECT 1 FROM habit_logs WHERE habit_id = ? AND log_date = ? AND completed = 1",
                    (habit["id"], sick_date),
                ).fetchone() is not None
            if not completed:
                conn.execute(
                    "INSERT OR IGNORE INTO habit_sick_days(habit_id, sick_date) VALUES(?, ?)",
                    (habit["id"], sick_date),
                )
    else:
        conn.execute("DELETE FROM habit_sick_days WHERE sick_date = ?", (sick_date,))
    return {"date": sick_date, "is_sick": payload.is_sick}


def current_streak_for_habit(conn: sqlite3.Connection, habit_id: int) -> int:
    completed_dates = _completion_dates_for_habit(conn, habit_id)
    sick_dates = _sick_dates_for_habit(conn, habit_id)
    streak = 0
    cursor = dt_date.today()
    if cursor.isoformat() not in completed_dates and cursor.isoformat() not in sick_dates:
        cursor -= timedelta(days=1)
    while True:
        cursor_iso = cursor.isoformat()
        if cursor_iso in sick_dates:
            cursor -= timedelta(days=1)
            continue
        if cursor_iso not in completed_dates:
            break
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def last_completed_date_for_habit(conn: sqlite3.Connection, habit_id: int) -> str | None:
    habit = conn.execute(
        "SELECT name FROM habits WHERE id = ?",
        (habit_id,),
    ).fetchone()
    if not habit:
        return None

    completed_dates = _completion_dates_for_habit(conn, habit_id)
    completed_dates.difference_update(_sick_dates_for_habit(conn, habit_id))
    return max(completed_dates, default=None)


def habit_heatmap(conn: sqlite3.Connection, days: int = 28) -> list[dict[str, Any]]:
    start = dt_date.today() - timedelta(days=days - 1)
    start_iso = start.isoformat()
    habit_order = {
        habit["name"]: habit["sort_order"]
        for habit in get_habits(conn)
    }
    counts: dict[str, int] = {}
    habits_by_date: dict[str, list[str]] = {}

    manual_rows = conn.execute(
        """
        SELECT hl.log_date, h.name
        FROM habit_logs hl
        JOIN habits h ON h.id = hl.habit_id
        WHERE hl.completed = 1
          AND hl.log_date >= ?
          AND NOT EXISTS (
              SELECT 1 FROM habit_sick_days hsd
              WHERE hsd.habit_id = hl.habit_id AND hsd.sick_date = hl.log_date
          )
          AND h.name NOT IN ({placeholders})
        ORDER BY hl.log_date ASC, h.sort_order ASC, h.id ASC
        """.format(placeholders=",".join("?" for _ in SESSION_BACKED_HABIT_NAMES)),
        (start_iso, *SESSION_BACKED_HABIT_NAMES),
    ).fetchall()
    for row in manual_rows:
        counts[row["log_date"]] = counts.get(row["log_date"], 0) + 1
        habits_by_date.setdefault(row["log_date"], []).append(row["name"])

    for habit_name, session_table in SESSION_BACKED_HABIT_TABLES.items():
        habit_row = conn.execute("SELECT id FROM habits WHERE name = ?", (habit_name,)).fetchone()
        sick_dates = _sick_dates_for_habit(conn, habit_row["id"]) if habit_row else set()
        session_dates = _session_dates_for_table(
            conn, session_table, start_date=start_iso
        ) - sick_dates
        for session_date in session_dates:
            counts[session_date] = counts.get(session_date, 0) + 1
            habits_by_date.setdefault(session_date, []).append(habit_name)

    sick_rows = conn.execute(
        """
        SELECT hsd.sick_date, h.name
        FROM habit_sick_days hsd
        JOIN habits h ON h.id = hsd.habit_id
        WHERE hsd.sick_date >= ?
        ORDER BY hsd.sick_date, h.sort_order, h.id
        """,
        (start_iso,),
    ).fetchall()
    sick_by_date: dict[str, list[str]] = {}
    for row in sick_rows:
        sick_by_date.setdefault(row["sick_date"], []).append(row["name"])

    cells = []
    for offset in range(days):
        cell_date = (start + timedelta(days=offset)).isoformat()
        total_row = conn.execute(
            """
            SELECT COUNT(*) as cnt FROM habits
            WHERE date(created_at) <= ? AND (deleted_at IS NULL OR date(deleted_at) > ?)
            """,
            (cell_date, cell_date),
        ).fetchone()
        total_habits = total_row["cnt"] if total_row else 0
        cells.append(
            {
                "date": cell_date,
                "count": counts.get(cell_date, 0),
                "habits": sorted(
                    habits_by_date.get(cell_date, []),
                    key=lambda name: habit_order.get(name, 9999),
                ),
                "sick_habits": sick_by_date.get(cell_date, []),
                "total_habits": total_habits,
            }
        )
    return cells


def get_today_payload(conn: sqlite3.Connection, target_date: str) -> dict[str, Any]:
    habits = get_habits(conn)
    logs = conn.execute(
        "SELECT habit_id, completed, notes FROM habit_logs WHERE log_date = ?",
        (target_date,),
    ).fetchall()
    by_habit = {row["habit_id"]: row for row in logs}
    sick_rows = conn.execute(
        "SELECT habit_id FROM habit_sick_days WHERE sick_date = ?",
        (target_date,),
    ).fetchall()
    sick_habit_ids = {row["habit_id"] for row in sick_rows}
    enriched_habits = []
    for habit in habits:
        row = by_habit.get(habit["id"])
        session_table = SESSION_BACKED_HABIT_TABLES.get(habit["name"])
        enriched_habits.append(
            {
                **habit,
                "is_sick": habit["id"] in sick_habit_ids,
                "completed": _has_session_on_date(conn, session_table, target_date)
                if session_table
                else bool(row["completed"]) if row else False,
                "notes": None if session_table else row["notes"] if row else None,
            }
        )
    return {
        "date": target_date,
        "habits": enriched_habits,
        "tasks": list_tasks_for_date(conn, target_date),
        "checklists": list_checklists_for_date(conn, target_date),
        "overdue_tasks": list_overdue_tasks(conn, target_date),
        "goals": list_goals(conn),
        "misc_tasks": list_misc_tasks(conn),
    }


def upsert_habit_log(
    conn: sqlite3.Connection, habit_id: int, payload: HabitLogUpsert
) -> dict[str, Any]:
    if payload.completed:
        conn.execute(
            "DELETE FROM habit_sick_days WHERE habit_id = ? AND sick_date = ?",
            (habit_id, payload.date.isoformat()),
        )
    conn.execute(
        """
        INSERT INTO habit_logs(habit_id, log_date, completed, notes)
        VALUES(?, ?, ?, ?)
        ON CONFLICT(habit_id, log_date)
        DO UPDATE SET completed = excluded.completed, notes = excluded.notes
        """,
        (habit_id, payload.date.isoformat(), int(payload.completed), payload.notes),
    )
    row = conn.execute(
        "SELECT id, habit_id, log_date, completed, notes FROM habit_logs WHERE habit_id = ? AND log_date = ?",
        (habit_id, payload.date.isoformat()),
    ).fetchone()
    return {**dict(row), "completed": bool(row["completed"])}

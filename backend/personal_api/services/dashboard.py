from __future__ import annotations

import sqlite3
from datetime import date as dt_date
from typing import Any

from ..core.utils import iso_today, week_start
from .habits import (
    SESSION_BACKED_HABIT_NAMES,
    current_streak_for_habit,
    get_habits,
    get_today_payload,
    habit_heatmap,
    last_completed_date_for_habit,
)
from .modules import session_analytics


def format_duration_minutes(value: float | int) -> str:
    total_seconds = max(0, round(float(value) * 60))
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    if seconds == 0:
        return f"{minutes} min"
    return f"{minutes}:{seconds:02d}"


def activity_feed(conn: sqlite3.Connection, limit: int = 10) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    habit_rows = conn.execute(
        """
        SELECT hl.log_date AS event_date, h.name, hl.notes
        FROM habit_logs hl
        JOIN habits h ON h.id = hl.habit_id
        WHERE hl.completed = 1
          AND NOT EXISTS (
              SELECT 1 FROM habit_sick_days hsd
              WHERE hsd.habit_id = hl.habit_id AND hsd.sick_date = hl.log_date
          )
          AND h.name NOT IN ({placeholders})
        ORDER BY hl.log_date DESC, hl.id DESC
        LIMIT ?
        """.format(placeholders=",".join("?" for _ in SESSION_BACKED_HABIT_NAMES)),
        (*SESSION_BACKED_HABIT_NAMES, limit),
    ).fetchall()
    for row in habit_rows:
        items.append(
            {
                "type": "habit",
                "date": row["event_date"],
                "title": row["name"],
                "subtitle": "Completed habit",
                "notes": row["notes"],
            }
        )

    task_rows = conn.execute(
        """
        SELECT task_date AS event_date, text, notes
        FROM tasks
        WHERE completed = 1
        ORDER BY task_date DESC, id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    for row in task_rows:
        items.append(
            {
                "type": "task",
                "date": row["event_date"],
                "title": row["text"],
                "subtitle": "Finished task",
                "notes": row["notes"],
            }
        )

    for table_name, label in [
        ("guitar_sessions", "Guitar session"),
        ("workout_sessions", "Workout session"),
    ]:
        rows = conn.execute(
            f"""
            SELECT session_date AS event_date, duration_minutes, notes
                   {", run_miles" if table_name == "workout_sessions" else ""}
            FROM {table_name}
            ORDER BY session_date DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        for row in rows:
            subtitle = (
                f'{row["run_miles"]} mi in {format_duration_minutes(row["duration_minutes"])}'
                if table_name == "workout_sessions" and row["run_miles"] is not None
                else (
                    format_duration_minutes(row["duration_minutes"])
                    if row["duration_minutes"]
                    else "Logged session"
                )
            )
            items.append(
                {
                    "type": "session",
                    "date": row["event_date"],
                    "title": label,
                    "subtitle": subtitle,
                    "notes": row["notes"],
                }
            )

    items.sort(key=lambda item: (item["date"], item["title"]), reverse=True)
    return items[:limit]


def build_dashboard(conn: sqlite3.Connection) -> dict[str, Any]:
    today_str = iso_today()
    current_week = week_start(dt_date.today())
    today = get_today_payload(conn, today_str)
    habit_completion = sum(1 for habit in today["habits"] if habit["completed"])
    weekly_guitar = conn.execute(
        """
        SELECT COUNT(*) AS minutes
        FROM guitar_sessions
        WHERE session_date >= ?
        """,
        (current_week.isoformat(),),
    ).fetchone()["minutes"]
    workout_week = conn.execute(
        """
        SELECT COUNT(*) AS count, COALESCE(SUM(run_miles), 0) AS minutes
        FROM workout_sessions
        WHERE session_date >= ?
        """,
        (current_week.isoformat(),),
    ).fetchone()
    open_tasks = conn.execute(
        "SELECT COUNT(*) AS count FROM tasks WHERE task_date = ? AND completed = 0 AND is_misc = 0",
        (today_str,),
    ).fetchone()["count"]

    streaks = [
        {
            "habit_id": habit["id"],
            "name": habit["name"],
            "streak": current_streak_for_habit(conn, habit["id"]),
            "last_completed_date": last_completed_date_for_habit(conn, habit["id"]),
        }
        for habit in get_habits(conn)
    ]
    streaks.sort(key=lambda item: item["streak"], reverse=True)

    return {
        "today": {
            "date": today_str,
            "completed_habits": habit_completion,
            "total_habits": len(today["habits"]),
            "open_tasks": open_tasks,
        },
        "streaks": streaks,
        "weekly_guitar_minutes": weekly_guitar,
        "weekly_workouts": {
            "count": workout_week["count"],
            "minutes": workout_week["minutes"],
        },
        "habit_heatmap": habit_heatmap(conn),
        "guitar": session_analytics(
            conn, "guitar_sessions", "guitar_session_sections", "guitar_sections"
        ),
        "workouts": session_analytics(
            conn, "workout_sessions", "workout_session_sections", "workout_sections"
        ),
        "recent_activity": activity_feed(conn),
    }

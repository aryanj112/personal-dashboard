from __future__ import annotations

import sqlite3
from typing import Any

from .habits import is_session_backed_habit

# Blocks snap to this grid, and a fresh block is one slot tall.
SLOT_MINUTES = 15
DEFAULT_DURATION_MINUTES = 30
MIN_DURATION_MINUTES = 15
MAX_DURATION_MINUTES = 24 * 60


def _clamp_placement(start_minute: int, duration_minutes: int) -> tuple[int, int]:
    """Snap to the slot grid and keep the block inside the day."""
    start = max(0, min(int(start_minute), 24 * 60 - MIN_DURATION_MINUTES))
    start -= start % SLOT_MINUTES

    duration = max(MIN_DURATION_MINUTES, min(int(duration_minutes), MAX_DURATION_MINUTES))
    duration -= duration % SLOT_MINUTES
    duration = max(MIN_DURATION_MINUTES, duration)

    # Don't let a block spill past midnight.
    duration = min(duration, 24 * 60 - start)
    return start, duration


def serialize_block(row: sqlite3.Row) -> dict[str, Any]:
    """Shape a joined block row for the frontend.

    Completion is not stored on task/habit blocks — it is read through to the
    underlying task or habit log so the calendar and the task list can never
    disagree about whether something is done.
    """
    d = dict(row)
    kind = d["kind"]

    if kind == "task":
        title = d.get("task_text") or ""
        completed = bool(d.get("task_completed"))
    elif kind == "habit":
        title = d.get("habit_name") or ""
        completed = bool(d.get("habit_logged"))
    else:
        title = d.get("label") or ""
        completed = bool(d.get("completed"))

    return {
        "id": d["id"],
        "date": d["block_date"],
        "startMinute": d["start_minute"],
        "durationMinutes": d["duration_minutes"],
        "kind": kind,
        "taskId": d.get("task_id"),
        "habitId": d.get("habit_id"),
        "title": title,
        "completed": completed,
        # Guitar/Exercise are completed by logging a session, not by ticking a box.
        "sessionBacked": kind == "habit" and is_session_backed_habit(title),
    }


_SELECT_BLOCKS = """
    SELECT
        b.id,
        b.block_date,
        b.start_minute,
        b.duration_minutes,
        b.kind,
        b.task_id,
        b.habit_id,
        b.label,
        b.completed,
        t.text AS task_text,
        t.completed AS task_completed,
        h.name AS habit_name,
        (
            SELECT hl.completed
            FROM habit_logs hl
            WHERE hl.habit_id = b.habit_id AND hl.log_date = b.block_date
        ) AS habit_logged
    FROM calendar_blocks b
    LEFT JOIN tasks t ON t.id = b.task_id
    LEFT JOIN habits h ON h.id = b.habit_id
"""


def list_blocks(
    conn: sqlite3.Connection, start_date: str, end_date: str
) -> list[dict[str, Any]]:
    rows = conn.execute(
        f"""
        {_SELECT_BLOCKS}
        WHERE b.block_date >= ? AND b.block_date <= ?
        ORDER BY b.block_date, b.start_minute, b.id
        """,
        (start_date, end_date),
    ).fetchall()
    return [serialize_block(row) for row in rows]


def get_block(conn: sqlite3.Connection, block_id: int) -> dict[str, Any] | None:
    row = conn.execute(f"{_SELECT_BLOCKS} WHERE b.id = ?", (block_id,)).fetchone()
    return serialize_block(row) if row else None


def create_block(
    conn: sqlite3.Connection,
    *,
    block_date: str,
    start_minute: int,
    duration_minutes: int | None,
    kind: str,
    task_id: int | None,
    habit_id: int | None,
    label: str,
) -> dict[str, Any]:
    start, duration = _clamp_placement(
        start_minute, duration_minutes or DEFAULT_DURATION_MINUTES
    )

    # A task lives in one place on the calendar; re-dropping it moves it rather
    # than leaving a duplicate behind.
    if kind == "task" and task_id is not None:
        conn.execute("DELETE FROM calendar_blocks WHERE kind = 'task' AND task_id = ?", (task_id,))

    cursor = conn.execute(
        """
        INSERT INTO calendar_blocks(
            block_date, start_minute, duration_minutes, kind, task_id, habit_id, label
        )
        VALUES(?, ?, ?, ?, ?, ?, ?)
        """,
        (block_date, start, duration, kind, task_id, habit_id, label.strip()),
    )
    created = get_block(conn, int(cursor.lastrowid))
    assert created is not None
    return created


def update_block(
    conn: sqlite3.Connection,
    block_id: int,
    *,
    block_date: str | None = None,
    start_minute: int | None = None,
    duration_minutes: int | None = None,
    label: str | None = None,
    completed: bool | None = None,
) -> dict[str, Any] | None:
    current = conn.execute(
        "SELECT block_date, start_minute, duration_minutes, label, completed FROM calendar_blocks WHERE id = ?",
        (block_id,),
    ).fetchone()
    if current is None:
        return None

    start, duration = _clamp_placement(
        current["start_minute"] if start_minute is None else start_minute,
        current["duration_minutes"] if duration_minutes is None else duration_minutes,
    )

    conn.execute(
        """
        UPDATE calendar_blocks
        SET block_date = ?,
            start_minute = ?,
            duration_minutes = ?,
            label = ?,
            completed = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            current["block_date"] if block_date is None else block_date,
            start,
            duration,
            current["label"] if label is None else label.strip(),
            current["completed"] if completed is None else int(completed),
            block_id,
        ),
    )
    return get_block(conn, block_id)


def delete_block(conn: sqlite3.Connection, block_id: int) -> bool:
    deleted = conn.execute("DELETE FROM calendar_blocks WHERE id = ?", (block_id,))
    return deleted.rowcount > 0

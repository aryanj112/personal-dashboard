from __future__ import annotations

import sqlite3
from datetime import date as dt_date, timedelta
from typing import Any

from fastapi import HTTPException

from ..core.utils import dicts, week_start
from ..schemas import SessionCreate, SessionUpdate


def section_rows(conn: sqlite3.Connection, table: str) -> list[dict[str, Any]]:
    rows = conn.execute(f"SELECT id, name FROM {table} ORDER BY name COLLATE NOCASE").fetchall()
    return dicts(rows)


def guitar_material_rows(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT id, title, notes, sort_order FROM guitar_materials ORDER BY sort_order ASC, id ASC"
    ).fetchall()
    return dicts(rows)


def guitar_song_group_rows(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    groups = conn.execute(
        "SELECT id, name, sort_order FROM guitar_song_groups ORDER BY sort_order ASC, id ASC"
    ).fetchall()
    payload: list[dict[str, Any]] = []
    for group in groups:
        songs = conn.execute(
            """
            SELECT id, title, notes, sort_order
            FROM guitar_songs
            WHERE group_id = ?
            ORDER BY sort_order ASC, id ASC
            """,
            (group["id"],),
        ).fetchall()
        song_payload = []
        for song in songs:
            files = conn.execute(
                """
                SELECT id, display_name, relative_path, sort_order
                FROM guitar_song_files
                WHERE song_id = ?
                ORDER BY sort_order ASC, id ASC
                """,
                (song["id"],),
            ).fetchall()
            song_payload.append({**dict(song), "files": dicts(files)})
        payload.append({**dict(group), "songs": song_payload})
    return payload


def create_guitar_material(conn: sqlite3.Connection, title: str, notes: str = "") -> dict[str, Any]:
    next_order = conn.execute(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM guitar_materials"
    ).fetchone()["next_order"]
    cursor = conn.execute(
        "INSERT INTO guitar_materials(title, notes, sort_order) VALUES(?, ?, ?)",
        (title.strip(), notes, next_order),
    )
    row = conn.execute(
        "SELECT id, title, notes, sort_order FROM guitar_materials WHERE id = ?",
        (cursor.lastrowid,),
    ).fetchone()
    return dict(row)


def update_guitar_material(
    conn: sqlite3.Connection,
    material_id: int,
    *,
    title: str | None,
    notes: str | None,
) -> dict[str, Any] | None:
    existing = conn.execute(
        "SELECT id, title, notes, sort_order FROM guitar_materials WHERE id = ?",
        (material_id,),
    ).fetchone()
    if not existing:
        return None
    updated = conn.execute(
        "UPDATE guitar_materials SET title = ?, notes = ? WHERE id = ?",
        (
            title.strip() if title is not None else existing["title"],
            notes if notes is not None else existing["notes"],
            material_id,
        ),
    )
    if updated.rowcount == 0:
        return None
    row = conn.execute(
        "SELECT id, title, notes, sort_order FROM guitar_materials WHERE id = ?",
        (material_id,),
    ).fetchone()
    return dict(row)


def delete_guitar_material(conn: sqlite3.Connection, material_id: int) -> bool:
    deleted = conn.execute("DELETE FROM guitar_materials WHERE id = ?", (material_id,))
    return deleted.rowcount > 0


def create_guitar_song(conn: sqlite3.Connection, group_id: int, title: str) -> dict[str, Any]:
    group = conn.execute(
        "SELECT id FROM guitar_song_groups WHERE id = ?", (group_id,)
    ).fetchone()
    if not group:
        raise HTTPException(status_code=404, detail="Song folder not found.")
    next_order = conn.execute(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM guitar_songs WHERE group_id = ?",
        (group_id,),
    ).fetchone()["next_order"]
    cursor = conn.execute(
        "INSERT INTO guitar_songs(group_id, title, notes, sort_order) VALUES(?, ?, '', ?)",
        (group_id, title.strip(), next_order),
    )
    row = conn.execute(
        "SELECT id, title, notes, sort_order FROM guitar_songs WHERE id = ?",
        (cursor.lastrowid,),
    ).fetchone()
    return {**dict(row), "files": []}


def update_guitar_song(
    conn: sqlite3.Connection,
    song_id: int,
    *,
    title: str | None,
    notes: str | None,
) -> dict[str, Any] | None:
    existing = conn.execute(
        "SELECT id, title, notes, sort_order FROM guitar_songs WHERE id = ?",
        (song_id,),
    ).fetchone()
    if not existing:
        return None
    conn.execute(
        """
        UPDATE guitar_songs
        SET title = ?, notes = ?
        WHERE id = ?
        """,
        (
            title.strip() if title is not None else existing["title"],
            notes if notes is not None else existing["notes"],
            song_id,
        ),
    )
    row = conn.execute(
        "SELECT id, title, notes, sort_order FROM guitar_songs WHERE id = ?",
        (song_id,),
    ).fetchone()
    files = conn.execute(
        """
        SELECT id, display_name, relative_path, sort_order
        FROM guitar_song_files
        WHERE song_id = ?
        ORDER BY sort_order ASC, id ASC
        """,
        (song_id,),
    ).fetchall()
    return {**dict(row), "files": dicts(files)}


def delete_guitar_song(conn: sqlite3.Connection, song_id: int) -> list[str] | None:
    existing = conn.execute(
        "SELECT id FROM guitar_songs WHERE id = ?",
        (song_id,),
    ).fetchone()
    if not existing:
        return None
    file_paths = [
        row["relative_path"]
        for row in conn.execute(
            "SELECT relative_path FROM guitar_song_files WHERE song_id = ?",
            (song_id,),
        ).fetchall()
    ]
    conn.execute("DELETE FROM guitar_songs WHERE id = ?", (song_id,))
    return file_paths


def create_guitar_song_file(
    conn: sqlite3.Connection,
    song_id: int,
    *,
    display_name: str,
    stored_name: str,
    relative_path: str,
) -> dict[str, Any]:
    song = conn.execute("SELECT id FROM guitar_songs WHERE id = ?", (song_id,)).fetchone()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found.")
    next_order = conn.execute(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM guitar_song_files WHERE song_id = ?",
        (song_id,),
    ).fetchone()["next_order"]
    cursor = conn.execute(
        """
        INSERT INTO guitar_song_files(song_id, display_name, stored_name, relative_path, sort_order)
        VALUES(?, ?, ?, ?, ?)
        """,
        (song_id, display_name, stored_name, relative_path, next_order),
    )
    row = conn.execute(
        """
        SELECT id, display_name, relative_path, sort_order
        FROM guitar_song_files
        WHERE id = ?
        """,
        (cursor.lastrowid,),
    ).fetchone()
    return dict(row)


def delete_guitar_song_file(conn: sqlite3.Connection, file_id: int) -> str | None:
    existing = conn.execute(
        "SELECT relative_path FROM guitar_song_files WHERE id = ?",
        (file_id,),
    ).fetchone()
    if not existing:
        return None
    conn.execute("DELETE FROM guitar_song_files WHERE id = ?", (file_id,))
    return existing["relative_path"]


def get_guitar_song_file(conn: sqlite3.Connection, file_id: int) -> dict[str, Any] | None:
    row = conn.execute(
        """
        SELECT id, display_name, relative_path
        FROM guitar_song_files
        WHERE id = ?
        """,
        (file_id,),
    ).fetchone()
    return dict(row) if row else None


def ensure_section_ids_exist(conn: sqlite3.Connection, ids: list[int], table: str) -> None:
    if not ids:
        return
    rows = conn.execute(
        f"SELECT id FROM {table} WHERE id IN ({','.join('?' for _ in ids)})",
        ids,
    ).fetchall()
    if len(rows) != len(set(ids)):
        raise HTTPException(status_code=400, detail="One or more section ids are invalid.")


def session_list(
    conn: sqlite3.Connection,
    session_table: str,
    link_table: str,
    section_table: str,
) -> list[dict[str, Any]]:
    rows = conn.execute(
        f"""
        SELECT id, session_date, duration_minutes, notes,
               {"run_miles, is_rest," if session_table == "workout_sessions" else ""}
               NULL AS placeholder
        FROM {session_table}
        ORDER BY session_date DESC, id DESC
        """
    ).fetchall()
    sessions = []
    for row in rows:
        sections = conn.execute(
            f"""
            SELECT s.id, s.name
            FROM {link_table} ls
            JOIN {section_table} s ON s.id = ls.section_id
            WHERE ls.session_id = ?
            ORDER BY s.name COLLATE NOCASE
            """,
            (row["id"],),
        ).fetchall()
        session = dict(row)
        session.pop("placeholder", None)
        sessions.append({**session, "sections": dicts(sections)})
    return sessions


def save_session(
    conn: sqlite3.Connection,
    payload: SessionCreate | SessionUpdate,
    session_table: str,
    link_table: str,
    section_table: str,
    session_id: int | None = None,
) -> dict[str, Any]:
    section_ids = payload.section_ids if payload.section_ids is not None else []
    ensure_section_ids_exist(conn, section_ids, section_table)

    is_rest = getattr(payload, "is_rest", False) or False
    if session_id is None:
        cursor = conn.execute(
            f"""
            INSERT INTO {session_table}(session_date, duration_minutes, {("run_miles, is_rest, " if session_table == "workout_sessions" else "")}notes)
            VALUES(?, ?, {("?, ?, " if session_table == "workout_sessions" else "")}?)
            """,
            (
                payload.date.isoformat(),
                payload.duration_minutes or 0,
                *((payload.run_miles, 1 if is_rest else 0) if session_table == "workout_sessions" else ()),
                payload.notes,
            ),
        )
        session_id = cursor.lastrowid
    else:
        existing = conn.execute(
            f"SELECT id FROM {session_table} WHERE id = ?", (session_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Session not found.")
        current = conn.execute(
            f"SELECT session_date, duration_minutes, {('run_miles, is_rest,' if session_table == 'workout_sessions' else '')} notes FROM {session_table} WHERE id = ?",
            (session_id,),
        ).fetchone()
        new_is_rest = (is_rest if is_rest is not None else bool(current["is_rest"])) if session_table == "workout_sessions" else False
        conn.execute(
            f"""
            UPDATE {session_table}
            SET session_date = ?, duration_minutes = ?, {('run_miles = ?, is_rest = ?, ' if session_table == 'workout_sessions' else '')}notes = ?
            WHERE id = ?
            """,
            (
                payload.date.isoformat() if payload.date else current["session_date"],
                payload.duration_minutes
                if payload.duration_minutes is not None
                else current["duration_minutes"],
                *(
                    (
                        payload.run_miles if payload.run_miles is not None else current["run_miles"],
                        1 if new_is_rest else 0,
                    )
                    if session_table == "workout_sessions"
                    else ()
                ),
                payload.notes if payload.notes is not None else current["notes"],
                session_id,
            ),
        )
        if payload.section_ids is None:
            section_ids = [
                row["section_id"]
                for row in conn.execute(
                    f"SELECT section_id FROM {link_table} WHERE session_id = ?",
                    (session_id,),
                ).fetchall()
            ]

    conn.execute(f"DELETE FROM {link_table} WHERE session_id = ?", (session_id,))
    for section_id in section_ids:
        conn.execute(
            f"INSERT INTO {link_table}(session_id, section_id) VALUES(?, ?)",
            (session_id, section_id),
        )

    row = conn.execute(
        f"SELECT id, session_date, duration_minutes, {('run_miles, is_rest,' if session_table == 'workout_sessions' else '')} notes FROM {session_table} WHERE id = ?",
        (session_id,),
    ).fetchone()
    sections = conn.execute(
        f"""
        SELECT s.id, s.name
        FROM {link_table} ls
        JOIN {section_table} s ON s.id = ls.section_id
        WHERE ls.session_id = ?
        ORDER BY s.name COLLATE NOCASE
        """,
        (session_id,),
    ).fetchall()
    return {**dict(row), "sections": dicts(sections)}


def session_analytics(
    conn: sqlite3.Connection,
    session_table: str,
    link_table: str,
    section_table: str,
    *,
    aggregate_distribution_by_day: bool = False,
) -> dict[str, Any]:
    today = dt_date.today()
    current_week_start = week_start(today).isoformat()
    start_8_weeks = week_start(today) - timedelta(weeks=7)
    rest_clause = "AND is_rest = 0" if session_table == "workout_sessions" else ""
    sessions = conn.execute(
        f"""
        SELECT id, session_date
        FROM {session_table}
        WHERE 1=1 {rest_clause}
        ORDER BY session_date ASC
        """
    ).fetchall()
    weekly: dict[str, int] = {}
    rolling: list[dict[str, Any]] = []
    all_dates: list[dt_date] = []

    for row in sessions:
        session_day = dt_date.fromisoformat(row["session_date"])
        all_dates.append(session_day)
        key = week_start(session_day).isoformat()
        weekly[key] = weekly.get(key, 0) + 1

    for offset in range(27, -1, -1):
        day = today - timedelta(days=offset)
        start_window = day - timedelta(days=6)
        total = sum(
            1
            for row in sessions
            if start_window <= dt_date.fromisoformat(row["session_date"]) <= day
        )
        rolling.append({"date": day.isoformat(), "minutes": round(total / 7, 1)})

    weekly_points = []
    for offset in range(8):
        current_week = start_8_weeks + timedelta(weeks=offset)
        weekly_points.append(
            {
                "week_start": current_week.isoformat(),
                "minutes": weekly.get(current_week.isoformat(), 0),
            }
        )

    dist_rest = "AND (sess.is_rest IS NULL OR sess.is_rest = 0)" if session_table == "workout_sessions" else ""
    if aggregate_distribution_by_day:
        section_rows_agg = conn.execute(
            f"""
            SELECT s.id, s.name, COUNT(DISTINCT sess.session_date) AS minutes
            FROM {section_table} s
            LEFT JOIN {link_table} l ON l.section_id = s.id
            LEFT JOIN {session_table} sess
              ON sess.id = l.session_id
             AND sess.session_date >= ?
             {dist_rest}
            GROUP BY s.id, s.name
            ORDER BY minutes DESC, s.name COLLATE NOCASE
            """,
            (current_week_start,),
        ).fetchall()
    else:
        section_rows_agg = conn.execute(
            f"""
            SELECT s.id, s.name, COUNT(sess.id) AS minutes
            FROM {section_table} s
            LEFT JOIN {link_table} l ON l.section_id = s.id
            LEFT JOIN {session_table} sess
              ON sess.id = l.session_id
             AND sess.session_date >= ?
             {dist_rest}
            GROUP BY s.id, s.name
            ORDER BY minutes DESC, s.name COLLATE NOCASE
            """,
            (current_week_start,),
        ).fetchall()
    distribution = dicts(section_rows_agg)

    # For streak: rest days fill gaps but don't count as workout days.
    # Fetch ALL session dates (including rest) so a logged rest day doesn't
    # break a consecutive run; only days with actual workouts increment the count.
    workout_day_set = set(all_dates)
    if session_table == "workout_sessions":
        all_rows = conn.execute(
            f"SELECT session_date FROM {session_table} ORDER BY session_date ASC"
        ).fetchall()
        all_day_set: set[dt_date] = {dt_date.fromisoformat(r["session_date"]) for r in all_rows}
    else:
        all_day_set = workout_day_set

    streak = 0
    cursor = today
    if cursor not in all_day_set:
        cursor -= timedelta(days=1)
    while cursor in all_day_set:
        if cursor in workout_day_set:
            streak += 1
        cursor -= timedelta(days=1)

    last_7 = today - timedelta(days=6)
    recent_count = sum(
        1 for row in sessions if dt_date.fromisoformat(row["session_date"]) >= last_7
    )
    total_minutes = len(sessions)
    days_this_week = len(
        {row["session_date"] for row in sessions if row["session_date"] >= current_week_start}
    )

    return {
        "weekly_minutes": weekly_points,
        "rolling_average": rolling,
        "section_distribution": distribution,
        "days_this_week": days_this_week,
        "current_streak": streak,
        "total_minutes": total_minutes,
        "sessions_last_7_days": recent_count,
    }

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Response

from ..core.db import get_db
from ..core.utils import iso_today
from ..schemas import HabitCreate, HabitLogUpsert, HabitUpdate
from ..services.habits import (
    get_habits,
    get_today_payload,
    is_session_backed_habit,
    upsert_habit_log,
)


router = APIRouter(prefix="/api", tags=["habits"])


@router.get("/today")
def api_today(target_date: str | None = None) -> dict[str, Any]:
    selected_date = target_date or iso_today()
    with get_db() as conn:
        return get_today_payload(conn, selected_date)


@router.get("/habits")
def api_habits() -> list[dict[str, Any]]:
    with get_db() as conn:
        return get_habits(conn)


@router.post("/habits", status_code=201)
def api_create_habit(payload: HabitCreate) -> dict[str, Any]:
    with get_db() as conn:
        row = conn.execute("SELECT MAX(sort_order) as m FROM habits WHERE deleted_at IS NULL").fetchone()
        next_order = (row["m"] or 0) + 1 if row else 1
        order = payload.sort_order if payload.sort_order is not None else next_order
        conn.execute(
            "INSERT INTO habits (name, is_active, sort_order) VALUES (?, 1, ?)",
            (payload.name, order),
        )
        new = conn.execute("SELECT id, name, is_active, sort_order FROM habits WHERE name = ?", (payload.name,)).fetchone()
        return {**dict(new), "is_active": True}


@router.delete("/habits/{habit_id}")
def api_delete_habit(habit_id: int) -> dict[str, Any]:
    from datetime import datetime, timezone
    with get_db() as conn:
        habit = conn.execute("SELECT id FROM habits WHERE id = ?", (habit_id,)).fetchone()
        if not habit:
            raise HTTPException(status_code=404, detail="Habit not found.")
        conn.execute(
            "UPDATE habits SET deleted_at = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat(), habit_id),
        )
    return {"ok": True}


@router.patch("/habits/{habit_id}")
def api_update_habit(habit_id: int, payload: HabitUpdate) -> dict[str, Any]:
    with get_db() as conn:
        current = conn.execute(
            "SELECT id, name, is_active, sort_order FROM habits WHERE id = ?",
            (habit_id,),
        ).fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="Habit not found.")
        conn.execute(
            """
            UPDATE habits
            SET name = ?, is_active = ?, sort_order = ?
            WHERE id = ?
            """,
            (
                payload.name or current["name"],
                int(payload.is_active)
                if payload.is_active is not None
                else current["is_active"],
                payload.sort_order
                if payload.sort_order is not None
                else current["sort_order"],
                habit_id,
            ),
        )
        updated = conn.execute(
            "SELECT id, name, is_active, sort_order FROM habits WHERE id = ?",
            (habit_id,),
        ).fetchone()
        return {**dict(updated), "is_active": bool(updated["is_active"])}


@router.put("/habits/{habit_id}/log")
def api_log_habit(habit_id: int, payload: HabitLogUpsert) -> dict[str, Any]:
    with get_db() as conn:
        habit = conn.execute("SELECT id, name FROM habits WHERE id = ?", (habit_id,)).fetchone()
        if not habit:
            raise HTTPException(status_code=404, detail="Habit not found.")
        if is_session_backed_habit(habit["name"]):
            raise HTTPException(
                status_code=400,
                detail="Log a session to complete this habit.",
            )
        return upsert_habit_log(conn, habit_id, payload)

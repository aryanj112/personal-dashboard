from __future__ import annotations

from datetime import date as dt_date, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException

from ..core.db import get_db
from ..schemas import CalendarBlockCreate, CalendarBlockUpdate
from ..services.calendar import (
    create_block,
    delete_block,
    list_blocks,
    update_block,
)

router = APIRouter(prefix="/api/calendar")


@router.get("/blocks")
def api_list_blocks(start: str | None = None, end: str | None = None) -> list[dict[str, Any]]:
    """Blocks in [start, end]. Defaults to the current Mon–Sun week."""
    if start is None:
        today = dt_date.today()
        monday = today - timedelta(days=today.weekday())
        start = monday.isoformat()
        end = (monday + timedelta(days=6)).isoformat()
    elif end is None:
        start_date = dt_date.fromisoformat(start)
        end = (start_date + timedelta(days=6)).isoformat()

    with get_db() as conn:
        return list_blocks(conn, start, end)


@router.post("/blocks", status_code=201)
def api_create_block(payload: CalendarBlockCreate) -> dict[str, Any]:
    if payload.kind == "task" and payload.task_id is None:
        raise HTTPException(status_code=422, detail="task_id is required for task blocks.")
    if payload.kind == "habit" and payload.habit_id is None:
        raise HTTPException(status_code=422, detail="habit_id is required for habit blocks.")
    if payload.kind == "temp" and not payload.label.strip():
        raise HTTPException(status_code=422, detail="label is required for temp blocks.")

    with get_db() as conn:
        if payload.task_id is not None:
            exists = conn.execute("SELECT 1 FROM tasks WHERE id = ?", (payload.task_id,)).fetchone()
            if not exists:
                raise HTTPException(status_code=404, detail="Task not found.")
        if payload.habit_id is not None:
            exists = conn.execute("SELECT 1 FROM habits WHERE id = ?", (payload.habit_id,)).fetchone()
            if not exists:
                raise HTTPException(status_code=404, detail="Habit not found.")

        return create_block(
            conn,
            block_date=payload.date.isoformat(),
            start_minute=payload.start_minute,
            duration_minutes=payload.duration_minutes,
            kind=payload.kind,
            task_id=payload.task_id,
            habit_id=payload.habit_id,
            label=payload.label,
        )


@router.patch("/blocks/{block_id}")
def api_update_block(block_id: int, payload: CalendarBlockUpdate) -> dict[str, Any]:
    with get_db() as conn:
        updated = update_block(
            conn,
            block_id,
            block_date=payload.date.isoformat() if payload.date is not None else None,
            start_minute=payload.start_minute,
            duration_minutes=payload.duration_minutes,
            label=payload.label,
            completed=payload.completed,
        )
        if updated is None:
            raise HTTPException(status_code=404, detail="Block not found.")
        return updated


@router.delete("/blocks/{block_id}")
def api_delete_block(block_id: int) -> dict[str, bool]:
    with get_db() as conn:
        if not delete_block(conn, block_id):
            raise HTTPException(status_code=404, detail="Block not found.")
        return {"ok": True}

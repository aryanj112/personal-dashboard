from __future__ import annotations

from datetime import date as dt_date, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException

from ..core.db import get_db
from ..schemas import (
    ChecklistCreate,
    ChecklistProgressUpdate,
    GoalCreate,
    RecurringTaskCreate,
    RecurringTaskUpdate,
    TaskCreate,
    TaskUpdate,
)
from ..services.recurring import (
    create_recurring_task,
    delete_recurring_task,
    generate_tasks_for_range,
    list_recurring_tasks,
    update_recurring_task,
)
from ..services.tasks import (
    get_checklist_for_date,
    list_misc_tasks,
    list_overdue_tasks,
    list_tasks_for_week,
    serialize_task,
)


router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("/week")
def api_get_week(week_start: str | None = None) -> dict[str, Any]:
    if week_start:
        start = dt_date.fromisoformat(week_start)
    else:
        today = dt_date.today()
        # Monday of current week
        start = today - timedelta(days=today.weekday())
    end = start + timedelta(days=6)
    start_iso = start.isoformat()
    end_iso = end.isoformat()

    # Generate recurring task instances for this week + 2 weeks ahead
    gen_end = end + timedelta(weeks=2)
    with get_db() as conn:
        generate_tasks_for_range(conn, start, gen_end)
        week_tasks = list_tasks_for_week(conn, start_iso, end_iso)
        overdue = list_overdue_tasks(conn, start_iso)
        misc = list_misc_tasks(conn)

    # group tasks by date
    by_date: dict[str, list[dict[str, Any]]] = {}
    for offset in range(7):
        day = (start + timedelta(days=offset)).isoformat()
        by_date[day] = []
    for task in week_tasks:
        day = task["task_date"]
        if day in by_date:
            by_date[day].append(task)

    return {
        "start": start_iso,
        "end": end_iso,
        "days": [
            {"date": day, "tasks": by_date[day]}
            for day in sorted(by_date.keys())
        ],
        "overdue_tasks": overdue,
        "misc_tasks": misc,
    }


@router.post("")
def api_create_task(payload: TaskCreate) -> dict[str, Any]:
    with get_db() as conn:
        task_date = payload.date.isoformat() if payload.date else None
        is_misc = int(payload.is_misc)

        if not is_misc and not task_date:
            raise HTTPException(status_code=422, detail="date is required unless is_misc is true")

        next_sort = conn.execute(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM tasks WHERE task_date IS ? AND is_misc = ?",
            (task_date, is_misc),
        ).fetchone()["next_sort"]
        cursor = conn.execute(
            """
            INSERT INTO tasks(text, task_date, completed, notes, sort_order, checklist_id, priority, is_misc, url)
            VALUES(?, ?, 0, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.text.strip(),
                task_date,
                payload.notes,
                next_sort,
                payload.checklist_id,
                payload.priority,
                is_misc,
                payload.url or "",
            ),
        )
        row = conn.execute(
            "SELECT id, text, task_date, completed, notes, sort_order, checklist_id, priority, is_misc, url FROM tasks WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        return serialize_task(row)


@router.patch("/{task_id}")
def api_update_task(task_id: int, payload: TaskUpdate) -> dict[str, Any]:
    with get_db() as conn:
        current = conn.execute(
            "SELECT id, text, task_date, completed, notes, sort_order, checklist_id, priority, is_misc, url FROM tasks WHERE id = ?",
            (task_id,),
        ).fetchone()
        if not current:
            raise HTTPException(status_code=404, detail="Task not found.")
        provided_fields = payload.model_fields_set
        next_is_misc = int(payload.is_misc) if payload.is_misc is not None else current["is_misc"]
        if "date" in provided_fields:
            next_task_date = payload.date.isoformat() if payload.date is not None else None
        elif payload.is_misc is True:
            next_task_date = None
        else:
            next_task_date = current["task_date"]

        if not next_is_misc and not next_task_date:
            raise HTTPException(status_code=422, detail="date is required unless is_misc is true")
        conn.execute(
            """
            UPDATE tasks
            SET text = ?, completed = ?, notes = ?, sort_order = ?, task_date = ?, priority = ?, is_misc = ?, url = ?
            WHERE id = ?
            """,
            (
                payload.text.strip() if payload.text else current["text"],
                int(payload.completed)
                if payload.completed is not None
                else current["completed"],
                payload.notes if payload.notes is not None else current["notes"],
                payload.sort_order
                if payload.sort_order is not None
                else current["sort_order"],
                next_task_date,
                payload.priority if payload.priority is not None else current["priority"],
                next_is_misc,
                payload.url if payload.url is not None else current["url"],
                task_id,
            ),
        )
        row = conn.execute(
            "SELECT id, text, task_date, completed, notes, sort_order, checklist_id, priority, is_misc, url FROM tasks WHERE id = ?",
            (task_id,),
        ).fetchone()
        return serialize_task(row)


@router.delete("/{task_id}")
def api_delete_task(task_id: int) -> dict[str, bool]:
    with get_db() as conn:
        deleted = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        if deleted.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found.")
        return {"ok": True}


@router.post("/goals")
def api_create_goal(payload: GoalCreate) -> dict[str, Any]:
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO goals(text) VALUES(?)",
            (payload.text.strip(),),
        )
        row = conn.execute(
            "SELECT id, text, created_at FROM goals WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        return dict(row)


@router.delete("/goals/{goal_id}")
def api_delete_goal(goal_id: int) -> dict[str, bool]:
    with get_db() as conn:
        deleted = conn.execute("DELETE FROM goals WHERE id = ?", (goal_id,))
        if deleted.rowcount == 0:
            raise HTTPException(status_code=404, detail="Goal not found.")
        return {"ok": True}


@router.post("/checklists")
def api_create_checklist(payload: ChecklistCreate) -> dict[str, Any]:
    with get_db() as conn:
        next_sort = conn.execute(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM checklist_trackers"
        ).fetchone()["next_sort"]
        cursor = conn.execute(
            """
            INSERT INTO checklist_trackers(text, starting_count, total_goal, daily_goal, sort_order)
            VALUES(?, ?, ?, ?, ?)
            """,
            (
                payload.text.strip(),
                payload.starting_count,
                payload.total_goal,
                payload.daily_goal,
                next_sort,
            ),
        )
        return {
            "id": cursor.lastrowid,
            "text": payload.text.strip(),
            "starting_count": payload.starting_count,
            "current_count": payload.starting_count,
            "total_goal": payload.total_goal,
            "daily_goal": payload.daily_goal,
            "today_count": 0,
            "sort_order": next_sort,
            "task_id": None,
            "task_completed": False,
        }


@router.post("/checklists/{checklist_id}/progress")
def api_update_checklist_progress(
    checklist_id: int, payload: ChecklistProgressUpdate
) -> dict[str, Any]:
    with get_db() as conn:
        tracker = conn.execute(
            """
            SELECT id, starting_count
            FROM checklist_trackers
            WHERE id = ?
            """,
            (checklist_id,),
        ).fetchone()
        if not tracker:
            raise HTTPException(status_code=404, detail="Checklist not found.")

        total_logged = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM checklist_logs WHERE checklist_id = ?",
            (checklist_id,),
        ).fetchone()["total"]
        current_total = tracker["starting_count"] + total_logged

        current_row = conn.execute(
            """
            SELECT id, amount
            FROM checklist_logs
            WHERE checklist_id = ? AND log_date = ?
            """,
            (checklist_id, payload.date.isoformat()),
        ).fetchone()
        current_amount = current_row["amount"] if current_row else 0
        next_amount = current_amount + payload.delta
        next_total = current_total + payload.delta

        if next_amount < 0 or next_total < 0:
            raise HTTPException(status_code=400, detail="Checklist progress cannot go below zero.")

        if current_row and next_amount == 0:
            conn.execute("DELETE FROM checklist_logs WHERE id = ?", (current_row["id"],))
        elif current_row:
            conn.execute(
                "UPDATE checklist_logs SET amount = ? WHERE id = ?",
                (next_amount, current_row["id"]),
            )
        elif payload.delta != 0:
            conn.execute(
                """
                INSERT INTO checklist_logs(checklist_id, log_date, amount)
                VALUES(?, ?, ?)
                """,
                (checklist_id, payload.date.isoformat(), payload.delta),
            )

        checklist = get_checklist_for_date(conn, checklist_id, payload.date.isoformat())
        if not checklist:
            raise HTTPException(status_code=404, detail="Checklist not found.")
        return checklist


@router.post("/checklists/{checklist_id}/task")
def api_create_task_from_checklist(checklist_id: int, payload: ChecklistProgressUpdate) -> dict[str, Any]:
    with get_db() as conn:
        tracker = conn.execute(
            "SELECT id, text FROM checklist_trackers WHERE id = ?",
            (checklist_id,),
        ).fetchone()
        if not tracker:
            raise HTTPException(status_code=404, detail="Checklist not found.")

        existing = conn.execute(
            """
            SELECT id, text, task_date, completed, notes, sort_order, checklist_id, priority, is_misc, url
            FROM tasks
            WHERE checklist_id = ? AND task_date = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (checklist_id, payload.date.isoformat()),
        ).fetchone()
        if existing:
            return serialize_task(existing)

        next_sort = conn.execute(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM tasks WHERE task_date = ?",
            (payload.date.isoformat(),),
        ).fetchone()["next_sort"]
        cursor = conn.execute(
            """
            INSERT INTO tasks(text, task_date, completed, notes, sort_order, checklist_id, priority, is_misc, url)
            VALUES(?, ?, 0, NULL, ?, ?, 'medium', 0, '')
            """,
            (tracker["text"], payload.date.isoformat(), next_sort, checklist_id),
        )
        row = conn.execute(
            "SELECT id, text, task_date, completed, notes, sort_order, checklist_id, priority, is_misc, url FROM tasks WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        return serialize_task(row)


@router.delete("/checklists/{checklist_id}")
def api_delete_checklist(checklist_id: int) -> dict[str, bool]:
    with get_db() as conn:
        conn.execute("UPDATE tasks SET checklist_id = NULL WHERE checklist_id = ?", (checklist_id,))
        deleted = conn.execute("DELETE FROM checklist_trackers WHERE id = ?", (checklist_id,))
        if deleted.rowcount == 0:
            raise HTTPException(status_code=404, detail="Checklist not found.")
        return {"ok": True}


# ── Recurring tasks ────────────────────────────────────────────────────────────

@router.get("/recurring")
def api_list_recurring_tasks() -> list[dict[str, Any]]:
    with get_db() as conn:
        return list_recurring_tasks(conn)


@router.post("/recurring")
def api_create_recurring_task(payload: RecurringTaskCreate) -> dict[str, Any]:
    with get_db() as conn:
        task = create_recurring_task(conn, payload)
        # Eagerly generate instances for today + 3 weeks so they show immediately
        today = dt_date.today()
        generate_tasks_for_range(conn, today, today + timedelta(weeks=3))
        return task


@router.patch("/recurring/{task_id}")
def api_update_recurring_task(task_id: int, payload: RecurringTaskUpdate) -> dict[str, Any]:
    with get_db() as conn:
        result = update_recurring_task(conn, task_id, payload)
        if result is None:
            raise HTTPException(status_code=404, detail="Recurring task not found.")
        # Re-generate if it was just re-activated
        if payload.is_active:
            today = dt_date.today()
            generate_tasks_for_range(conn, today, today + timedelta(weeks=3))
        return result


@router.delete("/recurring/{task_id}")
def api_delete_recurring_task(task_id: int) -> dict[str, bool]:
    with get_db() as conn:
        ok = delete_recurring_task(conn, task_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Recurring task not found.")
        return {"ok": True}

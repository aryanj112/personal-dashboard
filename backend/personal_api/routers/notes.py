from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from ..core.db import get_db as get_conn

router = APIRouter(prefix="/api/notes", tags=["notes"])


class NotesResponse(BaseModel):
    content: str
    updated_at: str


class NotesSaveRequest(BaseModel):
    content: str


@router.get("", response_model=NotesResponse)
def get_notes() -> NotesResponse:
    with get_conn() as conn:
        row = conn.execute("SELECT content, updated_at FROM app_notes WHERE id = 1").fetchone()
    if row is None:
        return NotesResponse(content="", updated_at="")
    return NotesResponse(content=row["content"], updated_at=row["updated_at"])


@router.put("", response_model=NotesResponse)
def save_notes(body: NotesSaveRequest) -> NotesResponse:
    now = datetime.now(timezone.utc).isoformat()
    with get_conn() as conn:
        conn.execute(
            "UPDATE app_notes SET content = ?, updated_at = ? WHERE id = 1",
            (body.content, now),
        )
    return NotesResponse(content=body.content, updated_at=now)

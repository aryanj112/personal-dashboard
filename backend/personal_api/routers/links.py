from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from personal_api.core.db import get_db

router = APIRouter()


class LinkCreate(BaseModel):
    label: str
    url: str


class LinkUpdate(BaseModel):
    label: str | None = None
    url: str | None = None
    sort_order: int | None = None


@router.get("/links")
def api_list_links() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, label, url, sort_order FROM quick_links ORDER BY sort_order, id"
        ).fetchall()
        return [dict(row) for row in rows]


@router.post("/links")
def api_create_link(payload: LinkCreate) -> dict:
    with get_db() as conn:
        max_order = conn.execute("SELECT COALESCE(MAX(sort_order), -1) FROM quick_links").fetchone()[0]
        cur = conn.execute(
            "INSERT INTO quick_links (label, url, sort_order) VALUES (?, ?, ?)",
            (payload.label.strip(), payload.url.strip(), max_order + 1),
        )
        row = conn.execute(
            "SELECT id, label, url, sort_order FROM quick_links WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
        return dict(row)


@router.patch("/links/{link_id}")
def api_update_link(link_id: int, payload: LinkUpdate) -> dict:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM quick_links WHERE id = ?", (link_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Link not found.")
        label = payload.label.strip() if payload.label is not None else row["label"]
        url = payload.url.strip() if payload.url is not None else row["url"]
        sort_order = payload.sort_order if payload.sort_order is not None else row["sort_order"]
        conn.execute(
            "UPDATE quick_links SET label = ?, url = ?, sort_order = ? WHERE id = ?",
            (label, url, sort_order, link_id),
        )
        updated = conn.execute(
            "SELECT id, label, url, sort_order FROM quick_links WHERE id = ?", (link_id,)
        ).fetchone()
        return dict(updated)


@router.delete("/links/{link_id}")
def api_delete_link(link_id: int) -> dict:
    with get_db() as conn:
        deleted = conn.execute("DELETE FROM quick_links WHERE id = ?", (link_id,))
        if deleted.rowcount == 0:
            raise HTTPException(status_code=404, detail="Link not found.")
        return {"ok": True}

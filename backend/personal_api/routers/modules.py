from __future__ import annotations

from pathlib import Path
from uuid import uuid4
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from ..core.db import GUITAR_FILES_DIR, get_db
from ..schemas import (
    GuitarMaterialCreate,
    GuitarMaterialUpdate,
    GuitarSongCreate,
    GuitarSongUpdate,
    SectionCreate,
    SectionUpdate,
    SessionCreate,
    SessionUpdate,
)
from ..services.modules import (
    create_guitar_material,
    create_guitar_song,
    create_guitar_song_file,
    delete_guitar_material,
    delete_guitar_song,
    delete_guitar_song_file,
    get_guitar_song_file,
    guitar_material_rows,
    guitar_song_group_rows,
    save_session,
    section_rows,
    session_analytics,
    session_list,
    update_guitar_material,
    update_guitar_song,
)


router = APIRouter(prefix="/api", tags=["modules"])


def module_payload(
    conn,
    session_table: str,
    link_table: str,
    section_table: str,
    *,
    aggregate_distribution_by_day: bool = False,
) -> dict[str, Any]:
    return {
        "sections": section_rows(conn, section_table),
        "sessions": session_list(conn, session_table, link_table, section_table),
        "analytics": session_analytics(
            conn,
            session_table,
            link_table,
            section_table,
            aggregate_distribution_by_day=aggregate_distribution_by_day,
        ),
    }


@router.get("/guitar")
def api_guitar() -> dict[str, Any]:
    with get_db() as conn:
        payload = module_payload(
            conn,
            "guitar_sessions",
            "guitar_session_sections",
            "guitar_sections",
            aggregate_distribution_by_day=True,
        )
        payload["materials"] = guitar_material_rows(conn)
        payload["song_groups"] = guitar_song_group_rows(conn)
        return payload


@router.post("/guitar/materials")
def api_create_guitar_material(payload: GuitarMaterialCreate) -> dict[str, Any]:
    with get_db() as conn:
        return create_guitar_material(conn, payload.title, payload.notes)


@router.patch("/guitar/materials/{material_id}")
def api_update_guitar_material(material_id: int, payload: GuitarMaterialUpdate) -> dict[str, Any]:
    with get_db() as conn:
        material = update_guitar_material(
            conn,
            material_id,
            title=payload.title,
            notes=payload.notes,
        )
        if not material:
            raise HTTPException(status_code=404, detail="Material not found.")
        return material


@router.delete("/guitar/materials/{material_id}")
def api_delete_guitar_material(material_id: int) -> dict[str, bool]:
    with get_db() as conn:
        if not delete_guitar_material(conn, material_id):
            raise HTTPException(status_code=404, detail="Material not found.")
        return {"ok": True}


@router.post("/guitar/song-groups/{group_id}/songs")
def api_create_guitar_song(group_id: int, payload: GuitarSongCreate) -> dict[str, Any]:
    with get_db() as conn:
        return create_guitar_song(conn, group_id, payload.title)


@router.patch("/guitar/songs/{song_id}")
def api_update_guitar_song(song_id: int, payload: GuitarSongUpdate) -> dict[str, Any]:
    with get_db() as conn:
        song = update_guitar_song(conn, song_id, title=payload.title, notes=payload.notes)
        if not song:
            raise HTTPException(status_code=404, detail="Song not found.")
        return song


@router.delete("/guitar/songs/{song_id}")
def api_delete_guitar_song(song_id: int) -> dict[str, bool]:
    with get_db() as conn:
        file_paths = delete_guitar_song(conn, song_id)
        if file_paths is None:
            raise HTTPException(status_code=404, detail="Song not found.")
    for relative_path in file_paths:
        target = (GUITAR_FILES_DIR.parent / relative_path).resolve()
        if target.exists():
            target.unlink()
    return {"ok": True}


@router.post("/guitar/songs/{song_id}/files")
async def api_upload_guitar_song_file(song_id: int, file: UploadFile = File(...)) -> dict[str, Any]:
    filename = file.filename or "untitled.pdf"
    suffix = Path(filename).suffix.lower()
    if suffix != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    stored_name = f"{uuid4().hex}{suffix}"
    target_path = GUITAR_FILES_DIR / stored_name
    content = await file.read()
    target_path.write_bytes(content)
    relative_path = f"guitar_files/{stored_name}"

    try:
        with get_db() as conn:
            return create_guitar_song_file(
                conn,
                song_id,
                display_name=filename,
                stored_name=stored_name,
                relative_path=relative_path,
            )
    except Exception:
        if target_path.exists():
            target_path.unlink()
        raise


@router.get("/guitar/song-files/{file_id}")
def api_get_guitar_song_file(file_id: int) -> FileResponse:
    with get_db() as conn:
        file_row = get_guitar_song_file(conn, file_id)
        if not file_row:
            raise HTTPException(status_code=404, detail="File not found.")
    file_path = (GUITAR_FILES_DIR.parent / file_row["relative_path"]).resolve()
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File missing on disk.")
    return FileResponse(file_path, media_type="application/pdf", filename=file_row["display_name"])


@router.delete("/guitar/song-files/{file_id}")
def api_delete_guitar_song_file(file_id: int) -> dict[str, bool]:
    with get_db() as conn:
        relative_path = delete_guitar_song_file(conn, file_id)
        if relative_path is None:
            raise HTTPException(status_code=404, detail="File not found.")
    target = (GUITAR_FILES_DIR.parent / relative_path).resolve()
    if target.exists():
        target.unlink()
    return {"ok": True}


@router.post("/guitar/sections")
def api_create_guitar_section(payload: SectionCreate) -> dict[str, Any]:
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO guitar_sections(name) VALUES(?)", (payload.name.strip(),)
        )
        row = conn.execute(
            "SELECT id, name FROM guitar_sections WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
        return dict(row)


@router.patch("/guitar/sections/{section_id}")
def api_update_guitar_section(section_id: int, payload: SectionUpdate) -> dict[str, Any]:
    with get_db() as conn:
        updated = conn.execute(
            "UPDATE guitar_sections SET name = ? WHERE id = ?",
            (payload.name.strip(), section_id),
        )
        if updated.rowcount == 0:
            raise HTTPException(status_code=404, detail="Section not found.")
        row = conn.execute(
            "SELECT id, name FROM guitar_sections WHERE id = ?", (section_id,)
        ).fetchone()
        return dict(row)


@router.delete("/guitar/sections/{section_id}")
def api_delete_guitar_section(section_id: int) -> dict[str, bool]:
    with get_db() as conn:
        deleted = conn.execute("DELETE FROM guitar_sections WHERE id = ?", (section_id,))
        if deleted.rowcount == 0:
            raise HTTPException(status_code=404, detail="Section not found.")
        return {"ok": True}


@router.post("/guitar/sessions")
def api_create_guitar_session(payload: SessionCreate) -> dict[str, Any]:
    with get_db() as conn:
        return save_session(
            conn,
            payload,
            "guitar_sessions",
            "guitar_session_sections",
            "guitar_sections",
        )


@router.patch("/guitar/sessions/{session_id}")
def api_update_guitar_session(session_id: int, payload: SessionUpdate) -> dict[str, Any]:
    with get_db() as conn:
        return save_session(
            conn,
            payload,
            "guitar_sessions",
            "guitar_session_sections",
            "guitar_sections",
            session_id=session_id,
        )


@router.delete("/guitar/sessions/{session_id}")
def api_delete_guitar_session(session_id: int) -> dict[str, bool]:
    with get_db() as conn:
        deleted = conn.execute("DELETE FROM guitar_sessions WHERE id = ?", (session_id,))
        if deleted.rowcount == 0:
            raise HTTPException(status_code=404, detail="Session not found.")
        return {"ok": True}


@router.get("/workouts")
def api_workouts() -> dict[str, Any]:
    with get_db() as conn:
        return module_payload(
            conn,
            "workout_sessions",
            "workout_session_sections",
            "workout_sections",
        )


@router.post("/workouts/sections")
def api_create_workout_section(payload: SectionCreate) -> dict[str, Any]:
    with get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO workout_sections(name) VALUES(?)", (payload.name.strip(),)
        )
        row = conn.execute(
            "SELECT id, name FROM workout_sections WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
        return dict(row)


@router.patch("/workouts/sections/{section_id}")
def api_update_workout_section(section_id: int, payload: SectionUpdate) -> dict[str, Any]:
    with get_db() as conn:
        updated = conn.execute(
            "UPDATE workout_sections SET name = ? WHERE id = ?",
            (payload.name.strip(), section_id),
        )
        if updated.rowcount == 0:
            raise HTTPException(status_code=404, detail="Section not found.")
        row = conn.execute(
            "SELECT id, name FROM workout_sections WHERE id = ?", (section_id,)
        ).fetchone()
        return dict(row)


@router.delete("/workouts/sections/{section_id}")
def api_delete_workout_section(section_id: int) -> dict[str, bool]:
    with get_db() as conn:
        deleted = conn.execute("DELETE FROM workout_sections WHERE id = ?", (section_id,))
        if deleted.rowcount == 0:
            raise HTTPException(status_code=404, detail="Section not found.")
        return {"ok": True}


@router.post("/workouts/sessions")
def api_create_workout_session(payload: SessionCreate) -> dict[str, Any]:
    with get_db() as conn:
        return save_session(
            conn,
            payload,
            "workout_sessions",
            "workout_session_sections",
            "workout_sections",
        )


@router.patch("/workouts/sessions/{session_id}")
def api_update_workout_session(session_id: int, payload: SessionUpdate) -> dict[str, Any]:
    with get_db() as conn:
        return save_session(
            conn,
            payload,
            "workout_sessions",
            "workout_session_sections",
            "workout_sections",
            session_id=session_id,
        )


@router.delete("/workouts/sessions/{session_id}")
def api_delete_workout_session(session_id: int) -> dict[str, bool]:
    with get_db() as conn:
        deleted = conn.execute("DELETE FROM workout_sessions WHERE id = ?", (session_id,))
        if deleted.rowcount == 0:
            raise HTTPException(status_code=404, detail="Session not found.")
        return {"ok": True}

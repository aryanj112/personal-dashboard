from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..core.db import get_db
from ..schemas import NetworkingContactCreate, NetworkingContactUpdate, PotentialConnectUpdate
from ..services.networking import (
    create_contact,
    delete_contact,
    list_contacts,
    list_potential_connects,
    update_contact,
    update_potential_connect,
)


router = APIRouter(prefix="/api/networking", tags=["networking"])


@router.get("")
def api_list_contacts() -> dict[str, Any]:
    with get_db() as conn:
        return {"contacts": list_contacts(conn)}


@router.get("/potential-connects")
def api_list_potential_connects() -> dict[str, Any]:
    with get_db() as conn:
        return {"potentialConnects": list_potential_connects(conn)}


@router.post("")
def api_create_contact(payload: NetworkingContactCreate) -> dict[str, Any]:
    with get_db() as conn:
        return create_contact(conn, payload)


@router.patch("/{contact_id}")
def api_update_contact(contact_id: int, payload: NetworkingContactUpdate) -> dict[str, Any]:
    with get_db() as conn:
        contact = update_contact(conn, contact_id, payload)
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found.")
        return contact


@router.delete("/{contact_id}")
def api_delete_contact(contact_id: int) -> dict[str, bool]:
    with get_db() as conn:
        if not delete_contact(conn, contact_id):
            raise HTTPException(status_code=404, detail="Contact not found.")
        return {"ok": True}


@router.patch("/potential-connects/{connect_id}")
def api_update_potential_connect(connect_id: int, payload: PotentialConnectUpdate) -> dict[str, Any]:
    with get_db() as conn:
        connect = update_potential_connect(conn, connect_id, payload)
        if not connect:
            raise HTTPException(status_code=404, detail="Potential connect not found.")
        return connect

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from ..core.db import get_db
from ..services.reflection import reflection_payload


router = APIRouter(prefix="/api/reflection", tags=["reflection"])


@router.get("")
def api_reflection() -> dict[str, Any]:
    with get_db() as conn:
        return reflection_payload(conn)

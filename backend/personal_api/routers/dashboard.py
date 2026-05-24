from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from ..core.db import get_db
from ..services.dashboard import build_dashboard


router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
def api_dashboard() -> dict[str, Any]:
    with get_db() as conn:
        return build_dashboard(conn)

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from ..core.db import get_db
from ..services.internships import (
    fetch_company_postings,
    generate_summary_for_posting,
    list_postings_for_company,
    list_tracked_companies,
    toggle_posting_applied,
    update_posting_manual_bucket,
)


router = APIRouter(prefix="/api/internships", tags=["internships"])


@router.get("/companies")
def api_list_internship_companies() -> dict[str, Any]:
    with get_db() as conn:
        return {"companies": list_tracked_companies(conn)}


@router.get("/postings")
def api_list_internship_postings(company_id: int) -> dict[str, Any]:
    with get_db() as conn:
        company, postings = list_postings_for_company(conn, company_id)
        if not company:
            raise HTTPException(status_code=404, detail="Tracked company not found.")
        return {"company": company, "postings": postings}


@router.post("/fetch/{company_id}")
def api_fetch_internship_postings(company_id: int) -> dict[str, Any]:
    with get_db() as conn:
        try:
            company, postings = fetch_company_postings(conn, company_id)
        except LookupError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        except RuntimeError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
        return {"company": company, "postings": postings}


@router.post("/postings/{posting_id}/summarize")
def api_summarize_internship_posting(posting_id: int) -> dict[str, Any]:
    with get_db() as conn:
        try:
            company, postings = generate_summary_for_posting(conn, posting_id)
        except LookupError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        return {"company": company, "postings": postings}


@router.patch("/postings/{posting_id}")
def api_update_internship_posting(posting_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    with get_db() as conn:
        try:
            if "manual_bucket" in payload:
                company, postings = update_posting_manual_bucket(
                    conn, posting_id, str(payload.get("manual_bucket") or "")
                )
            elif payload.get("toggle_applied"):
                company, postings = toggle_posting_applied(conn, posting_id)
            else:
                raise ValueError("No valid field to update.")
        except LookupError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        return {"company": company, "postings": postings}

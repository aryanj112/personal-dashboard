from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.companies import (
    create_company,
    delete_company,
    get_cowork_text,
    list_companies,
    update_company,
)

router = APIRouter()


class CompanyCreate(BaseModel):
    name: str
    category: str
    careers_url: str = ""
    source_type: str = "none"
    source_key: str = ""


class CompanyPatch(BaseModel):
    name: str | None = None
    category: str | None = None
    careers_url: str | None = None
    source_type: str | None = None
    source_key: str | None = None
    is_active: bool | None = None


@router.get("/api/companies")
def get_companies():
    return {"companies": list_companies()}


@router.get("/api/companies/cowork-text")
def get_companies_cowork_text():
    return {"content": get_cowork_text()}


@router.post("/api/companies")
def post_company(body: CompanyCreate):
    try:
        company = create_company(
            name=body.name,
            category=body.category,
            careers_url=body.careers_url,
            source_type=body.source_type,
            source_key=body.source_key,
        )
        return company
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/api/companies/{company_id}")
def patch_company(company_id: int, body: CompanyPatch):
    try:
        patch = body.model_dump(exclude_none=True)
        if "is_active" in patch:
            patch["is_active"] = 1 if patch["is_active"] else 0
        return update_company(company_id, patch)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/api/companies/{company_id}")
def delete_company_route(company_id: int):
    delete_company(company_id)
    return {"ok": True}

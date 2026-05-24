from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from ..schemas import ResumeCompileRequest
from ..services.resume import compile_latex_to_pdf, sanitize_job_name


router = APIRouter(prefix="/api/resume", tags=["resume"])


@router.post("/compile")
def api_compile_resume(payload: ResumeCompileRequest) -> Response:
    try:
        pdf_bytes = compile_latex_to_pdf(payload.source, job_name=payload.name)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    filename = f"{sanitize_job_name(payload.name)}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )

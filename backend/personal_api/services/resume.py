from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from pathlib import Path


LATEX_ENGINE = shutil.which("pdflatex") or "/Library/TeX/texbin/pdflatex"


def compile_latex_to_pdf(source: str, *, job_name: str = "resume") -> bytes:
    cleaned_source = source.strip()
    if not cleaned_source:
        raise ValueError("LaTeX source is empty.")
    if not Path(LATEX_ENGINE).exists():
        raise RuntimeError("pdflatex is not installed on this machine.")

    safe_job_name = sanitize_job_name(job_name)
    with tempfile.TemporaryDirectory(prefix="personal-resume-") as temp_dir:
        temp_path = Path(temp_dir)
        tex_path = temp_path / f"{safe_job_name}.tex"
        pdf_path = temp_path / f"{safe_job_name}.pdf"
        tex_path.write_text(source, encoding="utf-8")

        result = subprocess.run(
            [
                LATEX_ENGINE,
                "-interaction=nonstopmode",
                "-halt-on-error",
                "-file-line-error",
                "-no-shell-escape",
                f"-jobname={safe_job_name}",
                str(tex_path),
            ],
            cwd=temp_path,
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )

        if result.returncode != 0 or not pdf_path.exists():
            raise RuntimeError(extract_latex_error(result.stdout, result.stderr))

        return pdf_path.read_bytes()


def sanitize_job_name(value: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-")
    return cleaned or "resume"


def extract_latex_error(stdout: str, stderr: str) -> str:
    combined = "\n".join(part for part in (stdout, stderr) if part.strip()).strip()
    if not combined:
        return "LaTeX compilation failed."

    lines = [line.rstrip() for line in combined.splitlines() if line.strip()]
    error_lines = [line for line in lines if line.startswith("!") or ".tex:" in line]
    excerpt = error_lines[-6:] if error_lines else lines[-12:]
    message = "\n".join(excerpt).strip()
    return message or "LaTeX compilation failed."

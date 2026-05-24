from __future__ import annotations

from datetime import datetime

from ..core.db import DATA_DIR, get_db


def list_companies() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, name, source_type, source_key, careers_url, category, is_active
            FROM tracked_companies
            ORDER BY category ASC, name ASC
            """
        ).fetchall()
    return [dict(r) for r in rows]


def create_company(
    name: str,
    category: str,
    careers_url: str = "",
    source_type: str = "none",
    source_key: str = "",
) -> dict:
    with get_db() as conn:
        row = conn.execute(
            """
            INSERT INTO tracked_companies(name, source_type, source_key, careers_url, category)
            VALUES(?, ?, ?, ?, ?)
            RETURNING id, name, source_type, source_key, careers_url, category, is_active
            """,
            (name.strip(), source_type, source_key, careers_url, category),
        ).fetchone()
    write_cowork_file()
    return dict(row)


def update_company(company_id: int, patch: dict) -> dict:
    allowed = {"name", "category", "careers_url", "source_type", "source_key", "is_active"}
    fields = {k: v for k, v in patch.items() if k in allowed}
    if not fields:
        raise ValueError("No valid fields to update")

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [company_id]

    with get_db() as conn:
        row = conn.execute(
            f"""
            UPDATE tracked_companies
            SET {set_clause}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            RETURNING id, name, source_type, source_key, careers_url, category, is_active
            """,
            values,
        ).fetchone()

    if not row:
        raise ValueError(f"Company {company_id} not found")

    write_cowork_file()
    return dict(row)


def delete_company(company_id: int) -> None:
    with get_db() as conn:
        conn.execute("DELETE FROM tracked_companies WHERE id = ?", (company_id,))
    write_cowork_file()


def get_cowork_text() -> str:
    """Return the formatted company list for pasting into the cowork bot."""
    companies = list_companies()

    by_category: dict[str, list[dict]] = {}
    for company in companies:
        cat = company["category"] or "Uncategorized"
        by_category.setdefault(cat, []).append(company)

    lines = [
        "## MY TARGET COMPANIES",
        f"Last updated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}",
        "",
        "The following companies are my primary targets for networking, referrals, and internship",
        "opportunities. When identifying people to reach out to or researching connections,",
        "prioritize this list.",
        "",
    ]

    for category, cats in sorted(by_category.items()):
        lines.append(f"### {category}")
        for c in sorted(cats, key=lambda x: x["name"]):
            if c["careers_url"]:
                lines.append(f"• {c['name']} — {c['careers_url']}")
            else:
                lines.append(f"• {c['name']}")
        lines.append("")

    return "\n".join(lines)


def write_cowork_file() -> None:
    """Regenerate the cowork bot company list text file after any mutation."""
    content = get_cowork_text()
    output_path = DATA_DIR / "companies_cowork.txt"
    output_path.write_text(content, encoding="utf-8")

from __future__ import annotations

import http.cookiejar
import json
import re
import sqlite3
import uuid
from html import unescape
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPCookieProcessor, urlopen

from personal_api.services.ollama import generate_posting_summary


GREENHOUSE_JOBS_URL = "https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs"
GREENHOUSE_JOB_URL = "https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{job_id}"
LEVER_JOBS_URL = "https://api.lever.co/v0/postings/{site}?mode=json"
WORKDAY_BASE_URL = "https://{tenant}.{instance}.myworkdayjobs.com/wday/cxs/{tenant}/{site}"
INTERNSHIP_PATTERN = re.compile(r"\b(intern(ship)?|co[- ]?op)\b", re.IGNORECASE)
EXCLUDED_EARLY_CAREER_PATTERN = re.compile(
    r"\b(new grad(uate)?|graduate program|accelerator|rotation(al)?|rotational)\b",
    re.IGNORECASE,
)
PHD_PATTERN = re.compile(r"\bph\.?\s*d\b", re.IGNORECASE)
US_LOCATION_PATTERN = re.compile(
    r"\b("
    r"united states|usa|u\.s\.a\.|u\.s\.|washington dc|district of columbia|remote\s*-\s*us|remote\s+us|us\s+remote|"
    r"alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|"
    r"illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|"
    r"mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|"
    r"north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|"
    r"utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|"
    r"AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC"
    r")\b",
    re.IGNORECASE,
)
PRIME_POSITIVE_PATTERN = re.compile(
    r"\b("
    r"software engineer|software engineering|swe|backend|infrastructure|infra|platform|embedded|firmware|"
    r"robotics?|autonomy|controls?|perception|computer vision|cv\b|machine learning|ml\b|artificial intelligence|"
    r"\bai\b|simulation|systems software|distributed systems|full stack|full-stack"
    r")\b",
    re.IGNORECASE,
)
PRIME_NEGATIVE_PATTERN = re.compile(
    r"\b("
    r"product|operations?|finance|financial|accounting|hr|human resources|people|recruit(ing|er)?|talent|"
    r"marketing|sales|legal|customer|support|industrial|mechanical|electrical|manufacturing|supply chain|"
    r"quality|business|mba|strategy|security|procurement|facilities"
    r")\b",
    re.IGNORECASE,
)
ALLOWED_MANUAL_BUCKETS = {"", "prime", "not_prime", "hidden", "saved", "dismissed"}

# Rubric keyword buckets for the discover view
RUBRIC_BUCKETS: dict[str, re.Pattern[str]] = {
    "swe": re.compile(
        r"\b(software engineer|software dev|swe\b|full.?stack|backend|front.?end|platform|"
        r"infrastructure|infra\b|web engineer|systems engineer)\b",
        re.IGNORECASE,
    ),
    "ml_ai": re.compile(
        r"\b(machine learning|ml\b|artificial intelligence|\bai\b|deep learning|llm\b|nlp\b|"
        r"natural language|computer vision|research engineer|research scientist|applied ml|"
        r"applied ai|inference|model training|reinforcement learning|rl\b|generative)\b",
        re.IGNORECASE,
    ),
    "robotics": re.compile(
        r"\b(robotic[s]?|robot\b|embedded|firmware|\bros\b|autonomy|autonomous|controls?\b|perception|"
        r"motion planning|mechatronics|localization|\bslam\b|fpga|c\+\+|actuator|drone|uav)\b",
        re.IGNORECASE,
    ),
    "climate": re.compile(
        r"\b(climate|clean energy|sustainability|renewable|carbon|clean tech|social good|"
        r"environmental|green energy|decarboniz|electrification)\b",
        re.IGNORECASE,
    ),
    "data": re.compile(
        r"\b(data engineer|data platform|mlops|ml ops|data pipeline|analytics engineer|"
        r"data infrastructure|data science|lakehouse|data warehouse)\b",
        re.IGNORECASE,
    ),
}
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")
WHITESPACE_PATTERN = re.compile(r"\s+")


def list_tracked_companies(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT
            c.id,
            c.name,
            c.source_type,
            c.source_key,
            c.careers_url,
            c.role_focus,
            c.last_fetched_at,
            c.last_fetch_error,
            COALESCE(SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END), 0) AS active_postings,
            COALESCE(SUM(CASE WHEN p.is_active = 1 AND p.is_internship = 1 THEN 1 ELSE 0 END), 0) AS internship_matches
        FROM tracked_companies c
        LEFT JOIN internship_postings p ON p.company_id = c.id
        WHERE c.is_active = 1 AND c.source_type != 'none'
        GROUP BY c.id
        ORDER BY c.name COLLATE NOCASE ASC
        """
    ).fetchall()
    return [company_payload(row) for row in rows]


def list_postings_for_company(
    conn: sqlite3.Connection, company_id: int
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    company_row = conn.execute(
        """
        SELECT
            c.id,
            c.name,
            c.source_type,
            c.source_key,
            c.careers_url,
            c.role_focus,
            c.last_fetched_at,
            c.last_fetch_error,
            COALESCE(SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END), 0) AS active_postings,
            COALESCE(SUM(CASE WHEN p.is_active = 1 AND p.is_internship = 1 THEN 1 ELSE 0 END), 0) AS internship_matches
        FROM tracked_companies c
        LEFT JOIN internship_postings p ON p.company_id = c.id
        WHERE c.id = ? AND c.is_active = 1
        GROUP BY c.id
        """,
        (company_id,),
    ).fetchone()
    if not company_row:
        return None, []

    postings = conn.execute(
        """
        SELECT
            id,
            company_id,
            external_id,
            title,
            location,
            team,
            employment_type,
            url,
            description_text,
            first_published_at,
            updated_at_remote,
            is_active,
            is_internship,
            manual_bucket,
            ai_summary,
            is_applied,
            fetched_at
        FROM internship_postings
        WHERE company_id = ? AND is_active = 1
        ORDER BY is_internship DESC,
                 COALESCE(first_published_at, updated_at_remote, fetched_at) DESC,
                 id DESC
        """,
        (company_id,),
    ).fetchall()
    return company_payload(company_row), [posting_payload(row) for row in postings]


def fetch_company_postings(conn: sqlite3.Connection, company_id: int) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    company_row = conn.execute(
        """
        SELECT id, name, source_type, source_key, careers_url, role_focus
        FROM tracked_companies
        WHERE id = ? AND is_active = 1
        """,
        (company_id,),
    ).fetchone()
    if not company_row:
        raise LookupError("Tracked company not found.")

    source_type = (company_row["source_type"] or "").strip().lower()
    source_key = company_row["source_key"].strip()
    try:
        if source_type == "greenhouse":
            jobs = _fetch_greenhouse_jobs(source_key)
            normalized_jobs = [
                normalized
                for normalized in (_normalize_greenhouse_job(source_key, job) for job in jobs)
                if normalized["external_id"]
            ]
            matched_job_ids = [job["external_id"] for job in normalized_jobs if job["is_internship"]]
            detail_by_id: dict[str, str] = {}
            for job_id in matched_job_ids:
                try:
                    detail_by_id[job_id] = _fetch_greenhouse_job_description(source_key, job_id)
                except RuntimeError:
                    detail_by_id[job_id] = ""

            normalized_jobs = [
                {**job, "description_text": detail_by_id.get(job["external_id"], "")}
                for job in normalized_jobs
            ]
        elif source_type == "lever":
            jobs = _fetch_lever_jobs(source_key)
            normalized_jobs = [
                normalized
                for normalized in (_normalize_lever_job(job) for job in jobs)
                if normalized["external_id"]
            ]
        elif source_type == "workday":
            jobs = _fetch_workday_jobs(source_key)
            normalized_jobs = [
                normalized
                for normalized in (_normalize_workday_job(source_key, job) for job in jobs)
                if normalized["external_id"]
            ]
        elif source_type == "tesla":
            from personal_api.services.tesla_scraper import fetch_tesla_jobs, normalize_tesla_jobs
            raw_jobs = fetch_tesla_jobs()
            normalized_jobs = [j for j in normalize_tesla_jobs(raw_jobs) if j["external_id"]]
        else:
            raise RuntimeError(f"Unsupported source type: {source_type or 'unknown'}")
    except RuntimeError as error:
        conn.execute(
            """
            UPDATE tracked_companies
            SET last_fetch_error = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (str(error), company_id),
        )
        raise

    _replace_company_postings(conn, company_id, normalized_jobs)

    company, postings = list_postings_for_company(conn, company_id)
    if not company:
        raise LookupError("Tracked company not found.")
    return company, postings


def update_posting_manual_bucket(
    conn: sqlite3.Connection, posting_id: int, manual_bucket: str
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    normalized_bucket = (manual_bucket or "").strip().lower()
    if normalized_bucket not in ALLOWED_MANUAL_BUCKETS:
        raise ValueError("Invalid internship posting bucket.")

    posting_row = conn.execute(
        "SELECT company_id FROM internship_postings WHERE id = ?",
        (posting_id,),
    ).fetchone()
    if not posting_row:
        raise LookupError("Internship posting not found.")

    conn.execute(
        """
        UPDATE internship_postings
        SET manual_bucket = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (normalized_bucket, posting_id),
    )
    company, postings = list_postings_for_company(conn, int(posting_row["company_id"]))
    if not company:
        raise LookupError("Tracked company not found.")
    return company, postings


def toggle_posting_applied(
    conn: sqlite3.Connection, posting_id: int
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    posting_row = conn.execute(
        "SELECT company_id, is_applied FROM internship_postings WHERE id = ?",
        (posting_id,),
    ).fetchone()
    if not posting_row:
        raise LookupError("Internship posting not found.")
    new_value = 0 if posting_row["is_applied"] else 1
    conn.execute(
        "UPDATE internship_postings SET is_applied = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (new_value, posting_id),
    )
    company, postings = list_postings_for_company(conn, int(posting_row["company_id"]))
    if not company:
        raise LookupError("Tracked company not found.")
    return company, postings


def generate_summary_for_posting(
    conn: sqlite3.Connection, posting_id: int
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    posting_row = conn.execute(
        """
        SELECT
            p.company_id,
            p.description_text,
            p.url,
            c.source_type,
            c.source_key
        FROM internship_postings p
        JOIN tracked_companies c ON c.id = p.company_id
        WHERE p.id = ?
        """,
        (posting_id,),
    ).fetchone()
    if not posting_row:
        raise LookupError("Internship posting not found.")
    description_text = posting_row["description_text"] or ""
    source_type = (posting_row["source_type"] or "").strip().lower()

    if not description_text and source_type == "workday":
        description_text = _fetch_workday_posting_description(
            posting_row["source_key"] or "",
            posting_row["url"] or "",
        )
        if description_text:
            conn.execute(
                """
                UPDATE internship_postings
                SET description_text = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (description_text, posting_id),
            )

    summary = generate_posting_summary(description_text)
    conn.execute(
        "UPDATE internship_postings SET ai_summary = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (summary, posting_id),
    )
    company, postings = list_postings_for_company(conn, int(posting_row["company_id"]))
    if not company:
        raise LookupError("Tracked company not found.")
    return company, postings


def scrape_all_companies(conn: sqlite3.Connection) -> dict[str, Any]:
    companies = conn.execute(
        """
        SELECT id, name FROM tracked_companies
        WHERE is_active = 1 AND source_type != 'none' AND source_type != ''
        ORDER BY name COLLATE NOCASE
        """
    ).fetchall()

    scraped: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    for company in companies:
        company_id = int(company["id"])
        try:
            _, postings = fetch_company_postings(conn, company_id)
            scraped.append({
                "companyId": company_id,
                "companyName": company["name"],
                "postingCount": len(postings),
                "internshipCount": sum(1 for p in postings if p.get("isInternship")),
            })
        except Exception as exc:  # noqa: BLE001
            errors.append({
                "companyId": company_id,
                "companyName": company["name"],
                "error": str(exc),
            })

    return {
        "scraped": scraped,
        "errors": errors,
        "totalCompanies": len(companies),
        "successCount": len(scraped),
        "errorCount": len(errors),
    }


def list_discover_postings(conn: sqlite3.Connection, days: int = 14) -> dict[str, Any]:
    rows = conn.execute(
        """
        SELECT
            p.id,
            p.company_id,
            c.name AS company_name,
            p.title,
            p.location,
            p.team,
            p.url,
            p.description_text,
            p.first_published_at,
            p.updated_at_remote,
            p.fetched_at,
            p.manual_bucket,
            p.is_applied,
            p.ai_summary
        FROM internship_postings p
        JOIN tracked_companies c ON c.id = p.company_id
        WHERE p.is_internship = 1 AND p.is_active = 1
          AND p.fetched_at >= datetime('now', :days_ago)
        ORDER BY
            COALESCE(p.first_published_at, p.updated_at_remote, p.fetched_at) DESC,
            p.id DESC
        """,
        {"days_ago": f"-{days} days"},
    ).fetchall()

    matched: list[dict[str, Any]] = []
    unmatched: list[dict[str, Any]] = []

    for row in rows:
        haystack = f"{row['title']} {row['description_text']}"
        # Skip non-US locations
        if not _is_us_location(row["location"] or ""):
            continue

        # Title must not be a non-CS role (strategy, ops, finance, etc.)
        title = row["title"] or ""
        title_vetoed = bool(PRIME_NEGATIVE_PATTERN.search(title))

        # At least one bucket must match the title itself — description alone isn't enough
        title_match_tags = [
            bucket for bucket, pattern in RUBRIC_BUCKETS.items()
            if pattern.search(title)
        ]
        # Description can add extra tags but only if the title already qualifies
        if title_match_tags and not title_vetoed:
            haystack = f"{title} {row['description_text']}"
            match_tags = [
                bucket for bucket, pattern in RUBRIC_BUCKETS.items()
                if pattern.search(haystack)
            ]
        else:
            match_tags = []

        payload: dict[str, Any] = {
            "id": row["id"],
            "companyId": row["company_id"],
            "companyName": row["company_name"],
            "title": title,
            "location": row["location"] or "",
            "team": row["team"] or "",
            "url": row["url"] or "",
            "firstPublishedAt": row["first_published_at"],
            "updatedAtRemote": row["updated_at_remote"],
            "fetchedAt": row["fetched_at"],
            "matchTags": match_tags,
            "manualBucket": row["manual_bucket"] or "",
            "isApplied": bool(row["is_applied"]),
            "aiSummary": row["ai_summary"] or "",
        }
        if match_tags:
            matched.append(payload)
        else:
            unmatched.append(payload)

    return {"matched": matched, "unmatched": unmatched}


def company_payload(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "sourceType": row["source_type"],
        "sourceKey": row["source_key"],
        "careersUrl": row["careers_url"],
        "roleFocus": row["role_focus"],
        "lastFetchedAt": row["last_fetched_at"],
        "lastFetchError": row["last_fetch_error"],
        "activePostings": row["active_postings"],
        "internshipMatches": row["internship_matches"],
    }


def posting_payload(row: sqlite3.Row) -> dict[str, Any]:
    description_text = row["description_text"] or ""
    preview = description_text[:280].rstrip()
    if preview and len(description_text) > len(preview):
        preview = f"{preview}..."
    title = row["title"] or ""
    team = row["team"] or ""
    employment_type = row["employment_type"] or ""
    location = row["location"] or ""
    passes_stage_one = _passes_stage_one_job(title, employment_type, location)
    is_auto_prime = passes_stage_one and _is_auto_prime_role(title, team)
    return {
        "id": row["id"],
        "companyId": row["company_id"],
        "externalId": row["external_id"],
        "title": title,
        "location": location,
        "team": team,
        "employmentType": employment_type,
        "url": row["url"],
        "descriptionText": description_text,
        "preview": preview,
        "firstPublishedAt": row["first_published_at"],
        "updatedAtRemote": row["updated_at_remote"],
        "isActive": bool(row["is_active"]),
        "isInternship": bool(row["is_internship"]),
        "passesStageOne": passes_stage_one,
        "isAutoPrime": is_auto_prime,
        "manualBucket": row["manual_bucket"] or "",
        "aiSummary": row["ai_summary"] or "",
        "isApplied": bool(row["is_applied"]),
        "fetchedAt": row["fetched_at"],
    }


def _fetch_greenhouse_jobs(board_token: str) -> list[dict[str, Any]]:
    payload = _fetch_json(GREENHOUSE_JOBS_URL.format(board_token=board_token))
    jobs = payload.get("jobs")
    if not isinstance(jobs, list):
        raise RuntimeError("Greenhouse returned an unexpected jobs payload.")
    return [job for job in jobs if isinstance(job, dict)]


def _fetch_greenhouse_job_description(board_token: str, job_id: str) -> str:
    payload = _fetch_json(GREENHOUSE_JOB_URL.format(board_token=board_token, job_id=job_id))
    return _clean_html(payload.get("content") or "")


def _fetch_lever_jobs(site: str) -> list[dict[str, Any]]:
    payload = _fetch_json(LEVER_JOBS_URL.format(site=site))
    if not isinstance(payload, list):
        raise RuntimeError("Lever returned an unexpected jobs payload.")
    return [job for job in payload if isinstance(job, dict)]


def _fetch_json(url: str) -> dict[str, Any]:
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "personal-app-internships/1.0",
        },
    )
    try:
        with urlopen(request, timeout=25) as response:
            return json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"Greenhouse request failed with status {error.code}.") from error
    except URLError as error:
        raise RuntimeError("Could not reach the Greenhouse job board.") from error
    except json.JSONDecodeError as error:
        raise RuntimeError("Greenhouse returned invalid JSON.") from error


def _normalize_greenhouse_job(board_token: str, job: dict[str, Any]) -> dict[str, Any]:
    title = str(job.get("title") or "").strip()
    employment_type = _greenhouse_metadata_value(job, "Employment Type")
    team = (
        _greenhouse_metadata_value(job, "External Department Name for Job Board")
        or _collapse_departments(job.get("departments"))
    )

    return {
        "external_id": str(job.get("id") or "").strip(),
        "title": title,
        "location": str((job.get("location") or {}).get("name") or "").strip(),
        "team": team,
        "employment_type": employment_type,
        "url": str(job.get("absolute_url") or f"https://boards.greenhouse.io/{board_token}").strip(),
        "first_published_at": job.get("first_published"),
        "updated_at_remote": job.get("updated_at"),
        "description_text": "",
        "is_internship": _is_internship_job(title, employment_type),
    }


def _fetch_workday_jobs(source_key: str) -> list[dict[str, Any]]:
    """source_key format: tenant/wdN/SiteName e.g. tesla/wd3/Tesla_External_Site"""
    base, _site, opener, headers = _create_workday_client(source_key)

    def _fetch_page(limit: int, offset: int) -> dict[str, Any]:
        body = json.dumps({
            "appliedFacets": {}, "limit": limit, "offset": offset, "searchText": "intern",
        }).encode()
        try:
            with opener.open(
                Request(f"{base}/jobs", data=body, headers={**headers, "Content-Type": "application/json"}),
                timeout=25,
            ) as resp:
                return json.loads(resp.read())  # type: ignore[return-value]
        except HTTPError as exc:
            raise exc

    # Some Workday instances cap the page size at 20; try 100 first, fall back.
    page_size = 100
    try:
        first_page = _fetch_page(page_size, 0)
    except HTTPError as exc:
        if exc.code == 400:
            page_size = 20
            try:
                first_page = _fetch_page(page_size, 0)
            except HTTPError as exc2:
                if exc2.code == 422:
                    raise RuntimeError(
                        "Workday returned a session error (422). The job board may be temporarily unavailable."
                    ) from exc2
                raise RuntimeError(f"Workday jobs fetch failed with HTTP {exc2.code}.") from exc2
        elif exc.code == 422:
            raise RuntimeError(
                "Workday returned a session error (422). The job board may be temporarily unavailable."
            ) from exc
        else:
            raise RuntimeError(f"Workday jobs fetch failed with HTTP {exc.code}.") from exc
    except URLError as exc:
        raise RuntimeError(f"Workday jobs fetch failed: {exc}") from exc

    listings: list[dict[str, Any]] = first_page.get("jobPostings") or []
    if not isinstance(listings, list):
        raise RuntimeError("Workday returned an unexpected jobs payload.")

    # Paginate to collect up to 300 listings (enough to find all internships)
    total = first_page.get("total") or 0
    offset = page_size
    while offset < total and offset < 300:
        try:
            page = _fetch_page(page_size, offset)
            more = page.get("jobPostings") or []
            if not more:
                break
            listings.extend(more)
            offset += page_size
        except Exception:
            break

    jobs: list[dict[str, Any]] = []
    for listing in listings:
        path = str(listing.get("externalPath") or "").strip()
        if not path:
            continue
        detail: dict[str, Any] = {}
        normalized_listing = _normalize_workday_job(source_key, {"listing": listing, "detail": detail})
        if _passes_stage_one_job(
            normalized_listing["title"],
            normalized_listing["employment_type"],
            normalized_listing["location"],
        ):
            detail = _fetch_workday_job_detail(base, opener, headers, path)
        jobs.append({"listing": listing, "detail": detail})

    return jobs


def _normalize_workday_job(source_key: str, job: dict[str, Any]) -> dict[str, Any]:
    parts = source_key.split("/")
    tenant, instance, site = parts[0], parts[1], parts[2]
    listing = job.get("listing") or {}
    detail = job.get("detail") or {}

    title = str(detail.get("title") or listing.get("title") or "").strip()
    location = str(detail.get("location") or listing.get("locationsText") or "").strip()
    employment_type = str(detail.get("timeType") or listing.get("timeType") or "").strip()
    external_id = str(
        detail.get("jobReqId")
        or detail.get("jobPostingId")
        or (listing.get("bulletFields") or [""])[0]
        or ""
    ).strip()
    url = str(
        detail.get("externalUrl")
        or f"https://{tenant}.{instance}.myworkdayjobs.com/{site}{listing.get('externalPath', '')}"
    ).strip()
    description_text = _clean_html(str(detail.get("jobDescription") or ""))
    first_published_at = str(detail.get("startDate") or "").strip() or None

    return {
        "external_id": external_id,
        "title": title,
        "location": location,
        "team": str(detail.get("jobFamily") or detail.get("jobCategory") or "").strip(),
        "employment_type": employment_type,
        "url": url,
        "description_text": description_text,
        "first_published_at": first_published_at,
        "updated_at_remote": None,
        "is_internship": _is_internship_job(title, employment_type),
    }


def _create_workday_client(source_key: str) -> tuple[str, str, Any, dict[str, str]]:
    parts = source_key.split("/")
    if len(parts) != 3:
        raise RuntimeError(f"Invalid Workday source key (expected tenant/wdN/SiteName): {source_key}")
    tenant, instance, site = parts
    base = WORKDAY_BASE_URL.format(tenant=tenant, instance=instance, site=site)

    csrf_token = str(uuid.uuid4())
    cj = http.cookiejar.CookieJar()
    opener = build_opener(HTTPCookieProcessor(cj))
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
        "x-calypso-csrf-token": csrf_token,
    }

    # Establish session once, then reuse it for page and selective detail fetches.
    try:
        opener.open(
            Request(f"{base}/approot", headers={**headers, "Content-Type": "application/x-www-form-urlencoded"}),
            timeout=20,
        )
    except HTTPError:
        pass
    except URLError as exc:
        raise RuntimeError(f"Workday session init failed: {exc}") from exc

    return base, site, opener, headers


def _fetch_workday_job_detail(
    base: str,
    opener: Any,
    headers: dict[str, str],
    external_path: str,
) -> dict[str, Any]:
    try:
        with opener.open(Request(f"{base}{external_path}", headers=headers), timeout=20) as resp:
            payload = json.loads(resp.read())
    except Exception:
        return {}

    detail = payload.get("jobPostingInfo") or {}
    return detail if isinstance(detail, dict) else {}


def _fetch_workday_posting_description(source_key: str, posting_url: str) -> str:
    base, site, opener, headers = _create_workday_client(source_key)
    external_path = _extract_workday_external_path(site, posting_url)
    if not external_path:
        return ""
    detail = _fetch_workday_job_detail(base, opener, headers, external_path)
    return _clean_html(str(detail.get("jobDescription") or ""))


def _extract_workday_external_path(site: str, posting_url: str) -> str:
    path = urlparse(posting_url).path.strip()
    if not path:
        return ""

    site_prefix = f"/{site}"
    if not path.startswith(site_prefix):
        return ""

    external_path = path[len(site_prefix):]
    if not external_path:
        return ""
    return external_path if external_path.startswith("/") else f"/{external_path}"


def _normalize_lever_job(job: dict[str, Any]) -> dict[str, Any]:
    categories = job.get("categories") or {}
    if not isinstance(categories, dict):
        categories = {}
    title = str(job.get("text") or "").strip()
    employment_type = str(categories.get("commitment") or "").strip()
    description_parts = [
        str(job.get("openingPlain") or "").strip(),
        str(job.get("descriptionPlain") or "").strip(),
        str(job.get("descriptionBodyPlain") or "").strip(),
        str(job.get("additionalPlain") or "").strip(),
    ]
    description_text = "\n\n".join(part for part in description_parts if part).strip()
    return {
        "external_id": str(job.get("id") or "").strip(),
        "title": title,
        "location": str(categories.get("location") or "").strip(),
        "team": str(categories.get("team") or categories.get("department") or "").strip(),
        "employment_type": employment_type,
        "url": str(job.get("hostedUrl") or job.get("applyUrl") or "").strip(),
        "first_published_at": _lever_timestamp_to_iso(job.get("createdAt")),
        "updated_at_remote": _lever_timestamp_to_iso(job.get("createdAt")),
        "description_text": description_text,
        "is_internship": _is_internship_job(title, employment_type),
    }


def _greenhouse_metadata_value(job: dict[str, Any], name: str) -> str:
    metadata = job.get("metadata") or []
    if not isinstance(metadata, list):
        return ""
    for field in metadata:
        if not isinstance(field, dict):
            continue
        if str(field.get("name") or "").strip().lower() != name.strip().lower():
            continue
        return str(field.get("value") or "").strip()
    return ""


def _collapse_departments(departments: Any) -> str:
    if not isinstance(departments, list):
        return ""
    names: list[str] = []
    for department in departments:
        if not isinstance(department, dict):
            continue
        name = str(department.get("name") or "").strip()
        if name and name not in names:
            names.append(name)
    return " / ".join(names[:2])


def _is_internship_job(title: str, employment_type: str) -> bool:
    haystack = " ".join(part for part in [title, employment_type] if part).strip()
    return bool(INTERNSHIP_PATTERN.search(haystack))


def _passes_stage_one_job(title: str, employment_type: str, location: str) -> bool:
    haystack = " ".join(part for part in [title, employment_type] if part).strip()
    if not _is_internship_job(title, employment_type):
        return False
    if EXCLUDED_EARLY_CAREER_PATTERN.search(haystack):
        return False
    if PHD_PATTERN.search(haystack):
        return False
    if not _is_us_location(location):
        return False
    return True


AMBIGUOUS_LOCATION_PATTERN = re.compile(
    r"\b(flexible|multiple|any\s+\w+\s+site|various|nationwide|anywhere)\b",
    re.IGNORECASE,
)


def _is_us_location(location: str) -> bool:
    normalized = (location or "").strip()
    if not normalized:
        return True
    if normalized.lower() == "remote":
        return True
    # "Flexible - Any SpaceX Site", "Multiple Locations", etc. — no country
    # signal means we can't rule it out as US; let it through.
    if AMBIGUOUS_LOCATION_PATTERN.search(normalized):
        return True
    return bool(US_LOCATION_PATTERN.search(normalized))


def _is_auto_prime_role(title: str, team: str) -> bool:
    haystack = " ".join(part for part in [title, team] if part).strip()
    if not haystack:
        return False
    if PRIME_NEGATIVE_PATTERN.search(haystack):
        return False
    return bool(PRIME_POSITIVE_PATTERN.search(haystack))


def _replace_company_postings(
    conn: sqlite3.Connection, company_id: int, normalized_jobs: list[dict[str, Any]]
) -> None:
    conn.execute(
        """
        UPDATE tracked_companies
        SET last_fetched_at = CURRENT_TIMESTAMP,
            last_fetch_error = '',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (company_id,),
    )
    conn.execute(
        "UPDATE internship_postings SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE company_id = ?",
        (company_id,),
    )

    for job in normalized_jobs:
        conn.execute(
            """
            INSERT INTO internship_postings(
                company_id,
                external_id,
                title,
                location,
                team,
                employment_type,
                url,
                description_text,
                first_published_at,
                updated_at_remote,
                is_active,
                is_internship,
                fetched_at,
                updated_at
            )
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(company_id, external_id) DO UPDATE SET
                title = excluded.title,
                location = excluded.location,
                team = CASE
                    WHEN excluded.team != '' THEN excluded.team
                    ELSE internship_postings.team
                END,
                employment_type = CASE
                    WHEN excluded.employment_type != '' THEN excluded.employment_type
                    ELSE internship_postings.employment_type
                END,
                url = excluded.url,
                description_text = CASE
                    WHEN excluded.description_text != '' THEN excluded.description_text
                    ELSE internship_postings.description_text
                END,
                first_published_at = COALESCE(excluded.first_published_at, internship_postings.first_published_at),
                updated_at_remote = COALESCE(excluded.updated_at_remote, internship_postings.updated_at_remote),
                is_active = 1,
                is_internship = excluded.is_internship,
                fetched_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            """,
            (
                company_id,
                job["external_id"],
                job["title"],
                job["location"],
                job["team"],
                job["employment_type"],
                job["url"],
                job.get("description_text", ""),
                job["first_published_at"],
                job["updated_at_remote"],
                1 if job["is_internship"] else 0,
            ),
        )

    rows = conn.execute(
        """
        SELECT id, title, team, employment_type, location, description_text, manual_bucket
        FROM internship_postings
        WHERE company_id = ? AND is_active = 1
          AND description_text != '' AND ai_summary = ''
        """,
        (company_id,),
    ).fetchall()
    for row in rows:
        manual_bucket = row["manual_bucket"] or ""
        if manual_bucket in ("not_prime", "hidden"):
            continue
        passes = _passes_stage_one_job(row["title"] or "", row["employment_type"] or "", row["location"] or "")
        is_prime = manual_bucket == "prime" or (passes and _is_auto_prime_role(row["title"] or "", row["team"] or ""))
        if not is_prime:
            continue
        summary = generate_posting_summary(row["description_text"])
        if summary:
            conn.execute(
                "UPDATE internship_postings SET ai_summary = ? WHERE id = ?",
                (summary, row["id"]),
            )


def _lever_timestamp_to_iso(value: Any) -> str | None:
    if value is None:
        return None
    try:
        timestamp_ms = int(value)
    except (TypeError, ValueError):
        return None
    from datetime import datetime, timezone

    return datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc).isoformat()


def _clean_html(value: str) -> str:
    if not value:
        return ""
    plain = HTML_TAG_PATTERN.sub(" ", unescape(value))
    return WHITESPACE_PATTERN.sub(" ", plain).strip()

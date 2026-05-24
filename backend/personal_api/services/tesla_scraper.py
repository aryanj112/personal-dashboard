"""
Tesla careers scraper using Camoufox.

Tesla runs a proprietary ATS (not Greenhouse/Lever/Workday) behind Akamai Bot Manager.
Camoufox patches Firefox at the C++ level to reduce browser fingerprint detection.

Important:
- Locale/timezone spoofing can help the browser look more US-like.
- It does not replace a real US residential IP or US proxy. Akamai still weighs IP reputation.

Optional environment variables for local testing:
- TESLA_SCRAPER_LOCALE=en-US
- TESLA_SCRAPER_GEOIP=true | false | <target-ip>
- TESLA_SCRAPER_PROXY_SERVER=http://host:port
- TESLA_SCRAPER_PROXY_USERNAME=...
- TESLA_SCRAPER_PROXY_PASSWORD=...
- TESLA_SCRAPER_HEADLESS=true | false
- TESLA_SCRAPER_DEBUG=true | false
- TESLA_SCRAPER_BLOCK_IMAGES=true | false
- TESLA_SCRAPER_MAX_SCROLLS=10
- TESLA_SCRAPER_TIMEOUT_MS=45000
- TESLA_SCRAPER_SCROLL_WAIT_MS=2500
"""
from __future__ import annotations

import json
import os
import re
from typing import Any

TESLA_CAREERS_URL = (
    "https://www.tesla.com/en_US/careers/search#/?keyword=intern&department=&region=5&site=&lang=en_US"
)
TESLA_JOB_BASE = "https://www.tesla.com"
JOB_TITLE_KEYS = ("title", "jobTitle", "name", "text")
JOB_ID_KEYS = ("id", "jobId", "requisitionId", "jobReqId", "reqId")
JOB_URL_KEYS = ("url", "link", "applyUrl", "jobUrl", "absolute_url")
JOB_META_KEYS = (
    "location",
    "jobLocation",
    "city",
    "locationsText",
    "department",
    "team",
    "category",
    "employmentType",
    "type",
    "timeType",
)
LOAD_MORE_SELECTORS = (
    "button:has-text('Load More')",
    "button:has-text('Show More')",
    "button[aria-label*='Load']",
    "button[aria-label*='More']",
    "[data-qa='load-more']",
)


def fetch_tesla_jobs() -> list[dict[str, Any]]:
    try:
        from camoufox.sync_api import Camoufox
    except ImportError as exc:
        raise RuntimeError(
            "camoufox is not installed. Run: pip install camoufox && python3 -m camoufox fetch"
        ) from exc

    settings = _tesla_scraper_settings()
    diagnostics = {
        "json_response_urls": [],
        "candidate_response_urls": [],
        "response_errors": [],
        "page_errors": [],
        "clicked_load_more": 0,
        "scroll_rounds": 0,
    }
    captured_jobs: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    try:
        with Camoufox(**_camoufox_options(settings)) as browser:
            page = browser.new_page()
            page.set_default_timeout(settings["timeout_ms"])
            page.on(
                "pageerror",
                lambda error: _record_diagnostic(diagnostics["page_errors"], str(error)),
            )

            def on_response(response: Any) -> None:
                try:
                    url = response.url
                    if response.status != 200 or "tesla.com" not in url:
                        return

                    content_type = (response.headers.get("content-type") or "").lower()
                    looks_interesting = _is_interesting_tesla_response(url, content_type)
                    if not looks_interesting:
                        return

                    _record_diagnostic(diagnostics["candidate_response_urls"], url)
                    payload = _parse_response_payload(response)
                    jobs = _extract_jobs_from_response(payload)
                    if jobs:
                        _record_diagnostic(diagnostics["json_response_urls"], url)
                        _extend_unique_jobs(captured_jobs, jobs, seen_keys)
                except Exception as exc:  # pragma: no cover - best-effort diagnostics
                    _record_diagnostic(
                        diagnostics["response_errors"],
                        f"{type(exc).__name__}: {exc}",
                    )

            page.on("response", on_response)

            try:
                page.goto(TESLA_CAREERS_URL, wait_until="domcontentloaded", timeout=settings["timeout_ms"])
                page.wait_for_timeout(settings["initial_wait_ms"])
                _drain_tesla_results(page, captured_jobs, seen_keys, diagnostics, settings)
            except Exception as exc:
                raise RuntimeError(
                    "Tesla page load failed. "
                    f"{_diagnostics_summary(diagnostics, settings)}. Underlying error: {exc}"
                ) from exc

            if not captured_jobs:
                _extend_unique_jobs(captured_jobs, _scrape_dom(page), seen_keys)

            page.close()
    except RuntimeError:
        raise
    except Exception as exc:
        raise RuntimeError(
            "Tesla browser session failed before listings could be parsed. "
            f"{_diagnostics_summary(diagnostics, settings)}. Underlying error: {type(exc).__name__}: {exc}"
        ) from exc

    if not captured_jobs:
        raise RuntimeError(
            "Tesla careers page loaded but no job listings were found. "
            f"{_diagnostics_summary(diagnostics, settings)}. "
            "This usually means Tesla blocked the session or changed the page/API shape."
        )

    return captured_jobs


def _tesla_scraper_settings() -> dict[str, Any]:
    return {
        "locale": os.getenv("TESLA_SCRAPER_LOCALE", "en-US"),
        "geoip": _env_geoip("TESLA_SCRAPER_GEOIP"),
        "proxy": _env_proxy(),
        "headless": _env_bool("TESLA_SCRAPER_HEADLESS", True),
        "debug": _env_bool("TESLA_SCRAPER_DEBUG", False),
        "block_images": _env_bool("TESLA_SCRAPER_BLOCK_IMAGES", False),
        "max_scrolls": _env_int("TESLA_SCRAPER_MAX_SCROLLS", 8),
        "timeout_ms": _env_int("TESLA_SCRAPER_TIMEOUT_MS", 45_000),
        "initial_wait_ms": _env_int("TESLA_SCRAPER_INITIAL_WAIT_MS", 6_000),
        "scroll_wait_ms": _env_int("TESLA_SCRAPER_SCROLL_WAIT_MS", 2_500),
    }


def _camoufox_options(settings: dict[str, Any]) -> dict[str, Any]:
    options: dict[str, Any] = {
        "headless": settings["headless"],
        "os": "macos",
        "locale": settings["locale"],
        "block_images": settings["block_images"],
        "enable_cache": True,
        "humanize": 0.8,
        "debug": settings["debug"],
    }
    if settings["proxy"]:
        options["proxy"] = settings["proxy"]
    if settings["geoip"] is not None:
        options["geoip"] = settings["geoip"]
    return options


def _drain_tesla_results(
    page: Any,
    captured_jobs: list[dict[str, Any]],
    seen_keys: set[str],
    diagnostics: dict[str, list[str] | int],
    settings: dict[str, Any],
) -> None:
    stable_rounds = 0
    previous_count = len(seen_keys)

    for _ in range(max(1, settings["max_scrolls"])):
        diagnostics["scroll_rounds"] = int(diagnostics["scroll_rounds"]) + 1
        clicked = _click_load_more(page)
        if clicked:
            diagnostics["clicked_load_more"] = int(diagnostics["clicked_load_more"]) + 1

        page.evaluate(
            """
            () => {
              window.scrollTo(0, document.body.scrollHeight);
            }
            """
        )
        page.wait_for_timeout(settings["scroll_wait_ms"])

        if not captured_jobs:
            _extend_unique_jobs(captured_jobs, _scrape_dom(page), seen_keys)

        current_count = len(seen_keys)
        if current_count == previous_count and not clicked:
            stable_rounds += 1
        else:
            stable_rounds = 0
        previous_count = current_count

        if stable_rounds >= 2:
            break


def _click_load_more(page: Any) -> bool:
    for selector in LOAD_MORE_SELECTORS:
        try:
            button = page.locator(selector).first
            if button.count() and button.is_visible():
                button.click(timeout=1_500)
                return True
        except Exception:
            continue
    return False


def _is_interesting_tesla_response(url: str, content_type: str) -> bool:
    lower_url = url.lower()
    if "tesla.com" not in lower_url:
        return False
    return any(
        token in lower_url
        for token in ("careers", "jobs", "search", "graphql", "api", "posting", "position")
    ) and any(token in content_type for token in ("json", "javascript", "plain"))


def _parse_response_payload(response: Any) -> Any:
    text = response.text()
    if not text:
        return None
    return json.loads(text)


def _extract_jobs_from_response(data: Any) -> list[dict[str, Any]]:
    """Recursively extract likely Tesla job dicts from unknown JSON payload shapes."""
    matches: list[dict[str, Any]] = []
    seen_nodes: set[int] = set()

    def walk(node: Any) -> None:
        if isinstance(node, (dict, list)):
            node_id = id(node)
            if node_id in seen_nodes:
                return
            seen_nodes.add(node_id)

        if isinstance(node, dict):
            if _looks_like_job_dict(node):
                matches.append(node)
                return
            for value in node.values():
                walk(value)
            return

        if isinstance(node, list):
            if node and all(isinstance(item, dict) and _looks_like_job_dict(item) for item in node):
                matches.extend(node)
                return
            for item in node:
                walk(item)

    walk(data)

    deduped: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    for job in matches:
        key = _job_dedupe_key(job)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(job)
    return deduped


def _looks_like_job_dict(data: dict[str, Any]) -> bool:
    title = _first_nonempty(data, JOB_TITLE_KEYS)
    if not title or len(title) < 4:
        return False

    score = 0
    if _first_nonempty(data, JOB_ID_KEYS):
        score += 1
    if _first_nonempty(data, JOB_URL_KEYS):
        score += 1
    if _first_nonempty(data, JOB_META_KEYS):
        score += 1
    if "intern" in title.lower() or "co-op" in title.lower() or "coop" in title.lower():
        score += 1

    return score >= 1


def _extend_unique_jobs(
    target: list[dict[str, Any]],
    jobs: list[dict[str, Any]],
    seen_keys: set[str],
) -> None:
    for job in jobs:
        key = _job_dedupe_key(job)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        target.append(job)


def _job_dedupe_key(job: dict[str, Any]) -> str:
    key = _first_nonempty(job, JOB_ID_KEYS)
    if key:
        return f"id:{str(key).strip().lower()}"
    url = _first_nonempty(job, JOB_URL_KEYS)
    if url:
        return f"url:{str(url).strip().lower()}"
    title = _first_nonempty(job, JOB_TITLE_KEYS)
    location = _first_nonempty(job, ("location", "jobLocation", "city", "locationsText"))
    return f"title:{str(title).strip().lower()}|loc:{str(location).strip().lower()}"


def _scrape_dom(page: Any) -> list[dict[str, Any]]:
    """Fall back: scrape links/cards directly from the rendered DOM."""
    try:
        results = page.evaluate(
            """
            () => {
              const anchors = Array.from(document.querySelectorAll("a[href*='/careers/']"));
              const rows = [];
              for (const anchor of anchors) {
                const href = anchor.getAttribute('href') || '';
                if (!/\\/careers\\/(search\\/job|job)/i.test(href)) continue;
                const card =
                  anchor.closest("[data-qa='job-card'], article, li, section, div") || anchor;
                const text = (card.innerText || anchor.innerText || '').trim();
                if (!text) continue;
                const lines = text
                  .split("\\n")
                  .map((line) => line.trim())
                  .filter(Boolean);
                rows.push({
                  title: lines[0] || anchor.innerText || '',
                  location: lines.slice(1).find((line) =>
                    /(remote|,|california|texas|nevada|new york|austin|fremont|palo alto|buffalo|reno|usa|united states)/i.test(line)
                  ) || '',
                  url: href,
                  source: 'dom',
                });
              }
              return rows;
            }
            """
        )
    except Exception:
        results = []

    if not isinstance(results, list):
        return []

    normalized_results: list[dict[str, Any]] = []
    for row in results:
        if not isinstance(row, dict):
            continue
        title = str(row.get("title") or "").strip()
        if not title:
            continue
        url = str(row.get("url") or "").strip()
        if url and not url.startswith("http"):
            url = TESLA_JOB_BASE + url
        normalized_results.append(
            {
                "title": title,
                "location": str(row.get("location") or "").strip(),
                "url": url,
                "source": "dom",
            }
        )
    return normalized_results


def _first_nonempty(data: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        value = data.get(key)
        if isinstance(value, str):
            if value.strip():
                return value
        elif value not in (None, "", [], {}):
            return value
    return None


def _record_diagnostic(bucket: list[str], value: str, limit: int = 6) -> None:
    if value and value not in bucket and len(bucket) < limit:
        bucket.append(value)


def _diagnostics_summary(diagnostics: dict[str, list[str] | int], settings: dict[str, Any]) -> str:
    proxy = settings["proxy"]
    proxy_label = proxy.get("server") if isinstance(proxy, dict) and proxy.get("server") else "none"
    pieces = [
        f"locale={settings['locale']}",
        f"geoip={'on' if settings['geoip'] else 'off'}",
        f"proxy={proxy_label}",
        f"scrolls={diagnostics['scroll_rounds']}",
        f"loadMoreClicks={diagnostics['clicked_load_more']}",
    ]
    if diagnostics["json_response_urls"]:
        pieces.append(
            "jsonResponses=" + ", ".join(str(url) for url in diagnostics["json_response_urls"])
        )
    elif diagnostics["candidate_response_urls"]:
        pieces.append(
            "candidateResponses=" + ", ".join(str(url) for url in diagnostics["candidate_response_urls"])
        )
    if diagnostics["page_errors"]:
        pieces.append("pageErrors=" + " | ".join(str(error) for error in diagnostics["page_errors"]))
    if diagnostics["response_errors"]:
        pieces.append(
            "responseErrors=" + " | ".join(str(error) for error in diagnostics["response_errors"])
        )
    return "; ".join(pieces)


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value.strip())
    except ValueError:
        return default


def _env_geoip(name: str) -> str | bool | None:
    value = os.getenv(name)
    if value is None or not value.strip():
        return None
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on", "auto"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return None
    return value.strip()


def _env_proxy() -> dict[str, str] | None:
    server = os.getenv("TESLA_SCRAPER_PROXY_SERVER", "").strip()
    if not server:
        return None
    proxy = {"server": server}
    username = os.getenv("TESLA_SCRAPER_PROXY_USERNAME", "").strip()
    password = os.getenv("TESLA_SCRAPER_PROXY_PASSWORD", "").strip()
    if username:
        proxy["username"] = username
    if password:
        proxy["password"] = password
    return proxy


def normalize_tesla_jobs(raw_jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Normalize raw Tesla job dicts into the standard internship posting shape."""
    normalized = []
    seen: set[str] = set()

    for job in raw_jobs:
        title = str(job.get("title") or job.get("jobTitle") or job.get("name") or "").strip()
        if not title:
            continue

        location = str(
            job.get("location")
            or job.get("jobLocation")
            or job.get("city")
            or job.get("locationsText")
            or ""
        ).strip()

        url = str(job.get("url") or job.get("link") or job.get("applyUrl") or job.get("jobUrl") or "").strip()
        if url and not url.startswith("http"):
            url = TESLA_JOB_BASE + url
        if not url:
            url = "https://www.tesla.com/careers/search"

        external_id = str(
            job.get("id")
            or job.get("jobId")
            or job.get("requisitionId")
            or job.get("jobReqId")
            or job.get("reqId")
            or re.sub(r"\W+", "-", title.lower())[:80]
        ).strip()

        employment_type = str(job.get("employmentType") or job.get("type") or job.get("timeType") or "").strip()
        team = str(job.get("department") or job.get("team") or job.get("category") or "").strip()
        description = str(job.get("description") or job.get("jobDescription") or "").strip()
        published = str(job.get("postedDate") or job.get("startDate") or job.get("datePosted") or "").strip() or None

        dedup_key = external_id or title
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        from personal_api.services.internships import _is_internship_job

        normalized.append(
            {
                "external_id": external_id,
                "title": title,
                "location": location,
                "team": team,
                "employment_type": employment_type,
                "url": url,
                "description_text": description,
                "first_published_at": published,
                "updated_at_remote": None,
                "is_internship": _is_internship_job(title, employment_type),
            }
        )

    return normalized

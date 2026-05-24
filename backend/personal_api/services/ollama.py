import html
import httpx

OLLAMA_BASE = "http://localhost:11434"
SUMMARY_MODEL = "llama3.2:3b"

SUMMARY_PROMPT = """\
Summarize this internship job posting in about 300 characters. \
Focus on what the intern will actually work on — team, tech, and core tasks. \
Be specific and direct. Output only the summary, nothing else.

POSTING:
{text}
"""


def _clean(text: str) -> str:
    return html.unescape(text).strip()


def generate_posting_summary(description: str) -> str:
    cleaned = _clean(description)[:6000]
    try:
        with httpx.Client(timeout=45) as client:
            resp = client.post(
                f"{OLLAMA_BASE}/api/generate",
                json={"model": SUMMARY_MODEL, "prompt": SUMMARY_PROMPT.format(text=cleaned), "stream": False},
            )
            resp.raise_for_status()
            return resp.json().get("response", "").strip()
    except Exception:
        return ""

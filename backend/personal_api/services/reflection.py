from __future__ import annotations

import sqlite3
from typing import Any


def reflection_payload(conn: sqlite3.Connection) -> dict[str, Any]:
    rows = conn.execute(
        """
        SELECT id, item_type, text_value, attribution, media_url, sort_order
        FROM reflection_items
        ORDER BY item_type ASC, sort_order ASC, id ASC
        """
    ).fetchall()

    quotes: list[dict[str, Any]] = []
    prompts: list[dict[str, Any]] = []
    questions: list[dict[str, Any]] = []
    videos: list[dict[str, Any]] = []

    for row in rows:
        if row["item_type"] == "quote":
            quotes.append(
                {
                    "id": row["id"],
                    "text": row["text_value"],
                    "author": row["attribution"],
                }
            )
        elif row["item_type"] == "prompt":
            prompts.append(
                {
                    "id": row["id"],
                    "text": row["text_value"],
                }
            )
        elif row["item_type"] == "question":
            questions.append(
                {
                    "id": row["id"],
                    "text": row["text_value"],
                }
            )
        elif row["item_type"] == "video":
            videos.append(
                {
                    "id": row["id"],
                    "title": row["text_value"],
                    "url": row["media_url"],
                }
            )

    return {
        "quotes": quotes,
        "prompts": prompts,
        "questions": questions,
        "videos": videos,
    }

from __future__ import annotations

import json
import sqlite3
from datetime import date as dt_date
from typing import Any

from ..schemas import NetworkingContactCreate, NetworkingContactUpdate, PotentialConnectUpdate


def list_contacts(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, name, company, role, tags_json, email, phone, linkedin,
               location_city, location_region, notes, last_contact_date,
               next_follow_up_date, how_we_met, next_action, follow_up_type,
               created_at, updated_at
        FROM networking_contacts
        ORDER BY updated_at DESC, id DESC
        """
    ).fetchall()
    return [contact_payload(conn, row["id"]) for row in rows]


def create_contact(conn: sqlite3.Connection, payload: NetworkingContactCreate) -> dict[str, Any]:
    cursor = conn.execute(
        """
        INSERT INTO networking_contacts(
            name, company, role, tags_json, email, phone, linkedin,
            location_city, location_region, notes, last_contact_date,
            next_follow_up_date, how_we_met, next_action, follow_up_type
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.name.strip(),
            payload.company.strip(),
            payload.role.strip(),
            json.dumps(_clean_tags(payload.tags)),
            payload.email.strip(),
            payload.phone.strip(),
            payload.linkedin.strip(),
            payload.location.city.strip(),
            payload.location.region.strip(),
            payload.notes.strip(),
            payload.last_contact_date.isoformat(),
            payload.next_follow_up_date.isoformat() if payload.next_follow_up_date else None,
            payload.how_we_met.strip(),
            payload.next_action.strip(),
            payload.follow_up_type.strip() if payload.follow_up_type else None,
        ),
    )
    _replace_interactions(conn, cursor.lastrowid, payload.interactions)
    _sync_potential_connects_from_contact(
        conn,
        old_name=payload.name,
        old_company=payload.company,
        old_linkedin=payload.linkedin,
        name=payload.name,
        company=payload.company,
        role=payload.role,
        linkedin=payload.linkedin,
    )
    return contact_payload(conn, cursor.lastrowid)


def update_contact(
    conn: sqlite3.Connection, contact_id: int, payload: NetworkingContactUpdate
) -> dict[str, Any] | None:
    current = conn.execute(
        """
        SELECT id, name, company, role, tags_json, email, phone, linkedin,
               location_city, location_region, notes, last_contact_date,
               next_follow_up_date, how_we_met, next_action, follow_up_type
        FROM networking_contacts
        WHERE id = ?
        """,
        (contact_id,),
    ).fetchone()
    if not current:
        return None

    provided_fields = payload.model_fields_set

    next_tags = (
        json.dumps(_clean_tags(payload.tags))
        if payload.tags is not None
        else current["tags_json"]
    )
    next_location = payload.location or {
        "city": current["location_city"],
        "region": current["location_region"],
    }

    conn.execute(
        """
        UPDATE networking_contacts
        SET name = ?,
            company = ?,
            role = ?,
            tags_json = ?,
            email = ?,
            phone = ?,
            linkedin = ?,
            location_city = ?,
            location_region = ?,
            notes = ?,
            last_contact_date = ?,
            next_follow_up_date = ?,
            how_we_met = ?,
            next_action = ?,
            follow_up_type = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            payload.name.strip() if payload.name is not None else current["name"],
            payload.company.strip() if payload.company is not None else current["company"],
            payload.role.strip() if payload.role is not None else current["role"],
            next_tags,
            payload.email.strip() if payload.email is not None else current["email"],
            payload.phone.strip() if payload.phone is not None else current["phone"],
            payload.linkedin.strip() if payload.linkedin is not None else current["linkedin"],
            next_location.city.strip() if hasattr(next_location, "city") else str(next_location["city"]).strip(),
            next_location.region.strip() if hasattr(next_location, "region") else str(next_location["region"]).strip(),
            payload.notes.strip() if payload.notes is not None else current["notes"],
            payload.last_contact_date.isoformat()
            if payload.last_contact_date is not None
            else current["last_contact_date"],
            (
                payload.next_follow_up_date.isoformat()
                if payload.next_follow_up_date is not None
                else None
            )
            if "next_follow_up_date" in provided_fields
            else current["next_follow_up_date"],
            payload.how_we_met.strip() if payload.how_we_met is not None else current["how_we_met"],
            payload.next_action.strip() if payload.next_action is not None else current["next_action"],
            (
                payload.follow_up_type.strip() if payload.follow_up_type else None
            )
            if "follow_up_type" in provided_fields
            else current["follow_up_type"],
            contact_id,
        ),
    )

    if payload.interactions is not None:
        _replace_interactions(conn, contact_id, payload.interactions)

    _sync_potential_connects_from_contact(
        conn,
        old_name=current["name"],
        old_company=current["company"],
        old_linkedin=current["linkedin"],
        name=payload.name.strip() if payload.name is not None else current["name"],
        company=payload.company.strip() if payload.company is not None else current["company"],
        role=payload.role.strip() if payload.role is not None else current["role"],
        linkedin=payload.linkedin.strip() if payload.linkedin is not None else current["linkedin"],
    )

    return contact_payload(conn, contact_id)


def delete_contact(conn: sqlite3.Connection, contact_id: int) -> bool:
    deleted = conn.execute("DELETE FROM networking_contacts WHERE id = ?", (contact_id,))
    return deleted.rowcount > 0


def contact_payload(conn: sqlite3.Connection, contact_id: int) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT id, name, company, role, tags_json, email, phone, linkedin,
               location_city, location_region, notes, last_contact_date,
               next_follow_up_date, how_we_met, next_action, follow_up_type,
               created_at, updated_at
        FROM networking_contacts
        WHERE id = ?
        """,
        (contact_id,),
    ).fetchone()
    interactions = conn.execute(
        """
        SELECT id, interaction_date, interaction_type, summary
        FROM networking_interactions
        WHERE contact_id = ?
        ORDER BY interaction_date DESC, id DESC
        """,
        (contact_id,),
    ).fetchall()

    return {
        "id": row["id"],
        "name": row["name"],
        "company": row["company"],
        "role": row["role"],
        "tags": json.loads(row["tags_json"] or "[]"),
        "email": row["email"],
        "phone": row["phone"],
        "linkedin": row["linkedin"],
        "location": {
            "city": row["location_city"],
            "region": row["location_region"],
        },
        "notes": row["notes"],
        "lastContactDate": row["last_contact_date"],
        "nextFollowUpDate": row["next_follow_up_date"] or "",
        "howWeMet": row["how_we_met"],
        "nextAction": row["next_action"],
        "followUpType": row["follow_up_type"] or "",
        "isOverdue": bool(
            row["next_follow_up_date"]
            and conn.execute(
                "SELECT DATE(?) < DATE('now', 'localtime') AS overdue",
                (row["next_follow_up_date"],),
            ).fetchone()["overdue"]
        ),
        "interactions": [
            {
                "id": interaction["id"],
                "date": interaction["interaction_date"],
                "type": interaction["interaction_type"],
                "summary": interaction["summary"],
            }
            for interaction in interactions
        ],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _replace_interactions(
    conn: sqlite3.Connection, contact_id: int, interactions: list[Any]
) -> None:
    conn.execute("DELETE FROM networking_interactions WHERE contact_id = ?", (contact_id,))
    for interaction in interactions:
        conn.execute(
            """
            INSERT INTO networking_interactions(contact_id, interaction_date, interaction_type, summary)
            VALUES(?, ?, ?, ?)
            """,
            (
                contact_id,
                interaction.date.isoformat(),
                interaction.type.strip(),
                interaction.summary.strip(),
            ),
        )


def _clean_tags(tags: list[str]) -> list[str]:
    return [tag.strip() for tag in tags if tag.strip()]


def _sync_potential_connects_from_contact(
    conn: sqlite3.Connection,
    *,
    old_name: str,
    old_company: str,
    old_linkedin: str,
    name: str,
    company: str,
    role: str,
    linkedin: str,
) -> None:
    cleaned_name = name.strip()
    cleaned_company = company.strip()
    cleaned_role = role.strip()
    cleaned_linkedin = linkedin.strip()
    previous_linkedin = old_linkedin.strip()
    previous_name = old_name.strip()
    previous_company = old_company.strip()

    conditions: list[str] = []
    params: list[str] = []
    linkedin_candidates: list[str] = []

    for candidate in (previous_linkedin, cleaned_linkedin):
        if candidate and candidate not in linkedin_candidates:
            linkedin_candidates.append(candidate)

    if linkedin_candidates:
        placeholders = ", ".join("?" for _ in linkedin_candidates)
        conditions.append(f"linkedin IN ({placeholders})")
        params.extend(linkedin_candidates)

    if previous_name and previous_company:
        conditions.append("(linkedin = '' AND name = ? AND company = ?)")
        params.extend([previous_name, previous_company])

    if not conditions:
        return

    conn.execute(
        f"""
        UPDATE potential_connects
        SET name = ?,
            company = ?,
            role = ?,
            linkedin = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE {" OR ".join(conditions)}
        """,
        (
            cleaned_name,
            cleaned_company,
            cleaned_role,
            cleaned_linkedin,
            *params,
        ),
    )


def _sync_contacts_from_potential_connect(
    conn: sqlite3.Connection,
    *,
    old_name: str,
    old_company: str,
    old_linkedin: str,
    company: str,
) -> None:
    cleaned_company = company.strip()
    previous_linkedin = old_linkedin.strip()
    previous_name = old_name.strip()
    previous_company = old_company.strip()

    conditions: list[str] = []
    params: list[str] = []

    if previous_linkedin:
        conditions.append("linkedin = ?")
        params.append(previous_linkedin)

    if previous_name and previous_company:
        conditions.append("(linkedin = '' AND name = ? AND company = ?)")
        params.extend([previous_name, previous_company])

    if not conditions:
        return

    conn.execute(
        f"""
        UPDATE networking_contacts
        SET company = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE {" OR ".join(conditions)}
        """,
        (
            cleaned_company,
            *params,
        ),
    )


def list_potential_connects(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, name, company, role, linkedin, focus_area, connection_request,
               outreach_type, status, date_added, date_sent, notes,
               created_at, updated_at
        FROM potential_connects
        ORDER BY date_added DESC, id DESC
        """
    ).fetchall()
    return [potential_connect_payload(row) for row in rows]


def update_potential_connect(
    conn: sqlite3.Connection, connect_id: int, payload: PotentialConnectUpdate
) -> dict[str, Any] | None:
    current = conn.execute(
        """
        SELECT id, name, company, role, linkedin, focus_area, connection_request,
               outreach_type, status, date_added, date_sent, notes,
               created_at, updated_at
        FROM potential_connects
        WHERE id = ?
        """,
        (connect_id,),
    ).fetchone()
    if not current:
        return None

    provided_fields = payload.model_fields_set
    next_status = payload.status.strip() if payload.status is not None else current["status"]
    next_date_sent = (
        payload.date_sent.isoformat()
        if payload.date_sent is not None
        else dt_date.today().isoformat()
        if payload.status == "sent" and "date_sent" not in provided_fields and not current["date_sent"]
        else None
    ) if ("date_sent" in provided_fields or payload.status == "sent") else current["date_sent"]

    conn.execute(
        """
        UPDATE potential_connects
        SET company = ?,
            connection_request = ?,
            status = ?,
            date_sent = ?,
            notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            payload.company.strip() if payload.company is not None else current["company"],
            payload.connection_request.strip()
            if payload.connection_request is not None
            else current["connection_request"],
            next_status,
            next_date_sent,
            payload.notes.strip() if payload.notes is not None else current["notes"],
            connect_id,
        ),
    )
    _sync_contacts_from_potential_connect(
        conn,
        old_name=current["name"],
        old_company=current["company"],
        old_linkedin=current["linkedin"],
        company=payload.company.strip() if payload.company is not None else current["company"],
    )
    updated = conn.execute(
        """
        SELECT id, name, company, role, linkedin, focus_area, connection_request,
               outreach_type, status, date_added, date_sent, notes,
               created_at, updated_at
        FROM potential_connects
        WHERE id = ?
        """,
        (connect_id,),
    ).fetchone()
    return potential_connect_payload(updated)


def potential_connect_payload(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "company": row["company"],
        "role": row["role"],
        "linkedin": row["linkedin"],
        "focusArea": row["focus_area"],
        "connectionRequest": row["connection_request"],
        "outreachType": row["outreach_type"],
        "status": row["status"],
        "dateAdded": row["date_added"],
        "dateSent": row["date_sent"],
        "notes": row["notes"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }

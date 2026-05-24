from __future__ import annotations

import calendar
import sqlite3
from datetime import date as dt_date
from typing import Any

from fastapi import HTTPException

from ..schemas import (
    FinanceCategoryCreate,
    FinanceCategoryReorder,
    FinanceCategoryUpdate,
    FinanceExpenseCreate,
    FinanceExpenseUpdate,
    FinanceSubscriptionCreate,
    FinanceSubscriptionUpdate,
    FinanceWishlistItemCreate,
    FinanceWishlistItemUpdate,
)


def finance_payload(conn: sqlite3.Connection, month: str | None) -> dict[str, Any]:
    month_start = _parse_month(month)
    month_end = _next_month(month_start)
    categories = list_categories(conn)
    manual_expenses = conn.execute(
        """
        SELECT e.id, e.name, e.amount_cents, e.expense_date, e.created_at, e.updated_at,
               c.id AS category_id, c.name AS category_name
        FROM finance_expenses e
        JOIN finance_categories c ON c.id = e.category_id
        WHERE e.expense_date >= ? AND e.expense_date < ?
        ORDER BY e.expense_date DESC, e.id DESC
        """,
        (month_start.isoformat(), month_end.isoformat()),
    ).fetchall()
    subscriptions = list_subscriptions(conn)
    subscription_expenses = [
        subscription_occurrence_payload(subscription, occurrence_date)
        for subscription in subscriptions
        for occurrence_date in [_subscription_occurrence_for_month(subscription, month_start)]
        if occurrence_date is not None
    ]

    expenses = [expense_payload(row) for row in manual_expenses] + subscription_expenses
    expenses.sort(
        key=lambda expense: (expense["date"], expense["source"] == "manual", expense["id"]),
        reverse=True,
    )

    return {
        "month": month_start.strftime("%Y-%m"),
        "categories": categories,
        "expenses": expenses,
        "subscriptions": subscriptions,
        "wishlist": list_wishlist_items(conn),
    }


def list_categories(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT id, name, sort_order FROM finance_categories ORDER BY sort_order ASC, id ASC"
    ).fetchall()
    return [dict(row) for row in rows]


def create_category(
    conn: sqlite3.Connection, payload: FinanceCategoryCreate
) -> dict[str, Any]:
    next_sort_order = (
        conn.execute("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM finance_categories")
        .fetchone()["next_order"]
    )
    cursor = conn.execute(
        "INSERT INTO finance_categories(name, sort_order) VALUES(?, ?)",
        (payload.name.strip(), next_sort_order),
    )
    row = conn.execute(
        "SELECT id, name, sort_order FROM finance_categories WHERE id = ?",
        (cursor.lastrowid,),
    ).fetchone()
    return dict(row)


def update_category(
    conn: sqlite3.Connection, category_id: int, payload: FinanceCategoryUpdate
) -> dict[str, Any] | None:
    updated = conn.execute(
        "UPDATE finance_categories SET name = ? WHERE id = ?",
        (payload.name.strip(), category_id),
    )
    if updated.rowcount == 0:
        return None
    row = conn.execute(
        "SELECT id, name, sort_order FROM finance_categories WHERE id = ?", (category_id,)
    ).fetchone()
    return dict(row)


def reorder_categories(
    conn: sqlite3.Connection, payload: FinanceCategoryReorder
) -> list[dict[str, Any]]:
    current_ids = [
        row["id"]
        for row in conn.execute("SELECT id FROM finance_categories ORDER BY sort_order ASC, id ASC").fetchall()
    ]
    requested_ids = payload.category_ids
    if sorted(current_ids) != sorted(requested_ids):
        raise HTTPException(status_code=400, detail="Category reorder payload is invalid.")

    for index, category_id in enumerate(requested_ids, start=1):
        conn.execute(
            "UPDATE finance_categories SET sort_order = ? WHERE id = ?",
            (index, category_id),
        )

    return list_categories(conn)


def delete_category(conn: sqlite3.Connection, category_id: int) -> bool:
    expense_count = conn.execute(
        "SELECT COUNT(*) AS count FROM finance_expenses WHERE category_id = ?",
        (category_id,),
    ).fetchone()["count"]
    subscription_count = conn.execute(
        "SELECT COUNT(*) AS count FROM finance_subscriptions WHERE category_id = ?",
        (category_id,),
    ).fetchone()["count"]
    if expense_count or subscription_count:
        raise HTTPException(
            status_code=400,
            detail="Category is in use by one or more finance entries.",
        )

    deleted = conn.execute("DELETE FROM finance_categories WHERE id = ?", (category_id,))
    return deleted.rowcount > 0


def create_expense(conn: sqlite3.Connection, payload: FinanceExpenseCreate) -> dict[str, Any]:
    _require_category(conn, payload.category_id)
    cursor = conn.execute(
        """
        INSERT INTO finance_expenses(name, category_id, amount_cents, expense_date)
        VALUES(?, ?, ?, ?)
        """,
        (
            payload.name.strip(),
            payload.category_id,
            _to_cents(payload.amount),
            payload.date.isoformat(),
        ),
    )
    row = _manual_expense_row(conn, cursor.lastrowid)
    return expense_payload(row)


def update_expense(
    conn: sqlite3.Connection, expense_id: int, payload: FinanceExpenseUpdate
) -> dict[str, Any] | None:
    current = conn.execute(
        """
        SELECT id, name, category_id, amount_cents, expense_date
        FROM finance_expenses
        WHERE id = ?
        """,
        (expense_id,),
    ).fetchone()
    if not current:
        return None

    next_category_id = (
        payload.category_id if payload.category_id is not None else current["category_id"]
    )
    _require_category(conn, next_category_id)

    conn.execute(
        """
        UPDATE finance_expenses
        SET name = ?,
            category_id = ?,
            amount_cents = ?,
            expense_date = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            payload.name.strip() if payload.name is not None else current["name"],
            next_category_id,
            _to_cents(payload.amount)
            if payload.amount is not None
            else current["amount_cents"],
            payload.date.isoformat() if payload.date is not None else current["expense_date"],
            expense_id,
        ),
    )

    return expense_payload(_manual_expense_row(conn, expense_id))


def delete_expense(conn: sqlite3.Connection, expense_id: int) -> bool:
    deleted = conn.execute("DELETE FROM finance_expenses WHERE id = ?", (expense_id,))
    return deleted.rowcount > 0


def list_subscriptions(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT s.id, s.name, s.amount_cents, s.billing_day, s.start_date, s.end_date,
               s.created_at, s.updated_at, c.id AS category_id, c.name AS category_name
        FROM finance_subscriptions s
        JOIN finance_categories c ON c.id = s.category_id
        ORDER BY (s.end_date IS NULL) DESC, s.name COLLATE NOCASE, s.id DESC
        """
    ).fetchall()
    return [subscription_payload(row) for row in rows]


def create_subscription(
    conn: sqlite3.Connection, payload: FinanceSubscriptionCreate
) -> dict[str, Any]:
    _require_category(conn, payload.category_id)
    cursor = conn.execute(
        """
        INSERT INTO finance_subscriptions(
            name, category_id, amount_cents, billing_day, start_date
        )
        VALUES(?, ?, ?, ?, ?)
        """,
        (
            payload.name.strip(),
            payload.category_id,
            _to_cents(payload.amount),
            payload.billing_day,
            payload.start_date.isoformat(),
        ),
    )
    row = _subscription_row(conn, cursor.lastrowid)
    return subscription_payload(row)


def update_subscription(
    conn: sqlite3.Connection, subscription_id: int, payload: FinanceSubscriptionUpdate
) -> dict[str, Any] | None:
    current = conn.execute(
        """
        SELECT id, name, category_id, amount_cents, billing_day, start_date, end_date
        FROM finance_subscriptions
        WHERE id = ?
        """,
        (subscription_id,),
    ).fetchone()
    if not current:
        return None

    next_category_id = (
        payload.category_id if payload.category_id is not None else current["category_id"]
    )
    _require_category(conn, next_category_id)

    conn.execute(
        """
        UPDATE finance_subscriptions
        SET name = ?,
            category_id = ?,
            amount_cents = ?,
            billing_day = ?,
            start_date = ?,
            end_date = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            payload.name.strip() if payload.name is not None else current["name"],
            next_category_id,
            _to_cents(payload.amount)
            if payload.amount is not None
            else current["amount_cents"],
            payload.billing_day if payload.billing_day is not None else current["billing_day"],
            payload.start_date.isoformat()
            if payload.start_date is not None
            else current["start_date"],
            payload.end_date.isoformat() if payload.end_date is not None else current["end_date"],
            subscription_id,
        ),
    )
    return subscription_payload(_subscription_row(conn, subscription_id))


def delete_subscription(conn: sqlite3.Connection, subscription_id: int) -> bool:
    deleted = conn.execute(
        "DELETE FROM finance_subscriptions WHERE id = ?", (subscription_id,)
    )
    return deleted.rowcount > 0


def list_wishlist_items(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT id, name, link, price_cents, created_at, updated_at
        FROM finance_wishlist_items
        ORDER BY created_at DESC, id DESC
        """
    ).fetchall()
    return [wishlist_item_payload(row) for row in rows]


def create_wishlist_item(
    conn: sqlite3.Connection, payload: FinanceWishlistItemCreate
) -> dict[str, Any]:
    cursor = conn.execute(
        """
        INSERT INTO finance_wishlist_items(name, link, price_cents)
        VALUES(?, ?, ?)
        """,
        (
            payload.name.strip(),
            payload.link.strip(),
            _to_cents(payload.price),
        ),
    )
    return wishlist_item_payload(_wishlist_item_row(conn, cursor.lastrowid))


def update_wishlist_item(
    conn: sqlite3.Connection, wishlist_item_id: int, payload: FinanceWishlistItemUpdate
) -> dict[str, Any] | None:
    current = conn.execute(
        """
        SELECT id, name, link, price_cents
        FROM finance_wishlist_items
        WHERE id = ?
        """,
        (wishlist_item_id,),
    ).fetchone()
    if not current:
        return None

    conn.execute(
        """
        UPDATE finance_wishlist_items
        SET name = ?,
            link = ?,
            price_cents = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """,
        (
            payload.name.strip() if payload.name is not None else current["name"],
            payload.link.strip() if payload.link is not None else current["link"],
            _to_cents(payload.price) if payload.price is not None else current["price_cents"],
            wishlist_item_id,
        ),
    )
    return wishlist_item_payload(_wishlist_item_row(conn, wishlist_item_id))


def delete_wishlist_item(conn: sqlite3.Connection, wishlist_item_id: int) -> bool:
    deleted = conn.execute(
        "DELETE FROM finance_wishlist_items WHERE id = ?", (wishlist_item_id,)
    )
    return deleted.rowcount > 0


def expense_payload(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "entryKey": f"expense-{row['id']}",
        "name": row["name"],
        "amount": round(row["amount_cents"] / 100, 2),
        "date": row["expense_date"],
        "source": "manual",
        "subscriptionId": None,
        "category": {
            "id": row["category_id"],
            "name": row["category_name"],
        },
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def subscription_payload(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "amount": round(row["amount_cents"] / 100, 2),
        "billingDay": row["billing_day"],
        "startDate": row["start_date"],
        "endDate": row["end_date"] or "",
        "isActive": row["end_date"] is None,
        "category": {
            "id": row["category_id"],
            "name": row["category_name"],
        },
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def subscription_occurrence_payload(
    subscription: dict[str, Any], occurrence_date: dt_date
) -> dict[str, Any]:
    return {
        "id": subscription["id"],
        "entryKey": f"subscription-{subscription['id']}-{occurrence_date.isoformat()}",
        "name": subscription["name"],
        "amount": subscription["amount"],
        "date": occurrence_date.isoformat(),
        "source": "subscription",
        "subscriptionId": subscription["id"],
        "category": subscription["category"],
        "createdAt": subscription["createdAt"],
        "updatedAt": subscription["updatedAt"],
    }


def wishlist_item_payload(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "link": row["link"],
        "price": round(row["price_cents"] / 100, 2),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def _manual_expense_row(conn: sqlite3.Connection, expense_id: int) -> sqlite3.Row:
    return conn.execute(
        """
        SELECT e.id, e.name, e.amount_cents, e.expense_date, e.created_at, e.updated_at,
               c.id AS category_id, c.name AS category_name
        FROM finance_expenses e
        JOIN finance_categories c ON c.id = e.category_id
        WHERE e.id = ?
        """,
        (expense_id,),
    ).fetchone()


def _subscription_row(conn: sqlite3.Connection, subscription_id: int) -> sqlite3.Row:
    return conn.execute(
        """
        SELECT s.id, s.name, s.amount_cents, s.billing_day, s.start_date, s.end_date,
               s.created_at, s.updated_at, c.id AS category_id, c.name AS category_name
        FROM finance_subscriptions s
        JOIN finance_categories c ON c.id = s.category_id
        WHERE s.id = ?
        """,
        (subscription_id,),
    ).fetchone()


def _wishlist_item_row(conn: sqlite3.Connection, wishlist_item_id: int) -> sqlite3.Row:
    return conn.execute(
        """
        SELECT id, name, link, price_cents, created_at, updated_at
        FROM finance_wishlist_items
        WHERE id = ?
        """,
        (wishlist_item_id,),
    ).fetchone()


def _subscription_occurrence_for_month(
    subscription: dict[str, Any], month_start: dt_date
) -> dt_date | None:
    last_day = calendar.monthrange(month_start.year, month_start.month)[1]
    occurrence_date = dt_date(
        month_start.year,
        month_start.month,
        min(subscription["billingDay"], last_day),
    )
    start_date = dt_date.fromisoformat(subscription["startDate"])
    end_date = (
        dt_date.fromisoformat(subscription["endDate"])
        if subscription["endDate"]
        else None
    )
    if occurrence_date < start_date:
        return None
    if end_date is not None and occurrence_date > end_date:
        return None
    return occurrence_date


def _parse_month(month: str | None) -> dt_date:
    if not month:
        today = dt_date.today()
        return dt_date(today.year, today.month, 1)

    try:
        year, month_value = month.split("-", maxsplit=1)
        return dt_date(int(year), int(month_value), 1)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Month must use YYYY-MM format.") from exc


def _next_month(value: dt_date) -> dt_date:
    if value.month == 12:
        return dt_date(value.year + 1, 1, 1)
    return dt_date(value.year, value.month + 1, 1)


def _to_cents(amount: float) -> int:
    return int(round(amount * 100))


def _require_category(conn: sqlite3.Connection, category_id: int) -> None:
    category = conn.execute(
        "SELECT id FROM finance_categories WHERE id = ?", (category_id,)
    ).fetchone()
    if not category:
        raise HTTPException(status_code=400, detail="Expense category is invalid.")

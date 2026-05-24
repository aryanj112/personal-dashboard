from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ..core.db import get_db
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
from ..services.finance import (
    create_category,
    create_expense,
    create_subscription,
    create_wishlist_item,
    delete_category,
    delete_expense,
    delete_subscription,
    delete_wishlist_item,
    finance_payload,
    list_categories,
    list_subscriptions,
    list_wishlist_items,
    reorder_categories,
    update_category,
    update_expense,
    update_subscription,
    update_wishlist_item,
)


router = APIRouter(prefix="/api/finance", tags=["finance"])


@router.get("")
def api_finance(month: str | None = Query(default=None)) -> dict[str, Any]:
    with get_db() as conn:
        return finance_payload(conn, month)


@router.get("/categories")
def api_finance_categories() -> dict[str, Any]:
    with get_db() as conn:
        return {"categories": list_categories(conn)}


@router.post("/categories")
def api_create_finance_category(payload: FinanceCategoryCreate) -> dict[str, Any]:
    with get_db() as conn:
        return create_category(conn, payload)


@router.patch("/categories/{category_id}")
def api_update_finance_category(
    category_id: int, payload: FinanceCategoryUpdate
) -> dict[str, Any]:
    with get_db() as conn:
        category = update_category(conn, category_id, payload)
        if not category:
            raise HTTPException(status_code=404, detail="Category not found.")
        return category


@router.delete("/categories/{category_id}")
def api_delete_finance_category(category_id: int) -> dict[str, bool]:
    with get_db() as conn:
        if not delete_category(conn, category_id):
            raise HTTPException(status_code=404, detail="Category not found.")
        return {"ok": True}


@router.put("/categories/order")
def api_reorder_finance_categories(payload: FinanceCategoryReorder) -> dict[str, Any]:
    with get_db() as conn:
        return {"categories": reorder_categories(conn, payload)}


@router.post("/expenses")
def api_create_finance_expense(payload: FinanceExpenseCreate) -> dict[str, Any]:
    with get_db() as conn:
        return create_expense(conn, payload)


@router.patch("/expenses/{expense_id}")
def api_update_finance_expense(
    expense_id: int, payload: FinanceExpenseUpdate
) -> dict[str, Any]:
    with get_db() as conn:
        expense = update_expense(conn, expense_id, payload)
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found.")
        return expense


@router.delete("/expenses/{expense_id}")
def api_delete_finance_expense(expense_id: int) -> dict[str, bool]:
    with get_db() as conn:
        if not delete_expense(conn, expense_id):
            raise HTTPException(status_code=404, detail="Expense not found.")
        return {"ok": True}


@router.get("/subscriptions")
def api_finance_subscriptions() -> dict[str, Any]:
    with get_db() as conn:
        return {"subscriptions": list_subscriptions(conn)}


@router.post("/subscriptions")
def api_create_finance_subscription(
    payload: FinanceSubscriptionCreate,
) -> dict[str, Any]:
    with get_db() as conn:
        return create_subscription(conn, payload)


@router.patch("/subscriptions/{subscription_id}")
def api_update_finance_subscription(
    subscription_id: int, payload: FinanceSubscriptionUpdate
) -> dict[str, Any]:
    with get_db() as conn:
        subscription = update_subscription(conn, subscription_id, payload)
        if not subscription:
            raise HTTPException(status_code=404, detail="Subscription not found.")
        return subscription


@router.delete("/subscriptions/{subscription_id}")
def api_delete_finance_subscription(subscription_id: int) -> dict[str, bool]:
    with get_db() as conn:
        if not delete_subscription(conn, subscription_id):
            raise HTTPException(status_code=404, detail="Subscription not found.")
        return {"ok": True}


@router.get("/wishlist")
def api_finance_wishlist() -> dict[str, Any]:
    with get_db() as conn:
        return {"wishlist": list_wishlist_items(conn)}


@router.post("/wishlist")
def api_create_finance_wishlist_item(
    payload: FinanceWishlistItemCreate,
) -> dict[str, Any]:
    with get_db() as conn:
        return create_wishlist_item(conn, payload)


@router.patch("/wishlist/{wishlist_item_id}")
def api_update_finance_wishlist_item(
    wishlist_item_id: int, payload: FinanceWishlistItemUpdate
) -> dict[str, Any]:
    with get_db() as conn:
        wishlist_item = update_wishlist_item(conn, wishlist_item_id, payload)
        if not wishlist_item:
            raise HTTPException(status_code=404, detail="Wishlist item not found.")
        return wishlist_item


@router.delete("/wishlist/{wishlist_item_id}")
def api_delete_finance_wishlist_item(wishlist_item_id: int) -> dict[str, bool]:
    with get_db() as conn:
        if not delete_wishlist_item(conn, wishlist_item_id):
            raise HTTPException(status_code=404, detail="Wishlist item not found.")
        return {"ok": True}

from __future__ import annotations

from datetime import date as dt_date

from pydantic import BaseModel, Field


class HabitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    sort_order: int | None = None


class HabitUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class HabitLogUpsert(BaseModel):
    date: dt_date
    completed: bool = True
    notes: str | None = None


class TaskCreate(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    date: dt_date | None = None
    notes: str | None = None
    checklist_id: int | None = None
    priority: str = Field(default="medium", pattern="^(high|medium|low)$")
    is_misc: bool = False
    url: str | None = None


class TaskUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=200)
    completed: bool | None = None
    notes: str | None = None
    sort_order: int | None = None
    date: dt_date | None = None
    priority: str | None = Field(default=None, pattern="^(high|medium|low)$")
    is_misc: bool | None = None
    url: str | None = None


class GoalCreate(BaseModel):
    text: str = Field(min_length=1, max_length=200)


class ChecklistCreate(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    starting_count: int = Field(default=0, ge=0, le=1_000_000)
    total_goal: int = Field(ge=1, le=1_000_000)
    daily_goal: int = Field(ge=1, le=1_000_000)


class ChecklistProgressUpdate(BaseModel):
    date: dt_date
    delta: int = Field(ge=-1_000_000, le=1_000_000)


class SectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class SectionUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class SessionCreate(BaseModel):
    date: dt_date
    duration_minutes: float | None = Field(default=None, ge=0, le=1440)
    run_miles: float | None = Field(default=None, ge=0, le=200)
    notes: str | None = None
    section_ids: list[int] = Field(default_factory=list)
    is_rest: bool = False


class SessionUpdate(BaseModel):
    date: dt_date | None = None
    duration_minutes: float | None = Field(default=None, ge=0, le=1440)
    run_miles: float | None = Field(default=None, ge=0, le=200)
    notes: str | None = None
    section_ids: list[int] | None = None
    is_rest: bool | None = None


class GuitarMaterialCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    notes: str = ""


class GuitarMaterialUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    notes: str | None = None


class GuitarSongCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)


class GuitarSongUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    notes: str | None = None


class NetworkingLocationPayload(BaseModel):
    city: str = ""
    region: str = ""


class NetworkingInteractionPayload(BaseModel):
    date: dt_date
    type: str = Field(min_length=1, max_length=80)
    summary: str = Field(min_length=1, max_length=400)


class NetworkingContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    company: str = Field(min_length=1, max_length=120)
    role: str = Field(min_length=1, max_length=120)
    tags: list[str] = Field(default_factory=list)
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    location: NetworkingLocationPayload = Field(default_factory=NetworkingLocationPayload)
    notes: str = ""
    last_contact_date: dt_date
    next_follow_up_date: dt_date | None = None
    how_we_met: str = ""
    next_action: str = ""
    follow_up_type: str | None = None
    interactions: list[NetworkingInteractionPayload] = Field(default_factory=list)


class NetworkingContactUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    company: str | None = Field(default=None, min_length=1, max_length=120)
    role: str | None = Field(default=None, min_length=1, max_length=120)
    tags: list[str] | None = None
    email: str | None = None
    phone: str | None = None
    linkedin: str | None = None
    location: NetworkingLocationPayload | None = None
    notes: str | None = None
    last_contact_date: dt_date | None = None
    next_follow_up_date: dt_date | None = None
    how_we_met: str | None = None
    next_action: str | None = None
    follow_up_type: str | None = None
    interactions: list[NetworkingInteractionPayload] | None = None


class PotentialConnectUpdate(BaseModel):
    company: str | None = Field(default=None, min_length=1, max_length=120)
    connection_request: str | None = Field(default=None, max_length=1000)
    status: str | None = Field(default=None, max_length=40)
    date_sent: dt_date | None = None
    notes: str | None = None


class FinanceCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class FinanceCategoryUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class FinanceCategoryReorder(BaseModel):
    category_ids: list[int] = Field(default_factory=list)


class FinanceExpenseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    category_id: int
    amount: float = Field(gt=0, le=1_000_000)
    date: dt_date


class FinanceExpenseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    category_id: int | None = None
    amount: float | None = Field(default=None, gt=0, le=1_000_000)
    date: dt_date | None = None


class FinanceSubscriptionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    category_id: int
    amount: float = Field(gt=0, le=1_000_000)
    billing_day: int = Field(ge=1, le=31)
    start_date: dt_date


class FinanceSubscriptionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    category_id: int | None = None
    amount: float | None = Field(default=None, gt=0, le=1_000_000)
    billing_day: int | None = Field(default=None, ge=1, le=31)
    start_date: dt_date | None = None
    end_date: dt_date | None = None


class FinanceWishlistItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    link: str = Field(min_length=1, max_length=500)
    price: float = Field(gt=0, le=1_000_000)


class FinanceWishlistItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    link: str | None = Field(default=None, min_length=1, max_length=500)
    price: float | None = Field(default=None, gt=0, le=1_000_000)


class RecurringTaskCreate(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    priority: str = Field(default="medium", pattern="^(high|medium|low)$")
    days_of_week: list[int] = Field(default_factory=list)  # 0=Mon … 6=Sun
    end_date: dt_date | None = None


class RecurringTaskUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=200)
    priority: str | None = Field(default=None, pattern="^(high|medium|low)$")
    days_of_week: list[int] | None = None
    end_date: dt_date | None = None
    is_active: bool | None = None


class ResumeCompileRequest(BaseModel):
    name: str = Field(default="main", min_length=1, max_length=120)
    source: str = Field(min_length=1, max_length=50_000)

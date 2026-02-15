from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TodoBase(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"
    assignee: str = ""
    creator: str = ""
    due_date: datetime | None = None


class TodoCreate(TodoBase):
    pass


class TodoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    assignee: str | None = None
    creator: str | None = None
    due_date: datetime | None = None


class TodoRead(TodoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_overdue: bool
    created_at: datetime
    updated_at: datetime

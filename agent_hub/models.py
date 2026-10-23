from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
import json


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Task:
    id: str
    title: str
    description: str
    role: str
    status: str = "queued"
    priority: int = 50
    depends_on: list[str] | None = None
    assigned_agent: str | None = None
    result: str | None = None
    created_at: str = ""
    updated_at: str = ""

    def __post_init__(self) -> None:
        self.depends_on = self.depends_on or []
        self.created_at = self.created_at or now()
        self.updated_at = self.updated_at or self.created_at

    def as_dict(self) -> dict[str, Any]:
        return self.__dict__.copy()


@dataclass
class Event:
    type: str
    task_id: str | None
    message: str
    data: dict[str, Any]
    created_at: str = ""

    def __post_init__(self) -> None:
        self.created_at = self.created_at or now()

    def as_dict(self) -> dict[str, Any]:
        return {"type": self.type, "task_id": self.task_id, "message": self.message,
                "data": self.data, "created_at": self.created_at}


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))

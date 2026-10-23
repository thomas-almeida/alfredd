from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from pathlib import Path
from typing import Any

from .models import Event, Task, now


class Store:
    def __init__(self, path: str = ".agent-hub/state.db") -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        self.db.executescript("""
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
          role TEXT NOT NULL, status TEXT NOT NULL, priority INTEGER NOT NULL,
          depends_on TEXT NOT NULL, assigned_agent TEXT, result TEXT,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL,
          task_id TEXT, message TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL
        );
        """)
        self.db.commit()

    def _task(self, row: sqlite3.Row) -> Task:
        values = dict(row)
        values["depends_on"] = json.loads(values["depends_on"])
        return Task(**values)

    def emit(self, event_type: str, message: str, task_id: str | None = None,
             data: dict[str, Any] | None = None) -> Event:
        event = Event(event_type, task_id, message, data or {})
        with self.lock:
            self.db.execute("INSERT INTO events(type,task_id,message,data,created_at) VALUES(?,?,?,?,?)",
                            (event.type, event.task_id, event.message, json.dumps(event.data), event.created_at))
            self.db.commit()
        return event

    def events(self, after: int = 0) -> list[dict[str, Any]]:
        with self.lock:
            rows = self.db.execute("SELECT * FROM events WHERE id > ? ORDER BY id", (after,)).fetchall()
        return [{"id": row["id"], **Event(row["type"], row["task_id"], row["message"], json.loads(row["data"]), row["created_at"]).as_dict()} for row in rows]

    def create_task(self, title: str, description: str, role: str, priority: int = 50,
                    depends_on: list[str] | None = None) -> Task:
        task = Task(str(uuid.uuid4()), title, description, role, priority=priority, depends_on=depends_on)
        with self.lock:
            self.db.execute("INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                            (task.id, task.title, task.description, task.role, task.status, task.priority,
                             json.dumps(task.depends_on), task.assigned_agent, task.result,
                             task.created_at, task.updated_at))
            self.db.commit()
        self.emit("task.created", f"Tarefa criada: {title}", task.id, task.as_dict())
        return task

    def list_tasks(self) -> list[Task]:
        with self.lock:
            return [self._task(row) for row in self.db.execute("SELECT * FROM tasks ORDER BY priority ASC, created_at ASC")]

    def get_task(self, task_id: str) -> Task | None:
        with self.lock:
            row = self.db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
        return self._task(row) if row else None

    def claim_ready(self, agent_id: str, roles: list[str]) -> Task | None:
        with self.lock:
            tasks = self.list_tasks()
            done = {task.id for task in tasks if task.status == "done"}
            candidate = next((task for task in tasks if task.status == "queued" and task.role in roles
                              and all(dep in done for dep in task.depends_on)), None)
            if not candidate:
                return None
            changed = now()
            self.db.execute("UPDATE tasks SET status='running', assigned_agent=?, updated_at=? WHERE id=? AND status='queued'",
                            (agent_id, changed, candidate.id))
            self.db.commit()
            candidate.status, candidate.assigned_agent, candidate.updated_at = "running", agent_id, changed
        self.emit("task.claimed", f"{agent_id} assumiu: {candidate.title}", candidate.id, candidate.as_dict())
        return candidate

    def update(self, task_id: str, status: str, result: str | None = None) -> Task | None:
        if status not in {"queued", "running", "blocked", "done", "failed"}:
            raise ValueError("status inválido")
        with self.lock:
            task = self.get_task(task_id)
            if not task:
                return None
            changed = now()
            self.db.execute("UPDATE tasks SET status=?, result=COALESCE(?, result), updated_at=? WHERE id=?",
                            (status, result, changed, task_id))
            self.db.commit()
            task.status, task.updated_at = status, changed
            if result is not None:
                task.result = result
        self.emit(f"task.{status}", f"Tarefa {status}: {task.title}", task_id, task.as_dict())
        return task

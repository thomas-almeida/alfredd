from __future__ import annotations

import os
import time

from .adapters import Adapter, adapter_from_env
from .store import Store


class Worker:
    def __init__(self, store: Store, agent_id: str, roles: list[str], adapter: Adapter | None = None,
                 cwd: str | None = None) -> None:
        self.store, self.agent_id, self.roles = store, agent_id, roles
        self.adapter, self.cwd = adapter or adapter_from_env(), cwd or os.getcwd()

    def once(self) -> bool:
        task = self.store.claim_ready(self.agent_id, self.roles)
        if not task:
            return False
        prompt = (f"Você é o agente {self.agent_id}, papel {task.role}.\n"
                  f"Projeto: {self.cwd}\nTarefa: {task.title}\nContexto: {task.description}\n"
                  "Faça o trabalho no repositório. Ao terminar, deixe um resumo verificável.")
        try:
            result = self.adapter.run(prompt, self.cwd)
            self.store.update(task.id, "done" if result.success else "failed", result.output)
        except Exception as exc:
            self.store.update(task.id, "failed", f"Erro ao executar agente: {exc}")
        return True

    def run(self, poll_seconds: float = 2.0) -> None:
        self.store.emit("agent.online", f"Agente online: {self.agent_id}", data={"agent_id": self.agent_id, "roles": self.roles})
        while True:
            if not self.once():
                time.sleep(poll_seconds)

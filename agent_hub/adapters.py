from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass


@dataclass
class AgentResult:
    success: bool
    output: str


class Adapter:
    def run(self, prompt: str, cwd: str) -> AgentResult:
        raise NotImplementedError


class DemoAdapter(Adapter):
    def run(self, prompt: str, cwd: str) -> AgentResult:
        return AgentResult(True, "Modo demo: tarefa recebida e validada.\n\n" + prompt)


class CommandAdapter(Adapter):
    def __init__(self, command: str) -> None:
        self.command = command

    def run(self, prompt: str, cwd: str) -> AgentResult:
        env = os.environ.copy()
        env["AGENT_TASK_PROMPT"] = prompt
        completed = subprocess.run(self.command, cwd=cwd, env=env, shell=True,
                                   capture_output=True, text=True, timeout=3600)
        output = (completed.stdout + "\n" + completed.stderr).strip()
        return AgentResult(completed.returncode == 0, output)


def adapter_from_env() -> Adapter:
    command = os.getenv("AGENT_HUB_COMMAND", "").strip()
    return CommandAdapter(command) if command else DemoAdapter()

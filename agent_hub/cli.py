from __future__ import annotations

import argparse
import json
import os

from .server import serve
from .store import Store
from .worker import Worker


def main() -> None:
    parser = argparse.ArgumentParser(description="Coordena agentes de desenvolvimento localmente")
    sub = parser.add_subparsers(dest="command", required=True)
    api = sub.add_parser("serve", help="inicia API e stream de eventos")
    api.add_argument("--host", default=os.getenv("AGENT_HUB_HOST", "127.0.0.1"))
    api.add_argument("--port", type=int, default=int(os.getenv("AGENT_HUB_PORT", "8787")))
    api.add_argument("--db", default=os.getenv("AGENT_HUB_DB", ".agent-hub/state.db"))
    worker = sub.add_parser("worker", help="inicia um agente que consome tarefas")
    worker.add_argument("--id", required=True)
    worker.add_argument("--roles", required=True, help="papéis separados por vírgula")
    worker.add_argument("--db", default=os.getenv("AGENT_HUB_DB", ".agent-hub/state.db"))
    worker.add_argument("--cwd", default=os.getcwd())
    task = sub.add_parser("task", help="cria tarefa sem usar HTTP")
    task.add_argument("title")
    task.add_argument("description")
    task.add_argument("--role", required=True)
    task.add_argument("--priority", type=int, default=50)
    task.add_argument("--depends-on", nargs="*", default=[])
    task.add_argument("--db", default=os.getenv("AGENT_HUB_DB", ".agent-hub/state.db"))
    args = parser.parse_args()
    if args.command == "serve":
        serve(args.host, args.port, args.db)
    elif args.command == "worker":
        Worker(Store(args.db), args.id, [role.strip() for role in args.roles.split(",")], cwd=args.cwd).run()
    else:
        task = Store(args.db).create_task(args.title, args.description, args.role, args.priority, args.depends_on)
        print(json.dumps(task.as_dict(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

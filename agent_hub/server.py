from __future__ import annotations

import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

from .store import Store


class Handler(BaseHTTPRequestHandler):
    store: Store

    def _send(self, status: int, payload: object, content_type: str = "application/json") -> None:
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            return self._send(200, {"ok": True})
        if parsed.path == "/tasks":
            return self._send(200, {"tasks": [task.as_dict() for task in self.store.list_tasks()]})
        if parsed.path == "/events":
            # SSE simples: cliente reconecta com Last-Event-ID e recebe eventos novos.
            last = int(self.headers.get("Last-Event-ID", "0"))
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            deadline = time.time() + 25
            sent = False
            while time.time() < deadline:
                events = self.store.events(last)
                for event in events:
                    last, sent = event["id"], True
                    self.wfile.write(f"id: {last}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n".encode())
                    self.wfile.flush()
                if sent:
                    return
                time.sleep(1)
            self.wfile.write(b": heartbeat\n\n")
            self.wfile.flush()
            return
        return self._send(404, {"error": "rota não encontrada"})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            size = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(size) or b"{}")
            if parsed.path == "/tasks":
                required = ["title", "description", "role"]
                missing = [field for field in required if not body.get(field)]
                if missing:
                    return self._send(400, {"error": f"campos obrigatórios: {', '.join(missing)}"})
                task = self.store.create_task(body["title"], body["description"], body["role"],
                                              int(body.get("priority", 50)), body.get("depends_on", []))
                return self._send(201, task.as_dict())
            if parsed.path.startswith("/tasks/") and parsed.path.endswith("/status"):
                task_id = parsed.path.split("/")[2]
                task = self.store.update(task_id, body.get("status", ""), body.get("result"))
                return self._send(200 if task else 404, task.as_dict() if task else {"error": "tarefa não encontrada"})
            return self._send(404, {"error": "rota não encontrada"})
        except (ValueError, json.JSONDecodeError) as exc:
            return self._send(400, {"error": str(exc)})


def serve(host: str = "127.0.0.1", port: int = 8787, db: str = ".agent-hub/state.db") -> None:
    store = Store(db)
    Handler.store = store
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Agent Hub ouvindo em http://{host}:{port}")
    server.serve_forever()

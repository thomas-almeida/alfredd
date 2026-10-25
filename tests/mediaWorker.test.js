import assert from "node:assert/strict";
import { after, test } from "node:test";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = 45981;
const worker = spawn(process.execPath, [join(root, "media-worker", "src", "server.js")], {
  cwd: root,
  env: { ...process.env, PORT: String(port), MEDIA_WORKER_SECRET: "regression-secret" },
  stdio: ["ignore", "pipe", "pipe"],
});

let ready;
ready = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("media-worker não iniciou a tempo")), 5000);
  worker.stdout.on("data", (chunk) => {
    if (String(chunk).includes("media-worker listening")) {
      clearTimeout(timeout);
      resolve();
    }
  });
  worker.once("error", reject);
});

after(() => worker.kill());

test("media-worker expõe healthcheck público e protege a mídia", async () => {
  await ready;
  const unauthorized = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(unauthorized.status, 200);
  assert.deepEqual(await unauthorized.json(), { ok: true, service: "media-worker" });
  const progress = await fetch(`http://127.0.0.1:${port}/youtube/source?videoId=test&start=0&end=1000&progress=1`, { headers: { Authorization: "Bearer regression-secret" } });
  assert.equal(progress.status, 200);
  assert.equal((await progress.json()).status, "idle");
  const media = await fetch(`http://127.0.0.1:${port}/youtube/source?videoId=test`);
  assert.equal(media.status, 401);
});

test("contrato de deploy mantém Vercel e Render separados", async () => {
  const dockerfile = await readFile(join(root, "media-worker", "Dockerfile"), "utf8");
  assert.match(dockerfile, /ffmpeg/);
  assert.match(dockerfile, /yt-dlp\[default\]/);
  const server = await readFile(join(root, "media-worker", "src", "server.js"), "utf8");
  assert.match(server, /--js-runtimes.*deno/);
  assert.match(server, /DENO_PATH/);
  assert.match(server, /YOUTUBE_PROXY_URL/);
  assert.match(server, /--proxy/);
  assert.match(server, /-http_proxy/);
  assert.match(server, /YOUTUBE_COOKIES_B64/);
  assert.match(server, /YOUTUBE_USER_AGENT/);
  assert.match(server, /--cookies/);
  assert.match(server, /--user-agent/);
  assert.match(server, /YTDLP_TIMEOUT_MS/);
  assert.match(server, /excedeu o timeout/);
  assert.match(server, /YOUTUBE_PLAYER_CLIENTS/);
  assert.match(server, /android_vr/);
  assert.match(server, /player_client=/);
  await assert.rejects(readFile(join(root, "vercel.json")), { code: "ENOENT" });
});

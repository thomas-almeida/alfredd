import assert from "node:assert/strict";
import { after, test } from "node:test";
import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
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

test("media-worker protege tambem a rota de transcricao", async () => {
  await ready;
  const response = await fetch(`http://127.0.0.1:${port}/youtube/transcript`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ videoId: "dQw4w9WgXcQ" }),
  });
  assert.equal(response.status, 401);
});

test("contrato de deploy mantém Vercel e Render separados", async () => {
  const dockerfile = await readFile(join(root, "media-worker", "Dockerfile"), "utf8");
  assert.match(dockerfile, /ffmpeg/);
  assert.match(dockerfile, /yt-dlp\[default\]/);
  assert.match(dockerfile, /bgutil-ytdlp-pot-provider/);
  assert.match(dockerfile, /BGUTIL_VERSION/);
  assert.match(dockerfile, /bgutil-ytdlp-pot-provider==\$\{BGUTIL_VERSION\}/);
  const startScript = await readFile(join(root, "media-worker", "start.sh"), "utf8");
  assert.match(startScript, /port 4416/);
  assert.match(startScript, />\/dev\/null 2>&1/);
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
  assert.match(server, /YOUTUBE_POT_PROVIDER_URL/);
  assert.match(server, /youtubepot-bgutilhttp/);
  assert.match(server, /mweb,tv,web_safari/);
  assert.match(server, /YOUTUBE_PLAYER_CLIENTS/);
  assert.match(server, /player_client=/);
  assert.match(server, /const directYoutubeCache = new Map\(\)/);
  assert.match(server, /if \(cached\?\.pending\) return cached\.pending/);
  assert.match(server, /youtube-direct:/);
  assert.match(server, /--no-playlist.*--no-part.*--force-overwrites.*-o.*file/);
  assert.match(server, /--no-playlist.*--no-part.*--force-overwrites/);
  assert.match(server, /source\.%\(ext\)s/);
  assert.match(server, /join\(temp, audioFile\)/);
  assert.match(server, /upstream media returned HTTP 403/);
  const transcriptWorker = server.slice(server.indexOf("async function youtubeTranscript"), server.indexOf("async function youtube(url)"));
  assert.doesNotMatch(transcriptWorker, /http_proxy|proxyArgs/);
  const flyToml = await readFile(join(root, "media-worker", "fly.toml"), "utf8");
  assert.match(flyToml, /memory_mb = 2048/);
  const editor = await readFile(join(root, "src", "features", "editor", "ClipEditor.tsx"), "utf8");
  assert.match(editor, /videoId=\$\{encodeURIComponent\(youtube\.videoId\)\}&audio=0/);
  assert.match(editor, /const progressUrl = undefined/);
  await assert.rejects(access(join(root, "vercel.json")));
});

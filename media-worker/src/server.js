const http = require("node:http");
const { spawn } = require("node:child_process");
const { createHash } = require("node:crypto");
const { createReadStream } = require("node:fs");
const { mkdir, mkdtemp, rm, stat, writeFile } = require("node:fs/promises");
const { readFile, readdir } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const port = Number(process.env.PORT || 8080);
const secret = process.env.MEDIA_WORKER_SECRET || "";
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const ytdlp = process.env.YTDLP_PATH || "yt-dlp";
const deno = process.env.DENO_PATH || (process.platform === "win32" ? "deno" : "/usr/local/bin/deno");
const youtubeProxy = process.env.YOUTUBE_PROXY_URL?.trim() || "";
const youtubeUserAgent = process.env.YOUTUBE_USER_AGENT?.trim() || "";
const youtubePotProviderUrl = process.env.YOUTUBE_POT_PROVIDER_URL?.trim() || "";
const youtubeCookiesFile = process.env.YOUTUBE_COOKIES_FILE?.trim() || "";
const youtubeCookiesPath = process.env.YOUTUBE_COOKIES_B64?.trim()
  ? writeFile(join(tmpdir(), `alfredd-youtube-cookies-${process.pid}.txt`), Buffer.from(process.env.YOUTUBE_COOKIES_B64.trim(), "base64"), { mode: 0o600 }).then(() => join(tmpdir(), `alfredd-youtube-cookies-${process.pid}.txt`))
  : Promise.resolve("");
const youtubePlayerClients = (process.env.YOUTUBE_PLAYER_CLIENTS || "mweb,tv,web_safari;tv,web_embedded;default")
  .split(";")
  .map((value) => value.trim())
  .filter(Boolean);
const groqApiKey = process.env.GROQ_API_KEY?.trim() || "";
const groqModel = process.env.TRANSCRIBE_MODEL?.trim() || "whisper-large-v3-turbo";
const groqBaseUrl = (process.env.TRANSCRIBE_BASE_URL?.trim() || "https://api.groq.com/openai/v1").replace(/\/$/, "");
const ttl = Number(process.env.MEDIA_CACHE_TTL_MS || 30 * 60_000);
const ytdlpTimeoutMs = Number(process.env.YTDLP_TIMEOUT_MS || 30_000);
const cacheDir = mkdir(join(tmpdir(), "alfredd-media"), { recursive: true }).then(() => join(tmpdir(), "alfredd-media"));
const pending = new Map();
const progress = new Map();
const directYoutubeCache = new Map();

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  res.end(body);
}
function sanitizeError(value) {
  return String(value).replace(/https?:\/\/\S+/g, "[signed-url]");
}
function run(command, args, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: process.env });
    let out = ""; let error = "";
    const timer = timeoutMs > 0 ? setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${command} excedeu o timeout de ${timeoutMs}ms`));
    }, timeoutMs) : null;
    child.stdout.on("data", (data) => { out += data.toString(); });
    child.stderr.on("data", (data) => { error += data.toString(); });
    child.on("error", (err) => reject(new Error(`${command} não encontrado: ${err.message}`)));
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      code === 0 ? resolve(out) : reject(new Error(sanitizeError(error.trim().slice(-1000) || `${command} falhou`)));
    });
  });
}
async function runYtdlp(args) {
  let lastError;
  const cookiePath = youtubeCookiesFile || await youtubeCookiesPath;
  for (const clients of youtubePlayerClients) {
    const extractorArgs = clients === "default" ? [] : ["--extractor-args", `youtube:player_client=${clients}`];
    const proxyArgs = youtubeProxy ? ["--proxy", youtubeProxy] : [];
    const cookieArgs = cookiePath ? ["--cookies", cookiePath] : [];
    const userAgentArgs = youtubeUserAgent ? ["--user-agent", youtubeUserAgent] : [];
    const potArgs = youtubePotProviderUrl ? ["--extractor-args", `youtubepot-bgutilhttp:base_url=${youtubePotProviderUrl}`] : [];
    console.log(`[youtube] tentando cliente ${clients} (proxy=${Boolean(youtubeProxy)}, cookies=${Boolean(cookiePath)})`);
    try {
      return await run(ytdlp, ["--js-runtimes", `deno:${deno}`, "--remote-components", "ejs:github", ...proxyArgs, ...cookieArgs, ...userAgentArgs, ...potArgs, ...extractorArgs, ...args], ytdlpTimeoutMs);
    } catch (error) {
      lastError = error;
      console.warn(`[youtube] extractor client ${clients} failed: ${error.message}`);
    }
  }
  throw lastError || new Error("yt-dlp falhou");
}

async function directYoutubeUrl(id, format) {
  const key = `${id}:${format}`;
  const cached = directYoutubeCache.get(key);
  if (cached?.url && Date.now() - cached.at < 5 * 60_000) return cached.url;
  if (cached?.pending) return cached.pending;
  const pendingUrl = (async () => {
    const direct = (await runYtdlp(["-g", "-f", format, "--no-warnings", `https://www.youtube.com/watch?v=${id}`])).trim().split(/\r?\n/).find(Boolean);
    if (!direct) throw new Error("yt-dlp nÃ£o retornou vÃ­deo");
    directYoutubeCache.set(key, { url: direct, at: Date.now() });
    return direct;
  })();
  directYoutubeCache.set(key, { pending: pendingUrl });
  try { return await pendingUrl; } catch (error) { directYoutubeCache.delete(key); throw error; }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { body += chunk; if (body.length > 32_000) reject(new Error("request_too_large")); });
    req.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("invalid_json")); } });
    req.on("error", reject);
  });
}

function transcriptLines(words) {
  const lines = [];
  let start = 0;
  const flush = (end) => {
    if (end < start) return;
    const ws = words.slice(start, end + 1);
    lines.push({ index: lines.length, startMs: ws[0].startMs, endMs: ws.at(-1).endMs, text: ws.map((w) => w.text).join(" "), wordStart: start, wordEnd: end });
    start = end + 1;
  };
  for (let i = 0; i < words.length; i++) {
    const next = words[i + 1];
    if (!next) { flush(i); break; }
    const text = words.slice(start, i + 2).map((w) => w.text).join(" ");
    const span = next.endMs - words[start].startMs;
    if (next.startMs - words[i].endMs >= 800 || text.length > 42 || span > 2600 || /[.!?]$/.test(words[i].text) && i - start >= 2) flush(i);
  }
  return lines;
}

function transcriptChunks(words) {
  const chunks = [];
  if (!words.length) return chunks;
  let from = words[0].startMs;
  const last = words.at(-1).endMs;
  while (from < last) {
    const to = from + 25_000;
    const ws = words.filter((w) => w.startMs >= from && w.startMs < to);
    if (ws.length) chunks.push({ index: chunks.length, startMs: ws[0].startMs, endMs: ws.at(-1).endMs, text: ws.map((w) => w.text).join(" ") });
    from = to - 3_000;
  }
  return chunks;
}

async function transcribeGroq(file, offsetMs, vocabulary) {
  if (!groqApiKey) throw new Error("GROQ_API_KEY não configurada no media-worker");
  const form = new FormData();
  form.append("file", new Blob([await readFile(file)], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", groqModel);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  form.append("temperature", "0");
  form.append("language", "pt");
  if (vocabulary) form.append("prompt", String(vocabulary).slice(0, 800));
  const response = await fetch(`${groqBaseUrl}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${groqApiKey}` }, body: form });
  if (!response.ok) throw new Error(`Groq HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const json = await response.json();
  const words = Array.isArray(json.words) ? json.words : [];
  return words.filter((w) => typeof w?.word === "string" && Number.isFinite(w.start) && Number.isFinite(w.end)).map((w) => ({ text: w.word.trim(), startMs: offsetMs + Math.round(w.start * 1000), endMs: offsetMs + Math.round(w.end * 1000) })).filter((w) => w.text);
}

async function youtubeTranscript(body) {
  const id = typeof body.videoId === "string" ? body.videoId.trim() : "";
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error("invalid_video");
  const vocabulary = typeof body.vocabulary === "string" ? body.vocabulary : "";
  const start = Number.isFinite(body.startMs) ? Number(body.startMs) : 0;
  const end = Number.isFinite(body.endMs) && Number(body.endMs) > start ? Number(body.endMs) : null;
  const temp = await mkdtemp(join(tmpdir(), "alfredd-transcript-"));
  try {
    const direct = (await runYtdlp(["-g", "-f", "bestaudio[ext=m4a]/bestaudio", "--no-warnings", `https://www.youtube.com/watch?v=${id}`])).trim().split(/\r?\n/).find(Boolean);
    if (!direct) throw new Error("yt-dlp nÃ£o retornou Ã¡udio");
    const proxyArgs = youtubeProxy ? ["-http_proxy", youtubeProxy] : [];
    const range = start > 0 || end != null ? ["-ss", String(start / 1000), ...(end != null ? ["-to", String(end / 1000)] : [])] : [];
    const pattern = join(temp, "part%03d.mp3");
    await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...proxyArgs, ...range, "-i", direct, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k", "-f", "segment", "-segment_time", "300", "-reset_timestamps", "1", pattern]);
    const files = (await readdir(temp)).filter((name) => name.endsWith(".mp3")).sort();
    const words = [];
    for (let i = 0; i < files.length; i++) words.push(...await transcribeGroq(join(temp, files[i]), start + i * 300_000, vocabulary));
    if (!words.length) throw new Error("Nenhuma palavra foi transcrita");
    return { source: { platform: "youtube", videoId: id }, method: "whisper", language: "pt", durationMs: (end ?? words.at(-1).endMs), words, lines: transcriptLines(words), chunks: transcriptChunks(words), createdAt: new Date().toISOString() };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
function range(value, size) {
  if (!value) return { start: 0, end: size - 1, status: 200 };
  const match = /^bytes=(\d+)-(\d*)$/.exec(value);
  if (!match) return { start: 0, end: size - 1, status: 200 };
  const start = Number(match[1]);
  if (start >= size) return { start: size, end: size - 1, status: 416 };
  return { start, end: Math.min(match[2] ? Number(match[2]) : size - 1, size - 1), status: 206 };
}
function streamFile(req, res, file, size) {
  const part = range(req.headers.range, size);
  if (part.status === 416) { res.writeHead(416, { "content-range": `bytes */${size}` }); return res.end(); }
  const headers = { "content-type": "video/mp4", "accept-ranges": "bytes", "content-length": part.end - part.start + 1, "cache-control": "private, max-age=1800" };
  if (part.status === 206) headers["content-range"] = `bytes ${part.start}-${part.end}/${size}`;
  res.writeHead(part.status, headers);
  createReadStream(file, { start: part.start, end: part.end }).pipe(res);
}
async function cachedFile(key, create) {
  const running = pending.get(key);
  if (running) return running;
  const task = (async () => {
    const dir = await cacheDir;
    const file = join(dir, `${createHash("sha256").update(key).digest("hex")}.mp4`);
    const old = await stat(file).catch(() => null);
    if (old?.size && Date.now() - old.mtimeMs < ttl) return { file, size: old.size };
    await create(file);
    const info = await stat(file);
    return { file, size: info.size };
  })();
  pending.set(key, task);
  try { return await task; } finally { pending.delete(key); }
}
async function youtube(url) {
  const id = url.searchParams.get("videoId");
  if (!id) throw new Error("invalid_video");
  if (url.searchParams.get("audio") === "0") {
    const format = `best[ext=mp4][height<=${process.env.YOUTUBE_MEDIA_MAX_HEIGHT || "480"}]/best`;
    return { redirect: await directYoutubeUrl(id, format) };
    const direct = (await runYtdlp(["-g", "-f", format, "--no-warnings", `https://www.youtube.com/watch?v=${id}`])).trim().split(/\r?\n/).find(Boolean);
    if (!direct) throw new Error("yt-dlp não retornou vídeo");
    return { redirect: await directYoutubeUrl(id, format) };
  }
  if (url.searchParams.get("audio") === "1") {
    return { redirect: await directYoutubeUrl(id, "bestaudio[ext=m4a]/bestaudio") };
    const direct = (await runYtdlp(["-g", "-f", "bestaudio[ext=m4a]/bestaudio", "--no-warnings", `https://www.youtube.com/watch?v=${id}`])).trim().split(/\r?\n/).find(Boolean);
    if (!direct) throw new Error("yt-dlp nÃ£o retornou audio");
    return { redirect: await directYoutubeUrl(id, "bestaudio[ext=m4a]/bestaudio") };
  }
  const start = url.searchParams.has("start") ? Number(url.searchParams.get("start")) : null;
  const end = url.searchParams.has("end") ? Number(url.searchParams.get("end")) : null;
  if ((start == null) !== (end == null) || (start != null && (!Number.isInteger(start) || !Number.isInteger(end) || end <= start))) throw new Error("invalid_window");
  const key = `youtube:${id}:${start}:${end}`;
  const result = await cachedFile(key, async (file) => {
    progress.set(key, { status: "resolving" });
    const max = process.env.YOUTUBE_MEDIA_MAX_HEIGHT || "480";
    const format = `bestvideo[ext=mp4][height<=${max}]+bestaudio[ext=m4a]/bestvideo[height<=${max}]+bestaudio/best`;
    const urls = (await runYtdlp(["-g", "-f", format, "--no-warnings", `https://www.youtube.com/watch?v=${id}`])).trim().split(/\r?\n/).filter(Boolean);
    if (!urls[0]) throw new Error("yt-dlp não retornou vídeo");
    progress.set(key, { status: "downloading", processedMs: 0 });
    const seek = start == null ? [] : ["-ss", String(start / 1000), "-t", String((end - start) / 1000)];
    const ffmpegProxy = /^https?:\/\//i.test(youtubeProxy) ? ["-http_proxy", youtubeProxy] : [];
    const args = ["-hide_banner", "-loglevel", "error", "-y", ...ffmpegProxy, ...seek, "-i", urls[0]];
    if (urls[1]) args.push(...seek, "-i", urls[1], "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac"); else args.push("-c", "copy");
    args.push("-movflags", "+faststart", file);
    await run(ffmpeg, args);
  });
  progress.set(key, { status: "ready", size: result.size });
  return result;
}
function youtubeProgress(url) {
  const id = url.searchParams.get("videoId");
  const start = url.searchParams.has("start") ? Number(url.searchParams.get("start")) : null;
  const end = url.searchParams.has("end") ? Number(url.searchParams.get("end")) : null;
  if (!id || (start == null) !== (end == null)) return { status: "idle" };
  const key = `youtube:${id}:${start}:${end}`;
  return progress.get(key) || { status: pending.has(key) ? "resolving" : "idle" };
}
async function twitchVod(url) {
  const id = url.searchParams.get("id");
  const start = Number(url.searchParams.get("start"));
  const end = Number(url.searchParams.get("end"));
  if (!id || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("invalid_vod_window");
  const key = `twitch:${id}:${start}:${end}:${url.searchParams.get("quality") || "source"}:${url.searchParams.get("precise") || "0"}`;
  return cachedFile(key, async (file) => {
    const query = `query($id: ID!) { video(id: $id) { lengthSeconds } videoPlaybackAccessToken(id: $id, params: { platform: "web", playerBackend: "mediaplayer", playerType: "site" }) { signature value } }`;
    const response = await fetch("https://gql.twitch.tv/gql", { method: "POST", headers: { "Client-ID": process.env.TWITCH_WEB_CLIENT_ID || "kimne78kx3ncx6brgo4mv6wki5h1ko", "Content-Type": "text/plain" }, body: JSON.stringify({ query, variables: { id } }) });
    const body = await response.json();
    const token = body.data?.videoPlaybackAccessToken;
    if (!token) throw new Error("Twitch não retornou token da VOD");
    const playlistUrl = `https://usher.ttvnw.net/vod/${id}.m3u8?${new URLSearchParams({ nauth: token.value, nauthsig: token.signature, allow_source: "true", player: "twitchweb" })}`;
    const playlistResponse = await fetch(playlistUrl);
    const lines = (await playlistResponse.text()).split("\n").map((line) => line.trim());
    const variants = lines.flatMap((line, index) => line.startsWith("#EXT-X-STREAM-INF") && lines[index + 1]?.startsWith("http") ? [{ info: line, url: lines[index + 1] }] : []);
    const quality = url.searchParams.get("quality");
    const variant = variants.find((item) => quality && item.info.includes(`NAME="${quality}"`)) || variants[0];
    if (!variant) throw new Error("VOD sem qualidade disponível");
    const media = await fetch(variant.url);
    const base = variant.url.slice(0, variant.url.lastIndexOf("/") + 1);
    const segments = [];
    let time = 0; let duration = 0;
    for (const line of (await media.text()).split("\n")) {
      const value = line.trim();
      if (value.startsWith("#EXTINF:")) duration = Number.parseFloat(value.slice(8));
      else if (value && !value.startsWith("#")) { if (time + duration > start && time < end) segments.push({ time, duration, url: value.startsWith("http") ? value : base + value }); time += duration; }
    }
    if (!segments.length) throw new Error("Janela fora da VOD");
    const temp = await mkdtemp(join(tmpdir(), "alfredd-vod-"));
    const list = join(temp, "window.m3u8");
    await writeFile(list, ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-TARGETDURATION:10", ...segments.flatMap((item) => [`#EXTINF:${item.duration.toFixed(3)},`, item.url]), "#EXT-X-ENDLIST", ""].join("\n"));
    try {
      const codec = url.searchParams.get("precise") === "1" ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac"] : ["-c", "copy", "-bsf:a", "aac_adtstoasc"];
      await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file,http,https,tcp,tls,crypto", "-i", list, "-ss", (start - segments[0].time).toFixed(3), "-t", (end - start).toFixed(3), ...codec, "-movflags", "+faststart", file]);
    } finally { await rm(temp, { recursive: true, force: true }); }
  });
}
async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/health") return sendJson(res, 200, { ok: true, service: "media-worker" });
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return sendJson(res, 401, { error: "unauthorized" });
  if (req.method === "POST" && url.pathname === "/youtube/transcript") {
    try { return sendJson(res, 200, await youtubeTranscript(await readRequestBody(req))); }
    catch (error) { console.error("[transcript] failed", error); return sendJson(res, 502, { error: error instanceof Error ? error.message : "transcript_failed" }); }
  }
  if (req.method !== "GET") return sendJson(res, 405, { error: "method_not_allowed" });
  const startedAt = Date.now();
  console.log(`[request] ${req.method} ${url.pathname}`);
  try {
    if (url.pathname === "/youtube/source" && url.searchParams.get("progress") === "1") return sendJson(res, 200, youtubeProgress(url));
    const media = url.pathname === "/youtube/source" ? await youtube(url) : url.pathname === "/twitch/vod" ? await twitchVod(url) : null;
    if (!media) return sendJson(res, 404, { error: "not_found" });
    if (media.redirect) { res.writeHead(307, { location: media.redirect }); return res.end(); }
    console.log(`[request] ${req.method} ${url.pathname} ready in ${Date.now() - startedAt}ms`);
    return streamFile(req, res, media.file, media.size);
  } catch (error) {
    console.error(`[request] ${req.method} ${url.pathname} failed after ${Date.now() - startedAt}ms`, error);
    return sendJson(res, 502, { error: error instanceof Error ? error.message : "media_failed" });
  }
}
http.createServer((req, res) => void handle(req, res)).listen(port, "0.0.0.0", () => console.log(`media-worker listening on ${port}`));

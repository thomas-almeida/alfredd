import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { getSession } from "@/lib/auth";
import { parseVideo } from "@/lib/youtube/parse";
import { mediaWorkerUrl, proxyMediaWorker } from "@/lib/media-worker";

export const runtime = "nodejs";
type MediaCache = { file: string; size: number; at: number; pending?: Promise<MediaCache> };
const cache = new Map<string, MediaCache>();
const mediaDirPromise = mkdir(join(tmpdir(), "alfredd-youtube-media"), { recursive: true }).then(() => join(tmpdir(), "alfredd-youtube-media"));
const directVideoCache = new Map<string, { url: string; at: number; pending?: Promise<string> }>();
/** Etapa da preparação em andamento; `processedMs` vem do `-progress` do ffmpeg. */
type MediaProgress = { stage: "resolving" | "downloading"; processedMs: number };
const progress = new Map<string, MediaProgress>();
const MEDIA_CACHE_TTL_MS = 30 * 60_000;
let lastMediaCleanup = 0;

async function cleanupMediaCache(dir: string): Promise<void> {
  if (Date.now() - lastMediaCleanup < 5 * 60_000) return;
  lastMediaCleanup = Date.now();
  const entries = await readdir(dir).catch(() => [] as string[]);
  await Promise.all(entries.filter((name) => name.endsWith(".mp4")).map(async (name) => {
    const file = join(dir, name);
    const info = await stat(file).catch(() => null);
    if (info && Date.now() - info.mtimeMs >= MEDIA_CACHE_TTL_MS) await unlink(file).catch(() => {});
  }));
}

function run(command: string, args: string[], onStdout?: (chunk: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => { out += d; onStdout?.(String(d)); });
    p.stderr.on("data", (d) => { err += d; });
    p.on("error", () => reject(new Error(`${command} não encontrado`)));
    p.on("close", (code) => code === 0 ? resolve(out) : reject(new Error(err.trim().slice(-500) || `${command} falhou`)));
  });
}

async function ytdlp(args: string[]): Promise<string> {
  const attempts: [string, string[]][] = [
    [process.env.YTDLP_PATH ?? "yt-dlp", args],
    [process.env.PYTHON_PATH ?? "python", ["-m", "yt_dlp", ...args]],
    ["py", ["-m", "yt_dlp", ...args]],
  ];
  const errors: string[] = [];
  for (const [command, commandArgs] of attempts) {
    try { return await run(command, commandArgs); }
    catch (e) { errors.push(e instanceof Error ? e.message : String(e)); }
  }
  throw new Error(errors.at(-1) ?? "yt-dlp falhou");
}

async function ytdlpWithRetry(args: string[], attempts = 2): Promise<string> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await ytdlp(args);
    } catch (error) {
      last = error;
      if (i + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw last instanceof Error ? last : new Error("yt-dlp falhou");
}

/** Trecho do vídeo em ms; sem janela, a mídia é o vídeo inteiro. */
type MediaWindow = { startMs: number; endMs: number };
const mediaKey = (videoId: string, win?: MediaWindow) => win ? `${videoId}_${win.startMs}-${win.endMs}` : videoId;

async function prepareMedia(videoId: string, win?: MediaWindow): Promise<MediaCache> {
  const key = mediaKey(videoId, win);
  const existing = cache.get(key);
  if (existing?.file && Date.now() - existing.at < MEDIA_CACHE_TTL_MS) return existing;
  if (existing?.pending) return existing.pending;

  const pending = (async () => {
    const mediaDir = await mediaDirPromise;
    await cleanupMediaCache(mediaDir);
    const output = join(mediaDir, `${key}.mp4`);
    try {
      const existingFile = await stat(output);
      if (existingFile.size > 0) {
        const result = { file: output, size: existingFile.size, at: Date.now() };
        cache.set(key, result);
        return result;
      }
    } catch {
      // O arquivo ainda não existe; continue preparando a mídia.
    }
    progress.set(key, { stage: "resolving", processedMs: 0 });
    const maxHeight = process.env.YOUTUBE_MEDIA_MAX_HEIGHT ?? "480";
    const args = ["-g", "-f", `bestvideo[ext=mp4][height<=${maxHeight}]+bestaudio[ext=m4a]/bestvideo[height<=${maxHeight}]+bestaudio/best`, "--no-warnings", `https://www.youtube.com/watch?v=${videoId}`];
    const urls = (await ytdlpWithRetry(args)).trim().split(/\r?\n/).filter(Boolean);
    if (!urls[0]) throw new Error("yt-dlp não retornou vídeo");
    const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
    // Busca antes de cada -i: o ffmpeg pede ao servidor só o trecho da janela.
    const seek = win ? ["-ss", String(win.startMs / 1000), "-t", String((win.endMs - win.startMs) / 1000)] : [];
    const ffArgs = urls[1]
      ? ["-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1", "-y", ...seek, "-i", urls[0], ...seek, "-i", urls[1], "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-movflags", "+faststart", output]
      : ["-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1", "-y", ...seek, "-i", urls[0], "-c", "copy", "-movflags", "+faststart", output];
    progress.set(key, { stage: "downloading", processedMs: 0 });
    await run(ffmpeg, ffArgs, (chunk) => {
      // out_time_us é o tempo de mídia já escrito no arquivo de saída.
      const last = [...chunk.matchAll(/out_time_us=(\d+)/g)].at(-1);
      if (last) progress.set(key, { stage: "downloading", processedMs: Math.floor(Number(last[1]) / 1000) });
    });
    const size = (await stat(output)).size;
    const result = { file: output, size, at: Date.now() };
    cache.set(key, result);
    return result;
  })();
  cache.set(key, { file: "", size: 0, at: Date.now(), pending });
  try { return await pending; } catch (error) { cache.delete(key); throw error; } finally { progress.delete(key); }
}

/** Estado da preparação, consultado pelo editor enquanto o vídeo carrega. */
function mediaStatus(key: string) {
  const entry = cache.get(key);
  if (entry?.file) return { status: "ready" as const, size: entry.size };
  const current = progress.get(key);
  if (current) return { status: current.stage, processedMs: current.processedMs };
  return { status: entry?.pending ? "resolving" as const : "idle" as const };
}

async function getDirectVideo(videoId: string, force = false): Promise<string> {
  const existing = directVideoCache.get(videoId);
  if (!force && existing && Date.now() - existing.at < 5 * 60_000) return existing.url;
  if (existing?.pending) return existing.pending;

  const pending = (async () => {
    const maxHeight = process.env.YOUTUBE_MEDIA_MAX_HEIGHT ?? "480";
    // Para a prévia, prefira um MP4 progressivo (vídeo + áudio em um URL).
    // É mais compatível no navegador do que um bestvideo separado e também
    // evita depender de duas URLs assinadas simultaneamente.
    const args = ["-g", "-f", `best[ext=mp4][height<=${maxHeight}]/best[height<=${maxHeight}]/best`, "--retries", "3", "--socket-timeout", "15", "--no-warnings", `https://www.youtube.com/watch?v=${videoId}`];
    const url = (await ytdlpWithRetry(args)).trim().split(/\r?\n/).find(Boolean);
    if (!url) throw new Error("yt-dlp não retornou vídeo");
    directVideoCache.set(videoId, { url, at: Date.now() });
    return url;
  })();
  directVideoCache.set(videoId, { url: "", at: Date.now(), pending });
  try { return await pending; } catch (error) { directVideoCache.delete(videoId); throw error; }
}

function rangeFor(range: string | null, size: number): { start: number; end: number; status: number } {
  if (!range) return { start: 0, end: size - 1, status: 200 };
  const m = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!m) return { start: 0, end: size - 1, status: 200 };
  const start = Number(m[1]);
  if (start >= size) return { start: size, end: size - 1, status: 416 };
  const end = Math.min(m[2] ? Number(m[2]) : size - 1, size - 1);
  return { start, end, status: 206 };
}

export async function GET(req: Request) {
  if (!(await getSession())) return new Response("unauthenticated", { status: 401 });
  const params = new URL(req.url).searchParams;
  const videoId = parseVideo(params.get("videoId") ?? "")?.videoId;
  if (!videoId) return new Response("invalid_video", { status: 400 });
  if (mediaWorkerUrl()) {
    return proxyMediaWorker(req, `/youtube/source?${params.toString()}`);
  }
  let win: MediaWindow | undefined;
  if (params.has("start") || params.has("end")) {
    const startMs = Number(params.get("start"));
    const endMs = Number(params.get("end"));
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || startMs < 0 || endMs <= startMs) return new Response("invalid_window", { status: 400 });
    win = { startMs, endMs };
  }
  if (params.get("progress") === "1") return Response.json(mediaStatus(mediaKey(videoId, win)), { headers: { "Cache-Control": "no-store" } });
  try {
    if (params.get("audio") === "0") {
      const url = await getDirectVideo(videoId, params.get("refresh") === "1");
      return Response.redirect(url, 307);
    }
    const media = await prepareMedia(videoId, win);
    const range = rangeFor(req.headers.get("range"), media.size);
    if (range.status === 416) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${media.size}`, "Accept-Ranges": "bytes" },
      });
    }
    const body = Readable.toWeb(createReadStream(media.file, { start: range.start, end: range.end })) as ReadableStream<Uint8Array>;
    const headers = new Headers({ "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Length": String(range.end - range.start + 1), "Cache-Control": "private, max-age=1800" });
    if (range.status === 206) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${media.size}`);
    return new Response(body, { status: range.status, headers });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "media_failed", { status: 502 });
  }
}

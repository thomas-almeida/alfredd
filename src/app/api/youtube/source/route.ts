import { spawn } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getSession } from "@/lib/auth";
import { parseVideo } from "@/lib/youtube/parse";

export const runtime = "nodejs";
type MediaCache = { file: string; size: number; at: number; pending?: Promise<MediaCache> };
const cache = new Map<string, MediaCache>();
const mediaDirPromise = mkdir(join(tmpdir(), "alfredd-youtube-media"), { recursive: true }).then(() => join(tmpdir(), "alfredd-youtube-media"));
const directVideoCache = new Map<string, { url: string; at: number; pending?: Promise<string> }>();

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(command, args);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => { out += d; });
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

async function prepareMedia(videoId: string): Promise<MediaCache> {
  const existing = cache.get(videoId);
  if (existing?.file && Date.now() - existing.at < 30 * 60_000) return existing;
  if (existing?.pending) return existing.pending;

  const pending = (async () => {
    const mediaDir = await mediaDirPromise;
    const output = join(mediaDir, `${videoId}.mp4`);
    try {
      const existingFile = await stat(output);
      if (existingFile.size > 0) {
        const result = { file: output, size: existingFile.size, at: Date.now() };
        cache.set(videoId, result);
        return result;
      }
    } catch {
      // O arquivo ainda não existe; continue preparando a mídia.
    }
    const maxHeight = process.env.YOUTUBE_MEDIA_MAX_HEIGHT ?? "480";
    const args = ["-g", "-f", `bestvideo[ext=mp4][height<=${maxHeight}]+bestaudio[ext=m4a]/bestvideo[height<=${maxHeight}]+bestaudio/best`, "--no-warnings", `https://www.youtube.com/watch?v=${videoId}`];
    const urls = (await ytdlp(args)).trim().split(/\r?\n/).filter(Boolean);
    if (!urls[0]) throw new Error("yt-dlp não retornou vídeo");
    const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
    const ffArgs = urls[1]
      ? ["-hide_banner", "-loglevel", "error", "-y", "-i", urls[0], "-i", urls[1], "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-movflags", "+faststart", output]
      : ["-hide_banner", "-loglevel", "error", "-y", "-i", urls[0], "-c", "copy", "-movflags", "+faststart", output];
    await run(ffmpeg, ffArgs);
    const size = (await stat(output)).size;
    const result = { file: output, size, at: Date.now() };
    cache.set(videoId, result);
    return result;
  })();
  cache.set(videoId, { file: "", size: 0, at: Date.now(), pending });
  try { return await pending; } catch (error) { cache.delete(videoId); throw error; }
}

async function getDirectVideo(videoId: string): Promise<string> {
  const existing = directVideoCache.get(videoId);
  if (existing && Date.now() - existing.at < 5 * 60_000) return existing.url;
  if (existing?.pending) return existing.pending;

  const pending = (async () => {
    const maxHeight = process.env.YOUTUBE_MEDIA_MAX_HEIGHT ?? "480";
    const args = ["-g", "-f", `bestvideo[ext=mp4][height<=${maxHeight}]/bestvideo[height<=${maxHeight}]/bestvideo/best`, "--no-warnings", `https://www.youtube.com/watch?v=${videoId}`];
    const url = (await ytdlp(args)).trim().split(/\r?\n/).find(Boolean);
    if (!url) throw new Error("yt-dlp nÃ£o retornou vÃ­deo");
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
  const end = Math.min(m[2] ? Number(m[2]) : size - 1, size - 1);
  return { start, end, status: 206 };
}

export async function GET(req: Request) {
  if (!(await getSession())) return new Response("unauthenticated", { status: 401 });
  const raw = new URL(req.url).searchParams.get("videoId") ?? "";
  const videoId = parseVideo(raw)?.videoId;
  if (!videoId) return new Response("invalid_video", { status: 400 });
  try {
    if (new URL(req.url).searchParams.get("audio") === "0") {
      const url = await getDirectVideo(videoId);
      return Response.redirect(url, 307);
    }
    const media = await prepareMedia(videoId);
    const range = rangeFor(req.headers.get("range"), media.size);
    const bytes = await readFile(media.file);
    const body = bytes.subarray(range.start, range.end + 1);
    const headers = new Headers({ "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Length": String(body.byteLength), "Cache-Control": "private, max-age=1800" });
    if (range.status === 206) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${media.size}`);
    return new Response(body, { status: range.status, headers });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "media_failed", { status: 502 });
  }
}

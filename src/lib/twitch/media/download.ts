import "server-only";

// Parte de servidor do download: repasse do MP4 do clip e corte de VOD com ffmpeg.
// Só roda no runtime Node.js (spawn + fs). Nas rotas: export const runtime = "nodejs".
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { TwitchError } from "./gql.ts";
import { buildWindowPlaylist, getSegments, selectWindow } from "./vod.ts";

const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
export const MAX_VOD_WINDOW_SECONDS = Number(process.env.MAX_VOD_WINDOW_SECONDS ?? 3 * 60 * 60); // igual ao untwitch: 3 h

/**
 * Clip: repassa o MP4 do CDN da Twitch, com suporte a Range (player pula no tempo).
 * Não grava nada em disco.
 */
export async function proxyClipMp4(signedUrl: string, range?: string | null): Promise<Response> {
  const upstream = await fetch(signedUrl, { headers: range ? { Range: range } : {}, cache: "no-store" });
  if (!upstream.ok && upstream.status !== 206) {
    throw new TwitchError(`CDN do clip HTTP ${upstream.status} (token expirado?)`, 502);
  }
  const headers = new Headers({
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=300",
  });
  for (const h of ["content-length", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

export type VodCutOptions = {
  variantUrl: string; // index-dvr.m3u8 da qualidade escolhida
  start: number; // segundos
  end: number; // segundos
  /** true = reencoda (corte no frame exato, mais CPU). false = -c copy (rápido, corta no keyframe). */
  precise?: boolean;
};

/**
 * VOD: monta uma playlist só com os segmentos da janela e deixa o ffmpeg juntar
 * e cortar. Saída em MP4 fragmentado no stdout, para transmitir sem esperar o fim.
 */
export async function cutVodStream(
  opts: VodCutOptions,
): Promise<{ stream: ReadableStream<Uint8Array>; done: Promise<void> }> {
  const { variantUrl, start, end, precise = false } = opts;
  if (end - start > MAX_VOD_WINDOW_SECONDS) {
    throw new TwitchError(`Janela maior que ${MAX_VOD_WINDOW_SECONDS / 3600} h`, 400);
  }
  const segs = await getSegments(variantUrl);
  const { segments, trimStart, duration } = selectWindow(segs, start, end);

  const dir = await mkdtemp(join(tmpdir(), "vod-"));
  const list = join(dir, "window.m3u8");
  await writeFile(list, buildWindowPlaylist(segments));

  const codec = precise
    ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k"]
    : ["-c", "copy", "-bsf:a", "aac_adtstoasc"];

  const ff = spawn(FFMPEG, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-protocol_whitelist",
    "file,http,https,tcp,tls,crypto",
    "-i",
    list,
    "-ss",
    trimStart.toFixed(3),
    "-t",
    duration.toFixed(3),
    ...codec,
    "-movflags",
    "frag_keyframe+empty_moov+default_base_moof",
    "-f",
    "mp4",
    "pipe:1",
  ]);

  let stderr = "";
  ff.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
  const done = new Promise<void>((resolve, reject) => {
    const finish = async (err: Error | null) => {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
      if (err) reject(err);
      else resolve();
    };
    // ffmpeg ausente do PATH dispara "error" (e não "close" com código).
    ff.on("error", (e) => void finish(new TwitchError(`Não foi possível executar o ffmpeg: ${e.message}`, 500)));
    ff.on("close", (code) =>
      void finish(code === 0 ? null : new TwitchError(`ffmpeg saiu com ${code}: ${stderr.slice(-400)}`, 500)),
    );
  });
  done.catch(() => {}); // o chamador decide se aguarda

  return { stream: Readable.toWeb(ff.stdout) as ReadableStream<Uint8Array>, done };
}

/** Versão que grava em arquivo (para depois subir no Supabase Storage). */
export async function cutVodToFile(opts: VodCutOptions & { outFile: string }): Promise<void> {
  const { stream, done } = await cutVodStream(opts);
  await pipeline(Readable.fromWeb(stream as never), createWriteStream(opts.outFile));
  await done;
}

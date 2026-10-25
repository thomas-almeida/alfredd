import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  cachedVodCut,
  parseTwitchUrl,
  pickClipQuality,
  pickVariant,
  proxyClipMp4,
  resolveClip,
  resolveVod,
  TwitchError,
} from "@/lib/twitch/media";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { mediaWorkerUrl, proxyMediaWorker } from "@/lib/media-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Corte de VOD com ffmpeg pode demorar; exige servidor Node de longa duração.
export const maxDuration = 300;

/** Nome de arquivo seguro para Content-Disposition. */
function safeName(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^\w.-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 80) || "twitch"
  );
}

function rangeFor(range: string | null, size: number): { start: number; end: number; status: number } {
  if (!range) return { start: 0, end: size - 1, status: 200 };
  const match = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!match) return { start: 0, end: size - 1, status: 200 };
  const start = Number(match[1]);
  if (start >= size) return { start: size, end: size - 1, status: 416 };
  const end = Math.min(match[2] ? Number(match[2]) : size - 1, size - 1);
  return { start, end, status: 206 };
}

// GET /api/twitch/download?url=<link>
//   Clip: &quality=1080 &orientation=portrait  (repassa Range para o player)
//   VOD:  &start=<s> &end=<s> &quality=<nome da variante> &precise=1
//   &dl=0 para tocar inline em vez de baixar.
export async function GET(req: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const ref = parseTwitchUrl(sp.get("url") ?? "");
  if (!ref) return NextResponse.json({ error: "Link da Twitch inválido" }, { status: 400 });
  const attachment = sp.get("dl") !== "0";

  // Clips continuam sendo proxyados localmente; VODs com ffmpeg vão para o worker.
  if (ref.kind === "vod" && mediaWorkerUrl()) {
    const workerParams = new URLSearchParams({ id: ref.id, start: sp.get("start") ?? "", end: sp.get("end") ?? "" });
    for (const key of ["quality", "precise"]) {
      const value = sp.get(key);
      if (value) workerParams.set(key, value);
    }
    const response = await proxyMediaWorker(req, `/twitch/vod?${workerParams.toString()}`);
    if (attachment) response.headers.set("Content-Disposition", `attachment; filename="twitch-vod-${ref.id}.mp4"`);
    return response;
  }

  try {
    if (ref.kind === "clip") {
      const clip = await resolveClip(ref.slug);
      const list = sp.get("orientation") === "portrait" && clip.portrait.length ? clip.portrait : clip.landscape;
      const wanted = sp.get("quality");
      const q = (wanted && list.find((x) => x.quality === wanted)) || (list.length ? pickClipQuality(list) : null);
      if (!q) return NextResponse.json({ error: "Clip sem qualidades disponíveis" }, { status: 404 });

      const res = await proxyClipMp4(q.url, req.headers.get("range"));
      if (attachment) {
        res.headers.set("Content-Disposition", `attachment; filename="${safeName(clip.title)}-${q.quality}p.mp4"`);
      }
      return res;
    }

    const startRaw = sp.get("start");
    const endRaw = sp.get("end");
    const start = Number(startRaw ?? 0);
    const end = Number(endRaw);
    if (!endRaw || !Number.isFinite(start) || !Number.isFinite(end) || start < 0) {
      return NextResponse.json({ error: "Informe start e end (segundos)" }, { status: 400 });
    }

    const vod = await resolveVod(ref.id);
    const wanted = sp.get("quality");
    const variant = (wanted && vod.variants.find((v) => v.name === wanted)) || pickVariant(vod.variants);
    const clampedEnd = vod.lengthSeconds > 0 ? Math.min(end, vod.lengthSeconds) : end;

    const precise = sp.get("precise") === "1";
    const cached = await cachedVodCut({
      variantUrl: variant.url,
      start,
      end: clampedEnd,
      precise,
      cacheKey: `${ref.id}:${variant.name}:${start.toFixed(3)}-${clampedEnd.toFixed(3)}:${precise ? "precise" : "copy"}`,
    });

    const range = rangeFor(req.headers.get("range"), cached.size);
    if (range.status === 416) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${cached.size}`, "Accept-Ranges": "bytes" },
      });
    }
    const stream = Readable.toWeb(createReadStream(cached.file, { start: range.start, end: range.end })) as ReadableStream<Uint8Array>;
    const headers = new Headers({
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Content-Length": String(range.end - range.start + 1),
      "Cache-Control": "private, max-age=1800",
    });
    if (range.status === 206) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${cached.size}`);
    if (attachment) {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${safeName(vod.title)}-${Math.floor(start)}-${Math.floor(clampedEnd)}.mp4"`,
      );
    }
    return new Response(stream, { status: range.status, headers });
  } catch (err) {
    const status = err instanceof TwitchError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao baixar da Twitch";
    return NextResponse.json({ error: message }, { status });
  }
}

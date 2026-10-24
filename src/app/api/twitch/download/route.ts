import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  cutVodStream,
  parseTwitchUrl,
  pickClipQuality,
  pickVariant,
  proxyClipMp4,
  resolveClip,
  resolveVod,
  TwitchError,
} from "@/lib/twitch/media";

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

    const { stream } = await cutVodStream({
      variantUrl: variant.url,
      start,
      end: clampedEnd,
      precise: sp.get("precise") === "1",
    });

    const headers = new Headers({ "Content-Type": "video/mp4", "Cache-Control": "no-store" });
    if (attachment) {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${safeName(vod.title)}-${Math.floor(start)}-${Math.floor(clampedEnd)}.mp4"`,
      );
    }
    return new Response(stream, { headers });
  } catch (err) {
    const status = err instanceof TwitchError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao baixar da Twitch";
    return NextResponse.json({ error: message }, { status });
  }
}

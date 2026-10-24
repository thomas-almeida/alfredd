import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseTwitchUrl, resolveClip, resolveVod, TwitchError, type ClipQuality } from "@/lib/twitch/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/twitch/resolve?url=<link de clip ou VOD>
// Devolve metadados e qualidades disponíveis. As URLs assinadas ficam no servidor:
// o download passa por /api/twitch/download.
export async function GET(req: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const input = new URL(req.url).searchParams.get("url") ?? "";
  const ref = parseTwitchUrl(input);
  if (!ref) return NextResponse.json({ error: "Link da Twitch inválido" }, { status: 400 });

  try {
    if (ref.kind === "clip") {
      const clip = await resolveClip(ref.slug);
      const strip = ({ url: _url, ...q }: ClipQuality) => q;
      return NextResponse.json({
        kind: "clip",
        ...clip,
        landscape: clip.landscape.map(strip),
        portrait: clip.portrait.map(strip),
      });
    }
    const vod = await resolveVod(ref.id);
    return NextResponse.json({
      kind: "vod",
      ...vod,
      variants: vod.variants.map(({ url: _url, ...v }) => v),
    });
  } catch (err) {
    const status = err instanceof TwitchError ? err.status : 500;
    const message = err instanceof Error ? err.message : "Erro ao consultar a Twitch";
    return NextResponse.json({ error: message }, { status });
  }
}

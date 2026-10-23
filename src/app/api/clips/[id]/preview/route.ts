import { NextResponse } from "next/server";
import { resolveClipMp4 } from "@/lib/twitch/resolve-clip";

export const runtime = "nodejs";

/**
 * URL assinada do MP4 do clipe para preview direto num <video>, sem o embed
 * da Twitch (que exige login para canais adultos). Nada é baixado/armazenado.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const { url } = await resolveClipMp4(id);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "resolve_failed" },
      { status: 502 },
    );
  }
}

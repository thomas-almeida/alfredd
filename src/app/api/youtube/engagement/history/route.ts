import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSnapshotHistory } from "@/lib/youtube/snapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/youtube/engagement/history?kind=video|channel&id=<videoId ou channelId>&days=90
// Pontos da curva de ER em ordem cronológica (sem custo de cota: lê só do banco).
export async function GET(req: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  const kind = sp.get("kind");
  const id = (sp.get("id") ?? "").trim();
  if ((kind !== "video" && kind !== "channel") || !/^[\w-]{6,40}$/.test(id)) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }
  const days = Math.min(Math.max(Number.parseInt(sp.get("days") ?? "90", 10) || 90, 1), 365);

  try {
    const points = await getSnapshotHistory(kind, id, days);
    return NextResponse.json({ kind, id, days, points });
  } catch {
    return NextResponse.json({ error: "Erro ao ler o histórico" }, { status: 500 });
  }
}

import { after, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getChannelEngagement, YouTubeError } from "@/lib/youtube";
import { recordSnapshot } from "@/lib/youtube/snapshots";
import { getUsdBrlRate } from "@/lib/finance/exchange-rate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function int(v: string | null): number | undefined {
  if (v === null || v === "") return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

// GET /api/youtube/engagement/channel?url=<canal, @handle ou vídeo>
//   &max=20 &minAgeHours=48 &maxAgeDays=90 &videos=0 (omite a lista por vídeo)
// Custo típico: 3 unidades de cota (+100 se o link for /c/ legado).
export async function GET(req: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const sp = new URL(req.url).searchParams;
  try {
    const data = await getChannelEngagement(sp.get("url") ?? "", {
      maxVideos: int(sp.get("max")),
      minAgeHours: int(sp.get("minAgeHours")),
      maxAgeDays: int(sp.get("maxAgeDays")),
    });
    const exchange = await getUsdBrlRate();
    data.estimatedRevenueBrl = exchange ? Number((data.estimatedRevenueUsd * exchange.rate).toFixed(2)) : null;
    data.usdBrlRate = exchange?.rate ?? null;
    data.revenueRateUpdatedAt = exchange?.updatedAt ?? null;
    data.videos = data.videos.map((video) => ({
      ...video,
      estimatedRevenueBrl: exchange ? Number((video.estimatedRevenueUsd * exchange.rate).toFixed(2)) : null,
    }));
    after(() =>
      recordSnapshot(
        "channel",
        data.channelId,
        { er: data.all.erWeighted, views: data.totalViews, subscribers: data.subscribers },
        { ...data, videos: undefined },
      ),
    );
    const body = sp.get("videos") === "0" ? { ...data, videos: undefined } : data;
    return NextResponse.json(body, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (err) {
    if (err instanceof YouTubeError) {
      return NextResponse.json({ error: err.message, reason: err.reason }, { status: err.status });
    }
    return NextResponse.json({ error: "Erro ao consultar o YouTube" }, { status: 500 });
  }
}

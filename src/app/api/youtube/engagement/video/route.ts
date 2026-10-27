import { after, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getVideoEngagement, YouTubeError } from "@/lib/youtube";
import { recordSnapshot } from "@/lib/youtube/snapshots";
import { getUsdBrlRate } from "@/lib/finance/exchange-rate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/youtube/engagement/video?url=<link, Short ou ID>  (1 unidade de cota)
export async function GET(req: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const input = new URL(req.url).searchParams.get("url") ?? "";
  try {
    const data = await getVideoEngagement(input);
    const exchange = await getUsdBrlRate();
    data.estimatedRevenueBrl = exchange ? Number((data.estimatedRevenueUsd * exchange.rate).toFixed(2)) : null;
    data.usdBrlRate = exchange?.rate ?? null;
    data.revenueRateUpdatedAt = exchange?.updatedAt ?? null;
    after(() =>
      recordSnapshot(
        "video",
        data.videoId,
        { er: data.er, views: data.views, likes: data.likes, comments: data.comments },
        data,
      ),
    );
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (err) {
    if (err instanceof YouTubeError) {
      return NextResponse.json({ error: err.message, reason: err.reason }, { status: err.status });
    }
    return NextResponse.json({ error: "Erro ao consultar o YouTube" }, { status: 500 });
  }
}

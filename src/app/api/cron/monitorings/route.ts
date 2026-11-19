import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { collectTwitchAlerts } from "@/lib/monitoring/twitch";

export const runtime = "nodejs";
// Paginar os clipes da Twitch de várias fontes + gravar entregas pode passar dos
// 15s padrão da Vercel; 60s é seguro tanto no Hobby quanto no Pro.
export const maxDuration = 60;

async function run(request: Request) {
  const secret = getServerEnv().CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await collectTwitchAlerts()) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;

import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { collectTwitchAlerts } from "@/lib/monitoring/twitch";

export const runtime = "nodejs";

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

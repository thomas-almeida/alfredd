import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMetaInsights, MetaAdsPermissionError } from "@/lib/meta/ads";

export const dynamic = "force-dynamic";

function isDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  if (!isDate(since) || !isDate(until) || since > until) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }

  try {
    return NextResponse.json(await getMetaInsights({ since, until }));
  } catch (error) {
    console.error("Meta Insights request failed", error);
    if (error instanceof MetaAdsPermissionError) {
      return NextResponse.json(
        { error: "O token da Meta não tem ads_read para esta conta. Configure META_ADS_ACCESS_TOKEN com um token do app de Ads." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível consultar os dados da Meta agora." },
      { status: 502 },
    );
  }
}

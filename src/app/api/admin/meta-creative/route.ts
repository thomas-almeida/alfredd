import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMetaCreative, MetaAdsPermissionError } from "@/lib/meta/ads";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

  const adId = new URL(request.url).searchParams.get("adId")?.trim();
  if (!adId || !/^\d+$/.test(adId)) {
    return NextResponse.json({ error: "Anúncio inválido." }, { status: 400 });
  }

  try {
    return NextResponse.json(await getMetaCreative(adId));
  } catch (error) {
    console.error("Meta creative request failed", error);
    if (error instanceof MetaAdsPermissionError) {
      return NextResponse.json(
        { error: "O token da Meta não tem ads_read para esta conta. Configure META_ADS_ACCESS_TOKEN com um token do app de Ads." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível carregar o criativo da Meta agora." },
      { status: 502 },
    );
  }
}

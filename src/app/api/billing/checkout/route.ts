import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getBillingProvider } from "@/lib/billing/abacatepay";

export const dynamic = "force-dynamic";

/** Inicia o checkout PIX do AbacatePay para o plano escolhido e devolve a URL. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (session.isPro) return NextResponse.json({ error: "already_pro" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  const plan = body.plan === "lifetime" ? "lifetime" : body.plan === "monthly" ? "monthly" : null;
  if (!plan) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });

  const origin = new URL(req.url).origin;
  let checkout;
  try {
    checkout = await getBillingProvider().createCheckout({
      userId: session.userId,
      plan,
      returnUrl: `${origin}/assinatura`,
      completionUrl: `${origin}/assinatura?pago=1`,
    });
  } catch (err) {
    console.error("[billing] createCheckout falhou", err);
    return NextResponse.json({ error: "checkout_failed" }, { status: 502 });
  }

  // Registra a cobrança como pendente; o webhook confirma e ativa o PRO.
  const supabase = await createClient();
  await supabase.from("subscriptions").upsert(
    {
      user_id: session.userId,
      plan: "pro",
      status: "pending",
      provider: "abacatepay",
      external_id: checkout.externalId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return NextResponse.json({ url: checkout.url });
}

import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingProvider } from "@/lib/billing/abacatepay";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

/**
 * Webhook do AbacatePay. Valida o segredo (query `webhookSecret`, com fallback no
 * corpo p/ sandbox), e em pagamento confirmado ativa o PRO de forma idempotente.
 */
export async function POST(req: Request) {
  const { ABACATEPAY_WEBHOOK } = getServerEnv();
  const url = new URL(req.url);
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  const provided =
    url.searchParams.get("webhookSecret") ??
    (payload && typeof payload.webhookSecret === "string" ? payload.webhookSecret : undefined);
  if (!ABACATEPAY_WEBHOOK || provided !== ABACATEPAY_WEBHOOK) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await getBillingProvider().handleWebhook(payload);
  if (!result.handled || !result.paid || !result.userId || !result.plan || !result.eventId) {
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();

  // Idempotência: a unique (provider, external_id) barra reprocessar o evento.
  const { error: eventErr } = await admin.from("billing_events").insert({
    provider: "abacatepay",
    external_id: result.eventId,
    type: result.type ?? "paid",
    payload: (payload ?? {}) as unknown as Json,
    processed_at: new Date().toISOString(),
  });
  if (eventErr) {
    if (eventErr.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    console.error("[billing] falha ao gravar billing_event", eventErr);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const currentPeriodEnd =
    result.plan === "lifetime" ? null : new Date(Date.now() + 30 * DAY_MS).toISOString();

  await admin.from("subscriptions").upsert(
    {
      user_id: result.userId,
      plan: "pro",
      status: "active",
      provider: "abacatepay",
      external_id: result.billingId,
      current_period_end: currentPeriodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  await admin.from("profiles").update({ plan: "pro" }).eq("id", result.userId);

  return NextResponse.json({ received: true });
}

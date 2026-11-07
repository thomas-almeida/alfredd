import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function leadId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `lead_${stamp}_${randomUUID()}`;
}

export async function POST(request: Request) {
  let body: { name?: unknown; email?: unknown; whatsapp?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const whatsapp = String(body.whatsapp ?? "").trim();
  if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Informe um nome válido." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  if (whatsapp.length < 8 || whatsapp.length > 40) return NextResponse.json({ error: "Informe um WhatsApp válido." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("lp_leads").insert({ lead_id: leadId(), name, email, whatsapp });
  if (error) {
    console.error("[leads] insert failed", error);
    return NextResponse.json({ error: "Não foi possível registrar seus dados." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

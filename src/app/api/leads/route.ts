import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMetaLead } from "@/lib/meta/conversions";

export const runtime = "nodejs";

type MetaAttribution = {
  fbp?: unknown;
  fbc?: unknown;
  fbclid?: unknown;
};

function leadId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `lead_${stamp}_${randomUUID()}`;
}

export async function POST(request: Request) {
  let body: { name?: unknown; email?: unknown; whatsapp?: unknown; eventId?: unknown; attribution?: MetaAttribution };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const whatsapp = String(body.whatsapp ?? "").trim();
  const eventId = String(body.eventId ?? "").trim();
  const attribution = body.attribution ?? {};
  const fbp = typeof attribution.fbp === "string" ? attribution.fbp.trim().slice(0, 200) : null;
  const fbc = typeof attribution.fbc === "string" ? attribution.fbc.trim().slice(0, 200) : null;
  const fbclid = typeof attribution.fbclid === "string" ? attribution.fbclid.trim().slice(0, 500) : null;
  if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Informe um nome válido." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  if (whatsapp.length < 8 || whatsapp.length > 40) return NextResponse.json({ error: "Informe um WhatsApp válido." }, { status: 400 });

  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(eventId)) return NextResponse.json({ error: "Evento inválido." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("lp_leads").insert({
    lead_id: leadId(),
    name,
    email,
    whatsapp,
    fbp,
    fbc,
    fbclid,
  });
  if (error) {
    console.error("[leads] insert failed", error);
    return NextResponse.json({ error: "Não foi possível registrar seus dados." }, { status: 500 });
  }
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(eventId)) return NextResponse.json({ error: "Evento de conversão inválido." }, { status: 400 });
  try {
    await sendMetaLead({ eventId, name, email, whatsapp, fbp, fbc, request });
  } catch (metaError) {
    console.error("[meta] lead conversion failed", metaError);
  }
  return NextResponse.json({ ok: true });
}

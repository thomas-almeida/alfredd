import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMetaLead } from "@/lib/meta/conversions";
import { normalizeWhatsapp, validateLeadFields } from "@/lib/leads/validation";

export const runtime = "nodejs";

type MetaAttribution = {
  fbp?: unknown;
  fbc?: unknown;
  fbclid?: unknown;
  utmSource?: unknown; utmMedium?: unknown; utmCampaign?: unknown; utmContent?: unknown; utmTerm?: unknown;
  campaignId?: unknown; campaignName?: unknown; adsetId?: unknown; adsetName?: unknown;
  adId?: unknown; adName?: unknown; placement?: unknown; siteSourceName?: unknown;
};

function leadId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `lead_${stamp}_${randomUUID()}`;
}

export async function POST(request: Request) {
  let body: { name?: unknown; email?: unknown; whatsapp?: unknown; website?: unknown; eventId?: unknown; attribution?: MetaAttribution };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const whatsapp = String(body.whatsapp ?? "").trim();
  const website = String(body.website ?? "").trim();
  const eventId = String(body.eventId ?? "").trim();
  const attribution = body.attribution ?? {};
  const fbp = typeof attribution.fbp === "string" ? attribution.fbp.trim().slice(0, 200) : null;
  const fbc = typeof attribution.fbc === "string" ? attribution.fbc.trim().slice(0, 200) : null;
  const fbclid = typeof attribution.fbclid === "string" ? attribution.fbclid.trim().slice(0, 500) : null;
  const text = (value: unknown, max = 300) => typeof value === "string" ? value.trim().slice(0, max) || null : null;
  const campaign = {
    utm_source: text(attribution.utmSource), utm_medium: text(attribution.utmMedium),
    utm_campaign: text(attribution.utmCampaign), utm_content: text(attribution.utmContent), utm_term: text(attribution.utmTerm),
    campaign_id: text(attribution.campaignId, 100), campaign_name: text(attribution.campaignName),
    adset_id: text(attribution.adsetId, 100), adset_name: text(attribution.adsetName),
    ad_id: text(attribution.adId, 100), ad_name: text(attribution.adName),
    placement: text(attribution.placement, 100), site_source_name: text(attribution.siteSourceName, 100),
  };
  if (website) return NextResponse.json({ error: "Não foi possível registrar seus dados." }, { status: 400 });
  const validationError = validateLeadFields({ name, email, whatsapp });
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  const normalizedWhatsapp = normalizeWhatsapp(whatsapp);

  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(eventId)) return NextResponse.json({ error: "Evento inválido." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("lp_leads").insert({
    lead_id: leadId(),
    name,
    email,
    whatsapp: normalizedWhatsapp,
    fbp,
    fbc,
    fbclid,
    ...campaign,
  });
  if (error) {
    console.error("[leads] insert failed", error);
    return NextResponse.json({ error: "Não foi possível registrar seus dados." }, { status: 500 });
  }
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(eventId)) return NextResponse.json({ error: "Evento de conversão inválido." }, { status: 400 });
  try {
    await sendMetaLead({ eventId, name, email, whatsapp: normalizedWhatsapp, fbp, fbc, request });
  } catch (metaError) {
    console.error("[meta] lead conversion failed", metaError);
  }
  return NextResponse.json({ ok: true });
}

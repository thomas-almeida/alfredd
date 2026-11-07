import { createHash } from "node:crypto";
import { getServerEnv } from "@/lib/env";

function hash(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export async function sendMetaLead({ eventId, name, email, whatsapp, request }: {
  eventId: string;
  name: string;
  email: string;
  whatsapp: string;
  request: Request;
}) {
  const env = getServerEnv();
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId || !env.META_ACCESS_TOKEN) return;

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const sourceUrl = new URL("/lp", process.env.NEXT_PUBLIC_APP_URL ?? "https://clipesalfredd.top").toString();
  const userData: Record<string, unknown> = {
    em: [hash(email)],
    ph: [hash(whatsapp.replace(/\D/g, ""))],
    fn: [hash(name)],
    client_user_agent: request.headers.get("user-agent") ?? undefined,
  };
  if (forwardedFor) userData.client_ip_address = forwardedFor;

  const version = env.META_GRAPH_API_VERSION ?? "v21.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${pixelId}/events?access_token=${encodeURIComponent(env.META_ACCESS_TOKEN)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [{
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: sourceUrl,
        user_data: userData,
        custom_data: { lead_source: "gta_vi_lp" },
      }],
    }),
  });
  if (!response.ok) throw new Error(`Meta Conversions API returned ${response.status}`);
}

import { redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadAccessButton } from "@/features/admin/LeadAccessButton";

export const metadata = { title: "Leads" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return <div><dt className="text-xs uppercase tracking-wide text-muted">{label}</dt><dd className="mt-1 break-all text-sm text-fg">{value}</dd></div>;
}

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/admin");
  if (!session.isAdmin) redirect("/");

  const admin = createAdminClient();
  const { data: leads, error } = await admin
    .from("lp_leads")
    .select("lead_id,name,email,whatsapp,fbp,fbc,fbclid,utm_source,utm_medium,utm_campaign,utm_content,utm_term,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,placement,site_source_name,created_at,access_granted")
    .order("created_at", { ascending: false });

  return (
    <AppShell crumbs={[{ label: "Admin" }, { label: "Leads" }]} wide>
      <PageHeader title="Leads da landing page" badges={<Badge tone="accent">ADMIN</Badge>} subtitle={`${leads?.length ?? 0} contatos capturados`} />
      <div className="space-y-3">
        {error ? <p className="rounded-lg border border-border bg-surface p-6 text-sm text-danger">Não foi possível carregar os leads.</p> : leads?.length ? leads.map((lead) => (
          <details key={lead.lead_id} className="group rounded-xl border border-border bg-surface open:border-accent/40">
            <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent transition-transform group-open:rotate-90">›</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-fg">{lead.name}</span>
                <span className="mt-1 block truncate text-sm text-muted">{lead.email}</span>
              </span>
              <span className="hidden text-sm text-muted sm:block">{formatDate(lead.created_at)}</span>
            </summary>
            <div className="border-t border-border px-5 py-5">
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <div><dt className="text-xs uppercase tracking-wide text-muted">Criado em</dt><dd className="mt-1 text-sm text-fg">{formatDate(lead.created_at)}</dd></div>
                <Detail label="E-mail" value={lead.email} />
                <Detail label="WhatsApp" value={lead.whatsapp} />
                <Detail label="Lead ID" value={lead.lead_id} />
                <Detail label="Campanha" value={lead.campaign_name ?? lead.campaign_id} />
                <Detail label="Conjunto de anúncios" value={lead.adset_name ?? lead.adset_id} />
                <Detail label="Anúncio / criativo" value={lead.ad_name ?? lead.ad_id} />
                <Detail label="Posicionamento" value={lead.placement ?? lead.site_source_name} />
                <Detail label="UTM source / medium" value={[lead.utm_source, lead.utm_medium].filter(Boolean).join(" / ") || null} />
                <Detail label="UTM campaign" value={lead.utm_campaign} />
                <Detail label="UTM content" value={lead.utm_content} />
                <Detail label="UTM term" value={lead.utm_term} />
                <Detail label="fbclid" value={lead.fbclid} />
                <Detail label="fbc" value={lead.fbc} />
                <Detail label="fbp" value={lead.fbp} />
              </div>
              <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-4">
                <span className="text-sm text-muted">{lead.fbclid ? "Origem: Facebook/Instagram" : "Origem: orgânica ou direta"}</span>
                <LeadAccessButton leadId={lead.lead_id} granted={lead.access_granted} />
              </div>
            </div>
          </details>
        )) : <p className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">Nenhum lead capturado ainda.</p>}
      </div>
    </AppShell>
  );
}

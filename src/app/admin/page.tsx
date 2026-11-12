import { redirect } from "next/navigation";
import { AdminLeadsPanel, type AdminLead } from "@/features/admin/AdminLeadsPanel";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Leads" };

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
      <PageHeader title="Resultado da Landing Page" subtitle="Acompanhe aquisição, origem e detalhes dos contatos capturados." />
      {error ? <p className="rounded-lg border border-danger/30 bg-danger/10 p-6 text-sm text-danger">Não foi possível carregar os leads.</p> : <AdminLeadsPanel leads={(leads ?? []) as AdminLead[]} />}
    </AppShell>
  );
}

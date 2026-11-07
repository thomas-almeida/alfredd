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

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/admin");
  if (!session.isAdmin) redirect("/");

  const admin = createAdminClient();
  const { data: leads, error } = await admin
    .from("lp_leads")
    .select("lead_id,name,email,whatsapp,created_at,access_granted")
    .order("created_at", { ascending: false });

  return (
    <AppShell crumbs={[{ label: "Admin" }, { label: "Leads" }]} wide>
      <PageHeader title="Leads da landing page" badges={<Badge tone="accent">ADMIN</Badge>} subtitle={`${leads?.length ?? 0} contatos capturados`} />
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        {error ? (
          <p className="p-6 text-sm text-danger">Não foi possível carregar os leads.</p>
        ) : leads?.length ? (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-surface-2 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Criado em</th>
                <th className="px-4 py-3">Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((lead) => (
                <tr key={lead.lead_id} className="hover:bg-surface-2/50">
                  <td className="px-4 py-4"><div className="font-medium text-fg">{lead.name}</div><div className="mt-1 font-mono text-[11px] text-muted">{lead.lead_id}</div></td>
                  <td className="px-4 py-4"><div>{lead.email}</div><div className="mt-1 text-muted">{lead.whatsapp}</div></td>
                  <td className="whitespace-nowrap px-4 py-4 text-muted">{formatDate(lead.created_at)}</td>
                  <td className="px-4 py-4"><LeadAccessButton leadId={lead.lead_id} granted={lead.access_granted} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="p-6 text-sm text-muted">Nenhum lead capturado ainda.</p>}
      </div>
    </AppShell>
  );
}

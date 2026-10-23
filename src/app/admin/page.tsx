import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { integrationStatus } from "@/lib/env";

export const metadata = { title: "Admin" };
// Status das integrações é lido em tempo de request (process.env).
export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  supabaseServiceRole: "Supabase · service role",
  twitch: "Twitch · Helix API",
  telegram: "Telegram Bot",
  resend: "Resend (e-mail)",
  abacatepay: "AbacatePay (pagamentos)",
};

export default function AdminPage() {
  let status: Record<string, boolean> = {};
  try {
    status = integrationStatus();
  } catch {
    status = {};
  }

  return (
    <AppShell crumbs={[{ label: "Admin" }]}>
      <PageHeader
        title="Saúde das integrações"
        badges={<Badge tone="warning">Acesso restrito</Badge>}
        subtitle="Visão de operação: integrações configuradas, jobs e fontes. Nesta fase, apenas o status de configuração de ambiente."
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        {Object.entries(labels).map(([key, label]) => {
          const ok = status[key];
          return (
            <Card key={key} className="flex items-center justify-between p-4">
              <div className="text-[13px] font-medium">{label}</div>
              <Badge tone={ok ? "accent" : "danger"}>
                {ok ? "Configurado" : "Pendente"}
              </Badge>
            </Card>
          );
        })}
      </div>
      <p className="mt-5 text-xs text-subtle max-w-[64ch]">
        A proteção de acesso (somente administradores via RLS/role) é aplicada na
        Fase 1. Segredos nunca são expostos ao navegador — apenas o booleano de
        configuração.
      </p>
    </AppShell>
  );
}

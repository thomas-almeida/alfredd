import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ProPageGate } from "@/features/billing/ProPageGate";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Monitoramentos" };

export default async function MonitoramentosPage() {
  const session = await getSession();
  return (
    <AppShell crumbs={[{ label: "Monitoramentos" }]}>
      <PageHeader
        title="Monitoramentos"
        badges={<Badge tone="accent">PRO</Badge>}
        subtitle="Regras de monitoramento de jogos e streamers: gatilho por novo clipe ou ClipScore mínimo, frequência e canal. Até 20 ativos simultâneos."
      />
      <EmptyState
        icon="radar"
        title="Recurso exclusivo do PRO"
        description="O monitoramento compartilhado (uma coleta serve todos os assinantes) e os alertas entram na Fase 3."
      />
      <ProPageGate open={!session?.isPro} title="Recurso exclusivo do PRO" description="Monitoramentos e alertas são recursos premium. Assine o PRO para acompanhar canais automaticamente." />
    </AppShell>
  );
}

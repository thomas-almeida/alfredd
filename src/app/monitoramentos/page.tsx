import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

export const metadata = { title: "Monitoramentos" };

export default function MonitoramentosPage() {
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
    </AppShell>
  );
}

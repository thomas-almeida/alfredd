import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ProPageGate } from "@/features/billing/ProPageGate";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Notificações" };

export default async function NotificacoesPage() {
  const session = await getSession();
  return (
    <AppShell crumbs={[{ label: "Notificações" }]}>
      <PageHeader
        title="Notificações"
        badges={<Badge tone="accent">PRO</Badge>}
        subtitle="Canais (Telegram e e-mail), consentimento, frequência, quiet hours e histórico de entregas, com deduplicação."
      />
      <EmptyState
        icon="bell"
        title="Nenhum canal vinculado"
        description="Vinculação do Telegram (deep link assinado) e e-mail via Resend entram na Fase 3. Nunca enviaremos alertas sem consentimento."
      />
      <ProPageGate open={!session?.isPro} title="Recurso exclusivo do PRO" description="Notificações e alertas são recursos premium. Assine o PRO para receber avisos dos seus canais." />
    </AppShell>
  );
}

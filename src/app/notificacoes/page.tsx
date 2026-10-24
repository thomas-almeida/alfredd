import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ProPageGate } from "@/features/billing/ProPageGate";
import { NotificationSettings } from "@/features/monitoring/NotificationSettings";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Notificações" };

export default async function NotificacoesPage() {
  const session = await getSession();
  const db = await createClient();
  const { data: channels } = await (db as any).from("notification_channels").select("kind,active").eq("user_id", session?.userId ?? "").in("kind", ["email", "telegram"]);
  const emailChannel = channels?.find((channel: { kind: string }) => channel.kind === "email");
  const telegramChannel = channels?.find((channel: { kind: string }) => channel.kind === "telegram");
  return (
    <AppShell crumbs={[{ label: "Notificações" }]}>
      <PageHeader title="Notificações" badges={<Badge tone="accent">PRO</Badge>} subtitle="Escolha como receber alertas de novos conteúdos monitorados." />
      {session?.isPro ? <NotificationSettings email={session.email} active={Boolean(emailChannel?.active)} telegramActive={Boolean(telegramChannel?.active)} /> : <EmptyState icon="bell" title="Recurso exclusivo do PRO" description="Assine o PRO para receber alertas por e-mail e Telegram." />}
      <ProPageGate open={!session?.isPro} title="Recurso exclusivo do PRO" description="Notificações e alertas são recursos premium." />
    </AppShell>
  );
}

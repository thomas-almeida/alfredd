import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ProPageGate } from "@/features/billing/ProPageGate";
import { MonitoringList } from "@/features/monitoring/MonitoringList";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Monitoramentos" };

export default async function MonitoramentosPage() {
  const session = await getSession();
  const db = await createClient();
  const typedDb = db as any;
  const [{ data: favorites }, { data: active }] = await Promise.all([
    typedDb.from("favorites").select("id,source_type,game_id,streamer_id,games(id,name),streamers(id,display_name)").eq("user_id", session?.userId ?? "").order("created_at", { ascending: false }),
    typedDb.from("monitorings").select("id,source_type,game_id,streamer_id").eq("user_id", session?.userId ?? "").eq("active", true),
  ]);
  const activeRows = active ?? [];
  const targets = (favorites ?? []).map((favorite: any) => {
    const id = favorite.source_type === "game" ? favorite.game_id : favorite.streamer_id;
    const label = favorite.source_type === "game" ? favorite.games?.name : favorite.streamers?.display_name;
    const monitoring = activeRows.find((row: any) => row.source_type === favorite.source_type && (favorite.source_type === "game" ? row.game_id === id : row.streamer_id === id));
    return { id, label: label ?? "Fonte sem nome", sourceType: favorite.source_type, monitored: Boolean(monitoring), monitoringId: monitoring?.id };
  });
  return (
    <AppShell crumbs={[{ label: "Monitoramentos" }]}>
      <PageHeader title="Monitoramentos" badges={<Badge tone="accent">PRO</Badge>} subtitle="Acompanhe novos clipes dos seus jogos e criadores favoritos." />
      {session?.isPro ? <MonitoringList targets={targets} /> : <EmptyState icon="radar" title="Recurso exclusivo do PRO" description="Assine o PRO para acompanhar novos clipes dos seus jogos e criadores favoritos." />}
      <ProPageGate open={!session?.isPro} title="Recurso exclusivo do PRO" description="Monitoramentos e alertas são recursos premium." />
    </AppShell>
  );
}

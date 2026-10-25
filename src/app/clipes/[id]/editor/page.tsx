import { redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClipEditor } from "@/features/editor/ClipEditor";
import { ProPageGate } from "@/features/billing/ProPageGate";
import { upsertClipCatalog } from "@/features/library/catalog";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { twitch } from "@/lib/twitch/client";

export const dynamic = "force-dynamic";

export default async function ClipEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/clipes/${id}`);

  let title = "";
  let channel = "";
  try {
    const c = (await twitch.clipsByIds([id])).data[0];
    title = c?.title ?? "";
    channel = c?.broadcaster_name ?? "";
  } catch {
    // O editor ainda funciona; a ingestão reporta o erro se o clipe não existir.
  }

  // Free: editar exige o clipe na biblioteca; um clipe novo ocupa uma das 5 vagas.
  let blocked = false;
  if (!session.isPro) {
    const supabase = await createClient();
    const { data: saved } = await supabase
      .from("library_items")
      .select("id, clips!inner(twitch_id)")
      .eq("clips.twitch_id", id)
      .limit(1);
    if (!saved?.length) {
      const cat = await upsertClipCatalog(id);
      if (cat.ok) {
        const { data } = await supabase.rpc("save_to_library", {
          p_clip_id: cat.clipId,
          p_source_type: "game",
          p_game_id: cat.gameId,
          p_streamer_id: null,
        });
        blocked = (data as { error?: string } | null)?.error === "quota_exceeded";
      }
    }
  }

  return (
    <AppShell
      crumbs={[
        { label: "Clipes" },
        { label: channel || id, href: `/clipes/${id}` },
        { label: "Editor" },
      ]}
    >
      <PageHeader title={title || "Editor de clipe"} subtitle="Corte, enquadre e exporte em 9:16" />
      {blocked ? (
        <>
          <EmptyState icon="bookmark" title="Limite do plano Free atingido" description="Assine o PRO para salvar e editar mais clipes." />
          <ProPageGate title="Limite do plano Free atingido" description="O plano Free permite salvar até 5 clipes. Assine o PRO para continuar salvando e editando." />
        </>
      ) : (
        <ClipEditor twitchId={id} userId={session.userId} title={title || id} />
      )}
    </AppShell>
  );
}

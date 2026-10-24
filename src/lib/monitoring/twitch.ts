import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { twitch, type TwitchClip } from "@/lib/twitch/client";
import { getEmailGateway } from "@/lib/resend/email";
import { monitoringEmail } from "./email-template";
import { sendTelegramAlert } from "@/lib/telegram/bot";

type MonitoringRow = {
  id: string;
  user_id: string;
  source_type: "game" | "streamer";
  game_id: string | null;
  streamer_id: string | null;
  games?: { twitch_id: string; name: string } | null;
  streamers?: { twitch_id: string; display_name: string } | null;
};

type ChannelRow = { id: string; user_id: string; kind: "email" | "telegram"; address: string | null; telegram_chat_id: string | null; active: boolean; verified: boolean };

function sourceKey(row: MonitoringRow) {
  return row.source_type === "game" ? `game:${row.games?.twitch_id}` : `streamer:${row.streamers?.twitch_id}`;
}

function clipMatches(row: MonitoringRow, clip: TwitchClip) {
  return row.source_type === "game" ? row.games?.twitch_id === clip.game_id : row.streamers?.twitch_id === clip.broadcaster_id;
}

export async function collectTwitchAlerts(windowMinutes = 30) {
  const admin = createAdminClient() as any;
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { data, error } = await admin
    .from("monitorings")
    .select("id,user_id,source_type,game_id,streamer_id,games(twitch_id,name),streamers(twitch_id,display_name)")
    .eq("active", true);
  if (error) throw error;
  const monitorings = (data ?? []) as MonitoringRow[];
  const sources = new Map<string, MonitoringRow[]>();
  for (const row of monitorings) {
    const key = sourceKey(row);
    if (!key.endsWith(":undefined")) sources.set(key, [...(sources.get(key) ?? []), row]);
  }

  let discovered = 0;
  let queued = 0;
  for (const rows of sources.values()) {
    const first = rows[0]!;
    const clips = first.source_type === "game"
      ? (await twitch.clipsByGame(first.games!.twitch_id, { first: 100, startedAt: since })).data
      : (await twitch.clipsByBroadcaster(first.streamers!.twitch_id, { first: 100, startedAt: since })).data;
    for (const clip of clips) {
      const gameId = rows.find((row) => row.game_id)?.game_id ?? null;
      const streamerId = rows.find((row) => row.streamer_id)?.streamer_id ?? null;
      const { data: saved, error: saveError } = await admin.from("clips").upsert({
        twitch_id: clip.id,
        url: clip.url,
        embed_url: clip.embed_url,
        title: clip.title,
        thumbnail_url: clip.thumbnail_url,
        duration_seconds: clip.duration,
        language: clip.language,
        game_id: gameId,
        streamer_id: streamerId,
        twitch_created_at: clip.created_at,
        latest_view_count: clip.view_count,
        synced_at: new Date().toISOString(),
      }, { onConflict: "twitch_id" }).select("id").single();
      if (saveError || !saved) continue;
      discovered++;
      const matching = rows.filter((row) => clipMatches(row, clip));
      const userIds = [...new Set(matching.map((row) => row.user_id))];
      if (!userIds.length) continue;
      const { data: channels } = await admin.from("notification_channels")
        .select("id,user_id,kind,address,telegram_chat_id,active,verified")
        .in("user_id", userIds).in("kind", ["email", "telegram"]).eq("active", true).eq("verified", true);
      for (const channel of (channels ?? []) as ChannelRow[]) {
        const monitoring = matching.find((row) => row.user_id === channel.user_id);
        if (!monitoring || (channel.kind === "email" ? !channel.address : !channel.telegram_chat_id)) continue;
        const dedupeKey = `${monitoring.id}:${clip.id}:${channel.kind}`;
        const { data: delivery } = await admin.from("notification_deliveries").upsert({
          user_id: channel.user_id,
          monitoring_id: monitoring.id,
          clip_id: saved.id,
          channel_kind: "email",
          dedupe_key: dedupeKey,
          status: "pending",
        }, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id").maybeSingle();
        if (!delivery) continue;
        queued++;
        if (channel.kind === "email") await dispatchEmail(admin, delivery.id, channel.address!, clip, first);
        else await dispatchTelegram(admin, delivery.id, channel.telegram_chat_id!, clip, first);
      }
    }
  }
  return { sources: sources.size, discovered, queued };
}

function links(clip: TwitchClip) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { editorUrl: `${base}/twitch?url=${encodeURIComponent(clip.url)}` };
}

async function dispatchEmail(admin: any, deliveryId: string, address: string, clip: TwitchClip, row: MonitoringRow) {
  try {
    const { editorUrl } = links(clip);
    await getEmailGateway().send({
      to: address,
      subject: `Novo clipe de ${clip.broadcaster_name}: ${clip.title || "sem título"}`,
      html: monitoringEmail({ title: clip.title, creator: clip.broadcaster_name, game: row.games?.name ?? "Twitch", thumbnail: clip.thumbnail_url, clipUrl: clip.url, editorUrl }),
    });
    await admin.from("notification_deliveries").update({ status: "sent", attempt: 1 }).eq("id", deliveryId);
  } catch (error) {
    await admin.from("notification_deliveries").update({ status: "failed", attempt: 1, error: error instanceof Error ? error.message : String(error) }).eq("id", deliveryId);
  }
}

async function dispatchTelegram(admin: any, deliveryId: string, chatId: string, clip: TwitchClip, row: MonitoringRow) {
  try {
    const { editorUrl } = links(clip);
    await sendTelegramAlert({ chatId, title: clip.title, creator: clip.broadcaster_name, game: row.games?.name ?? "Twitch", clipUrl: clip.url, editorUrl });
    await admin.from("notification_deliveries").update({ status: "sent", attempt: 1 }).eq("id", deliveryId);
  } catch (error) {
    await admin.from("notification_deliveries").update({ status: "failed", attempt: 1, error: error instanceof Error ? error.message : String(error) }).eq("id", deliveryId);
  }
}

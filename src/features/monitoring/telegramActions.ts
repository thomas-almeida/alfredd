"use server";

import { createHash, randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { telegramMe } from "@/lib/telegram/bot";

export async function createTelegramLink(): Promise<{ ok: boolean; url?: string; error?: string }> {
  const session = await getSession();
  if (!session?.isPro) return { ok: false, error: "Alertas são exclusivos do PRO." };
  const env = getServerEnv();
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, error: "Telegram ainda não está configurado." };
  const bot = await telegramMe();
  if (!bot.username) return { ok: false, error: "O bot do Telegram não possui username configurado." };
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient() as any;
  await admin.from("telegram_link_tokens").delete().eq("user_id", session.userId).is("used_at", null);
  const { error } = await admin.from("telegram_link_tokens").insert({
    user_id: session.userId,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
  if (error) return { ok: false, error: "Não foi possível criar o vínculo do Telegram." };
  return { ok: true, url: `https://t.me/${bot.username}?start=${token}` };
}

import { createHash } from "node:crypto";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/env";
import { sendTelegramText } from "@/lib/telegram/bot";

export const runtime = "nodejs";

type Update = { message?: { text?: string; chat?: { id: number | string }; from?: { id: number | string } } };

export async function POST(request: Request) {
  const env = getServerEnv();
  if (env.TELEGRAM_WEBHOOK_SECRET && request.headers.get("x-telegram-bot-api-secret-token") !== env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await request.json()) as Update;
  const text = update.message?.text ?? "";
  const chatId = update.message?.chat?.id;
  const token = text.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]+)$/)?.[1];
  if (!chatId || !token) return NextResponse.json({ ok: true });

  const hash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient() as any;
  const { data: link } = await admin.from("telegram_link_tokens").select("id,user_id").eq("token_hash", hash).is("used_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!link) return NextResponse.json({ ok: true });

  await admin.from("telegram_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", link.id);
  const existing = await admin.from("notification_channels").select("id").eq("user_id", link.user_id).eq("kind", "telegram").maybeSingle();
  const payload = { telegram_chat_id: String(chatId), verified: true, active: true, consented_at: new Date().toISOString() };
  if (existing.data) await admin.from("notification_channels").update(payload).eq("id", existing.data.id);
  else await admin.from("notification_channels").insert({ user_id: link.user_id, kind: "telegram", ...payload });
  await sendTelegramText(String(chatId), "Telegram conectado ao Alfredd. Você receberá alertas dos seus monitoramentos PRO aqui.");
  return NextResponse.json({ ok: true });
}

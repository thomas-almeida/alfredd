import "server-only";
import { getServerEnv } from "@/lib/env";

type TelegramResult<T> = { ok: boolean; result?: T; description?: string };

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = getServerEnv().TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN ausente.");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as TelegramResult<T>;
  if (!response.ok || !data.ok) throw new Error(`Telegram ${method} falhou: ${data.description ?? response.status}`);
  return data.result as T;
}

export async function telegramMe() {
  return call<{ id: number; is_bot: boolean; first_name: string; username?: string }>("getMe", {});
}

export async function sendTelegramAlert(params: {
  chatId: string;
  title: string;
  creator: string;
  game: string;
  clipUrl: string;
  editorUrl: string;
}) {
  const esc = (value: string) => value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char] ?? char);
  return call("sendMessage", {
    chat_id: params.chatId,
    parse_mode: "HTML",
    text: `<b>Novo conteúdo monitorado</b>\n\n<b>${esc(params.title || "Novo clipe")}</b>\n${esc(params.creator)} · ${esc(params.game || "Twitch")}`,
    reply_markup: {
      inline_keyboard: [[
        { text: "Abrir no editor", url: params.editorUrl },
        { text: "Assistir", url: params.clipUrl },
      ]],
    },
  });
}

export async function sendTelegramText(chatId: string, text: string) {
  return call("sendMessage", { chat_id: chatId, text });
}

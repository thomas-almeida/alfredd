import "server-only";
import { getServerEnv } from "@/lib/env";

/**
 * Interface do bot do Telegram (guia §8). Vinculação via deep link assinado,
 * webhook verificado e desvincular. Implementação real na Fase 3.
 */
export interface TelegramGateway {
  /** Gera o deep link t.me/<bot>?start=<token_curto_assinado>. */
  buildLinkDeepLink(signedToken: string): string;
  sendMessage(chatId: string, text: string): Promise<void>;
}

export function getTelegramGateway(): TelegramGateway {
  const { TELEGRAM_BOT_TOKEN } = getServerEnv();
  return {
    buildLinkDeepLink(signedToken: string) {
      return `https://t.me/clipes_bot?start=${encodeURIComponent(signedToken)}`;
    },
    async sendMessage() {
      if (!TELEGRAM_BOT_TOKEN) {
        throw new Error("TELEGRAM_BOT_TOKEN ausente: Telegram indisponível.");
      }
      throw new Error("Telegram.sendMessage não implementado (Fase 3).");
    },
  };
}

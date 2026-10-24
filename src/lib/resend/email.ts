import "server-only";
import { getServerEnv } from "@/lib/env";

export interface EmailGateway {
  send(params: { to: string; subject: string; html: string }): Promise<void>;
}

/** Gateway HTTP mínimo para manter os templates HTML sob controle do app. */
export function getEmailGateway(): EmailGateway {
  const { RESEND_API_KEY, RESEND_FROM_EMAIL } = getServerEnv();
  return {
    async send(params) {
      if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY ausente: e-mail indisponível.");
      if (!RESEND_FROM_EMAIL) throw new Error("RESEND_FROM_EMAIL ausente: configure um remetente verificado.");
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: [params.to], subject: params.subject, html: params.html }),
      });
      if (!response.ok) throw new Error(`Resend falhou: ${response.status} ${await response.text()}`);
    },
  };
}

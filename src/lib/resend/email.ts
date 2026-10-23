import "server-only";
import { getServerEnv } from "@/lib/env";

/**
 * Interface de e-mail transacional via Resend (guia §8). Templates responsivos,
 * origem configurável e preferências de descadastro. Implementação na Fase 3.
 */
export interface EmailGateway {
  send(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void>;
}

export function getEmailGateway(): EmailGateway {
  const { RESEND_API_KEY } = getServerEnv();
  return {
    async send() {
      if (!RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY ausente: e-mail indisponível.");
      }
      throw new Error("Resend.send não implementado (Fase 3).");
    },
  };
}

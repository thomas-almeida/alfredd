import "server-only";
import { getServerEnv } from "@/lib/env";
import type {
  BillingProvider,
  CheckoutParams,
  CheckoutResult,
  SubscriptionSnapshot,
  WebhookResult,
} from "./provider";

/**
 * Adapter AbacatePay (STUB — Fase 0). A integração real (criação de cobrança
 * Pix, verificação de assinatura do webhook, conciliação) entra na Fase 3.
 * Cada método falha de forma explícita até ser implementado, para nunca
 * simular pagamento real.
 */
export class AbacatePayProvider implements BillingProvider {
  readonly name = "abacatepay";

  private assertConfigured(): void {
    const { ABACATEPAY_DEV_KEY } = getServerEnv();
    if (!ABACATEPAY_DEV_KEY) {
      throw new Error("ABACATEPAY_DEV_KEY ausente: billing indisponível.");
    }
  }

  async createCheckout(_params: CheckoutParams): Promise<CheckoutResult> {
    this.assertConfigured();
    throw new Error("AbacatePay.createCheckout não implementado (Fase 3).");
  }

  async handleWebhook(
    _payload: unknown,
    _signature: string,
  ): Promise<WebhookResult> {
    this.assertConfigured();
    throw new Error("AbacatePay.handleWebhook não implementado (Fase 3).");
  }

  async getSubscription(
    _userId: string,
  ): Promise<SubscriptionSnapshot | null> {
    return null;
  }

  async cancelSubscription(_userId: string): Promise<void> {
    throw new Error("AbacatePay.cancelSubscription não implementado (Fase 3).");
  }
}

/** Factory: permite trocar de provedor sem tocar nas features. */
export function getBillingProvider(): BillingProvider {
  return new AbacatePayProvider();
}

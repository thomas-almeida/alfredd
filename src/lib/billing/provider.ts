/**
 * Abstração de pagamento (guia §1 e §4). Nenhuma assinatura é marcada como paga
 * por ação do cliente — somente via webhook verificado. O provedor-alvo é o
 * AbacatePay (Pix), já indicado pelo proprietário nas variáveis de ambiente.
 */

import type { SubscriptionStatus } from "@/lib/permissions/quotas";

export interface CheckoutParams {
  userId: string;
  /** URL de retorno após o pagamento. */
  returnUrl: string;
}

export interface CheckoutResult {
  /** URL para redirecionar o cliente ao checkout do PSP. */
  url: string;
  /** Identificador da cobrança no PSP. */
  externalId: string;
}

export interface SubscriptionSnapshot {
  status: SubscriptionStatus;
  externalId: string | null;
  currentPeriodEnd: string | null; // ISO UTC
}

export interface WebhookResult {
  handled: boolean;
  /** Evento idempotente — a conciliação real grava em billing_events. */
  externalId?: string;
  newStatus?: SubscriptionStatus;
}

export interface BillingProvider {
  readonly name: string;
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  handleWebhook(payload: unknown, signature: string): Promise<WebhookResult>;
  getSubscription(userId: string): Promise<SubscriptionSnapshot | null>;
  cancelSubscription(userId: string): Promise<void>;
}

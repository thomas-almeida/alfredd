/**
 * Abstração de pagamento (guia §1 e §4). Nenhuma assinatura é marcada como paga
 * por ação do cliente — somente via webhook verificado. O provedor-alvo é o
 * AbacatePay (Pix), já indicado pelo proprietário nas variáveis de ambiente.
 */

import type { SubscriptionStatus, ProPlanId } from "@/lib/permissions/quotas";

export interface CheckoutParams {
  userId: string;
  /** Plano escolhido (define preço e se é vitalício ou mensal). */
  plan: ProPlanId;
  /** URL de volta ao cancelar/sair do checkout. */
  returnUrl: string;
  /** URL de sucesso após o pagamento. */
  completionUrl: string;
  /** Dados opcionais do cliente para pré-preencher o checkout. */
  customer?: { name?: string | null; email?: string | null };
}

export interface CheckoutResult {
  /** URL para redirecionar o cliente ao checkout do PSP. */
  url: string;
  /** Identificador da cobrança no PSP (ex.: bill_...). */
  externalId: string;
}

export interface SubscriptionSnapshot {
  status: SubscriptionStatus;
  externalId: string | null;
  currentPeriodEnd: string | null; // ISO UTC
}

/** Evento de webhook já parseado; a conciliação (DB) acontece na rota. */
export interface WebhookResult {
  handled: boolean;
  /** Id único do evento (idempotência em billing_events). */
  eventId?: string;
  type?: string;
  /** Pagamento confirmado. */
  paid?: boolean;
  billingId?: string | null;
  /** Recuperados do externalId que enviamos na cobrança. */
  userId?: string | null;
  plan?: ProPlanId | null;
}

export interface BillingProvider {
  readonly name: string;
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  handleWebhook(payload: unknown): Promise<WebhookResult>;
  getSubscription(userId: string): Promise<SubscriptionSnapshot | null>;
  cancelSubscription(userId: string): Promise<void>;
}

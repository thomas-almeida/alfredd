import "server-only";
import { getServerEnv } from "@/lib/env";
import { PRO_PLANS, type ProPlanId } from "@/lib/permissions/quotas";
import type {
  BillingProvider,
  CheckoutParams,
  CheckoutResult,
  SubscriptionSnapshot,
  WebhookResult,
} from "./provider";

const API_BASE = "https://api.abacatepay.com/v1";
/** Separador usado no externalId para carregar user+plano de ida e volta. */
const SEP = "__";

const PLAN_PRODUCT: Record<ProPlanId, { name: string; description: string }> = {
  monthly: { name: "Clipador PRO · Mensal", description: "Acesso PRO por 30 dias." },
  lifetime: { name: "Clipador PRO · Vitalício", description: "Acesso PRO vitalício (pagamento único)." },
};

/**
 * Adapter AbacatePay (PIX). Cobrança via `billing/create` como pagamento único
 * tanto no mensal (vale 30 dias) quanto no vitalício. O `externalId` carrega
 * `userId__plano__nonce` e volta no webhook, dispensando estado intermediário.
 * A conciliação (gravar subscription/billing_events) acontece na rota do webhook.
 */
export class AbacatePayProvider implements BillingProvider {
  readonly name = "abacatepay";

  private key(): string {
    const { ABACATEPAY_PROD_KEY, ABACATEPAY_DEV_KEY } = getServerEnv();
    const key = ABACATEPAY_PROD_KEY || ABACATEPAY_DEV_KEY;
    if (!key) {
      throw new Error("AbacatePay: chave ausente (ABACATEPAY_PROD_KEY ou ABACATEPAY_DEV_KEY).");
    }
    return key;
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResult> {
    const plan = PRO_PLANS[params.plan];
    const product = PLAN_PRODUCT[params.plan];
    const externalId = [params.userId, params.plan, Date.now().toString(36)].join(SEP);
    const body = {
      frequency: "ONE_TIME",
      methods: ["PIX"],
      products: [{
        externalId: `pro-${params.plan}`,
        name: product.name,
        description: product.description,
        quantity: 1,
        price: plan.cents,
      }],
      returnUrl: params.returnUrl,
      completionUrl: params.completionUrl,
      externalId,
      metadata: { userId: params.userId, plan: params.plan },
    };

    const res = await fetch(`${API_BASE}/billing/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.key()}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as
      | { data?: { id?: string; url?: string }; error?: unknown }
      | null;
    if (!res.ok || !json?.data?.url || !json.data.id) {
      throw new Error(`AbacatePay: falha ao criar cobrança (HTTP ${res.status}).`);
    }
    return { url: json.data.url, externalId: json.data.id };
  }

  async handleWebhook(payload: unknown): Promise<WebhookResult> {
    if (!payload || typeof payload !== "object") return { handled: false };
    const evt = payload as {
      id?: string;
      event?: string;
      data?: {
        checkout?: { id?: string; externalId?: string; status?: string };
        billing?: { id?: string; externalId?: string; status?: string };
      };
    };
    const type = evt.event ?? "";
    const node = evt.data?.checkout ?? evt.data?.billing;
    const paidEvent = type === "billing.paid" || type === "checkout.completed";
    const paid = paidEvent && node?.status === "PAID";
    const ext = node?.externalId ?? "";
    const [userId, plan] = ext.split(SEP);
    const validPlan: ProPlanId | null = plan === "monthly" || plan === "lifetime" ? plan : null;
    return {
      handled: true,
      eventId: evt.id ?? node?.id ?? ext,
      type,
      paid,
      billingId: node?.id ?? null,
      userId: userId || null,
      plan: validPlan,
    };
  }

  async getSubscription(_userId: string): Promise<SubscriptionSnapshot | null> {
    // A verdade vive na nossa tabela `subscriptions` (atualizada pelo webhook).
    return null;
  }

  async cancelSubscription(_userId: string): Promise<void> {
    throw new Error("AbacatePay.cancelSubscription ainda não implementado.");
  }
}

/** Factory: permite trocar de provedor sem tocar nas features. */
export function getBillingProvider(): BillingProvider {
  return new AbacatePayProvider();
}

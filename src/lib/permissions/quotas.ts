/**
 * Cotas por plano (guia §4). A verificação atômica real acontece no backend
 * (Supabase, via constraints + checagem transacional) na Fase 1. Aqui ficam as
 * constantes administráveis e os tipos compartilhados.
 */

export type Plan = "free" | "pro";

export type SubscriptionStatus =
  | "pending"
  | "active"
  | "past_due"
  | "canceled";

export const QUOTAS = {
  free: {
    favoriteGames: 3,
    favoriteStreamers: 3,
    savedClips: 5,
    activeMonitorings: 0,
    transcriptsPerDay: 3,
    highlightsPerDay: 3,
  },
  pro: {
    favoriteGames: Infinity,
    favoriteStreamers: Infinity,
    savedClips: Infinity,
    activeMonitorings: 20,
    transcriptsPerDay: 50,
    highlightsPerDay: 30,
  },
} as const satisfies Record<Plan, Record<string, number>>;

const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

/** Planos PRO (fonte única; UI e cobrança leem daqui). */
export type ProPlanId = "monthly" | "lifetime";

/** PRO mensal, recorrente (centavos BRL). */
export const PRO_MONTHLY_CENTS = 997;
/** PRO vitalício, pagamento único sem recorrência (centavos BRL). */
export const PRO_LIFETIME_CENTS = 3790;

export const PRO_MONTHLY_LABEL = brl(PRO_MONTHLY_CENTS); // "R$ 9,97"
export const PRO_LIFETIME_LABEL = brl(PRO_LIFETIME_CENTS); // "R$ 37,90"

/** Preço de entrada mostrado nos CTAs (o mais barato). */
export const PRO_PRICE_LABEL = PRO_MONTHLY_LABEL;

export const PRO_PLANS = {
  monthly: { id: "monthly", cents: PRO_MONTHLY_CENTS, label: PRO_MONTHLY_LABEL, recurring: true },
  lifetime: { id: "lifetime", cents: PRO_LIFETIME_CENTS, label: PRO_LIFETIME_LABEL, recurring: false },
} as const satisfies Record<ProPlanId, { id: ProPlanId; cents: number; label: string; recurring: boolean }>;

/** Planos com acesso PRO ativo exigem assinatura válida. */
export function isProActive(
  plan: Plan,
  status: SubscriptionStatus | null,
): boolean {
  return plan === "pro" && status === "active";
}

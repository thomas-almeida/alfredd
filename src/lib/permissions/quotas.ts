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
    favoriteGames: Infinity,
    favoriteStreamers: Infinity,
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

/** Preço proposto do PRO, administrável por configuração (centavos BRL). */
export const PRO_PRICE_CENTS = 3790;

/** Planos com acesso PRO ativo exigem assinatura válida. */
export function isProActive(
  plan: Plan,
  status: SubscriptionStatus | null,
): boolean {
  return plan === "pro" && status === "active";
}

import { createClient } from "@/lib/supabase/server";
import type { Plan, SubscriptionStatus } from "@/lib/supabase/database.types";

export interface SessionInfo {
  userId: string;
  email: string | null;
  plan: Plan;
  isAdmin: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  isPro: boolean;
}

/** Retorna a sessão atual com plano efetivo, ou null se não autenticado. */
export async function getSession(): Promise<SessionInfo | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, is_admin")
    .eq("id", user.id)
    .single();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  const subscriptionStatus = (sub?.status as SubscriptionStatus) ?? null;
  return {
    userId: user.id,
    email: user.email ?? null,
    plan: (profile?.plan as Plan) ?? "free",
    isAdmin: profile?.is_admin ?? false,
    subscriptionStatus,
    isPro: subscriptionStatus === "active",
  };
}

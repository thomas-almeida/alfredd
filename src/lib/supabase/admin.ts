import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { clientEnv, getServerEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Client com service role — IGNORA RLS. Uso estritamente server-side para:
 *  - verificação atômica de cotas (Free/PRO),
 *  - jobs de ingestão/score,
 *  - conciliação de webhooks de pagamento.
 * NUNCA deve ser importado por código client.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente: operação server-side indisponível.",
    );
  }
  return createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

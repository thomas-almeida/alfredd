"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function grantLeadAccess(leadId: string) {
  const session = await getSession();
  if (!session?.isAdmin) return { ok: false, error: "Acesso negado." };

  const admin = createAdminClient();
  const { data: lead, error: leadError } = await admin
    .from("lp_leads")
    .select("email")
    .eq("lead_id", leadId)
    .single();
  if (leadError || !lead) return { ok: false, error: "Lead não encontrado." };

  const { error } = await admin
    .from("lp_leads")
    .update({
      access_granted: true,
      access_granted_at: new Date().toISOString(),
      access_granted_by: session.userId,
    })
    .eq("lead_id", leadId);
  if (error) return { ok: false, error: "Não foi possível conceder o acesso." };

  const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = users.data.users.find((item) => item.email?.toLowerCase() === lead.email.toLowerCase());
  if (user) await admin.from("profiles").update({ access_granted: true }).eq("id", user.id);

  revalidatePath("/admin");
  return { ok: true, accountFound: Boolean(user) };
}

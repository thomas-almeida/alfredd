"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientEnv } from "@/lib/env";

export interface AuthState {
  ok?: boolean;
  error?: string;
  /** Mensagem informativa (ex.: confirmação de e-mail pendente). */
  notice?: string;
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "E-mail ou senha inválidos." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || password.length < 6) {
    return { error: "Use um e-mail válido e senha de ao menos 6 caracteres." };
  }

  const supabase = await createClient();
  const { data: signupData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: new URL("/entrar", clientEnv.NEXT_PUBLIC_APP_URL).toString(),
    },
  });
  if (error) {
    return { error: error.message };
  }

  if (signupData.user?.id) {
    try {
      const admin = createAdminClient();
      const { data: lead } = await admin
        .from("lp_leads")
        .select("access_granted")
        .eq("email", email.toLowerCase())
        .eq("access_granted", true)
        .maybeSingle();
      if (lead) await admin.from("profiles").update({ access_granted: true }).eq("id", signupData.user.id);
    } catch {
      // O vínculo será tentado novamente quando o fluxo administrativo for usado.
    }
  }

  // Projetos com confirmação de e-mail exigem clique no link antes do login.
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return {
      notice:
        "Conta criada. Confirme pelo e-mail enviado e então faça login para continuar.",
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

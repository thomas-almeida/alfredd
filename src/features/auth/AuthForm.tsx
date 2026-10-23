"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { signIn, signUp, type AuthState } from "./actions";

const tabBase = "flex-1 py-2 border-none rounded-[4px] text-[13px] font-medium";
const inputCls =
  "bg-surface-2 border border-border-strong rounded-sm px-3 py-2.5 text-fg text-base focus:outline-none focus:border-accent";

/**
 * Formulário de login/cadastro. Usado na rota /entrar e no modal.
 * Em sucesso chama `onSuccess` (modal) ou navega para `next` (página).
 */
export function AuthForm({
  next = "/",
  onSuccess,
}: {
  next?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const action = mode === "in" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );
  const handled = useRef(false);

  useEffect(() => {
    if (state.ok && !handled.current) {
      handled.current = true;
      if (onSuccess) onSuccess();
      else {
        router.push(next);
        router.refresh();
      }
    }
  }, [state.ok, onSuccess, next, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex gap-1 bg-surface-2 rounded-sm p-[3px]">
        <button
          type="button"
          className={cn(tabBase, mode === "in" ? "bg-surface-hover text-fg" : "bg-transparent text-muted")}
          onClick={() => setMode("in")}
        >
          Entrar
        </button>
        <button
          type="button"
          className={cn(tabBase, mode === "up" ? "bg-surface-hover text-fg" : "bg-transparent text-muted")}
          onClick={() => setMode("up")}
        >
          Criar conta
        </button>
      </div>

      <label className="flex flex-col gap-2 text-[13px] text-muted">
        <span>E-mail</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="voce@exemplo.com"
          className={inputCls}
        />
      </label>

      <label className="flex flex-col gap-2 text-[13px] text-muted">
        <span>Senha</span>
        <input
          type="password"
          name="password"
          required
          minLength={6}
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          placeholder="••••••••"
          className={inputCls}
        />
      </label>

      {state.error && <p className="text-[13px] text-danger">{state.error}</p>}
      {state.notice && <p className="text-[13px] text-warning">{state.notice}</p>}

      <Button type="submit" variant="primary" disabled={pending || state.ok}>
        {pending ? "Processando…" : mode === "in" ? "Entrar" : "Criar conta"}
      </Button>
    </form>
  );
}

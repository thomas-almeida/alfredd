"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** Botão que inicia o checkout PIX (AbacatePay) e redireciona para o pagamento. */
export function CheckoutButton({
  plan,
  enabled,
  label,
}: {
  plan: "monthly" | "lifetime";
  enabled: boolean;
  label: string;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!enabled) {
    return (
      <Button variant="primary" className="w-full" disabled>
        {label} (em breve)
      </Button>
    );
  }

  async function go() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        window.location.href = "/entrar";
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setErr(
        data.error === "already_pro"
          ? "Você já tem o PRO ativo."
          : "Não foi possível iniciar o pagamento. Tente novamente.",
      );
    } catch {
      setErr("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="primary" className="w-full" onClick={go} disabled={loading}>
        {loading ? "Abrindo checkout…" : label}
      </Button>
      {err && <p className="mt-2 text-center text-xs text-danger">{err}</p>}
    </>
  );
}

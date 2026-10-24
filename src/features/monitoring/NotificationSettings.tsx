"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { disableEmailAlerts, enableEmailAlerts } from "./actions";

export function NotificationSettings({ email, active }: { email: string | null; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="font-semibold">Alertas por e-mail</h2>
      <p className="mt-1 text-sm text-muted">Receba um aviso quando surgir um novo clipe de um jogo ou criador monitorado.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {active ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(() => void disableEmailAlerts())}>Pausar alertas</Button> : <Button size="sm" variant="primary" disabled={pending || !email} onClick={() => startTransition(() => void enableEmailAlerts())}>Ativar alertas</Button>}
        <span className="text-xs text-muted">{email ?? "Nenhum e-mail confirmado"}{active ? " · ativo" : " · inativo"}</span>
      </div>
    </section>
  );
}

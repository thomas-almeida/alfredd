"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { disableEmailAlerts, enableEmailAlerts } from "./actions";
import { createTelegramLink } from "./telegramActions";

export function NotificationSettings({ email, active, telegramActive }: { email: string | null; active: boolean; telegramActive: boolean }) {
  const [pending, startTransition] = useTransition();
  const [telegramUrl, setTelegramUrl] = useState<string | null>(null);
  const [telegramMessage, setTelegramMessage] = useState<string | null>(null);
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="font-semibold">Alertas por e-mail</h2>
      <p className="mt-1 text-sm text-muted">Receba um aviso quando surgir um novo clipe de um jogo ou criador monitorado.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {active ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(() => void disableEmailAlerts())}>Pausar alertas</Button> : <Button size="sm" variant="primary" disabled={pending || !email} onClick={() => startTransition(() => void enableEmailAlerts())}>Ativar alertas</Button>}
        <span className="text-xs text-muted">{email ?? "Nenhum e-mail confirmado"}{active ? " · ativo" : " · inativo"}</span>
      </div>
      <div className="mt-6 border-t border-border pt-5">
        <h3 className="font-medium">Telegram</h3>
        <p className="mt-1 text-sm text-muted">Vincule o bot para receber os mesmos alertas no Telegram.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {telegramUrl ? <a href={telegramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-sm bg-accent px-3 py-2 text-xs font-semibold text-accent-fg">Abrir Telegram</a> : <Button size="sm" variant="secondary" disabled={pending || telegramActive} onClick={() => startTransition(async () => { const result = await createTelegramLink(); setTelegramUrl(result.url ?? null); setTelegramMessage(result.error ?? "Depois de clicar em Start, o Telegram ficará vinculado."); })}>{telegramActive ? "Telegram vinculado" : "Vincular Telegram"}</Button>}
          {telegramMessage && <span className="text-xs text-muted">{telegramMessage}</span>}
        </div>
      </div>
    </section>
  );
}

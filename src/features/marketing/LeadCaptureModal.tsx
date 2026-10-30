"use client";

import { FormEvent, useState } from "react";
import { createPortal } from "react-dom";

const GROUP_URL = "https://chat.whatsapp.com/Hl7m99pNIsXBNrAQuDYjrZ";

export function LeadCaptureModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sending, setSending] = useState(false);

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);

    const data = new FormData(event.currentTarget);
    const message = [
      "Olá! Quero entrar no grupo VIP de criadores de GTA VI.",
      `Nome: ${String(data.get("name") ?? "").trim()}`,
      `Telefone: ${String(data.get("phone") ?? "").trim()}`,
      `E-mail: ${String(data.get("email") ?? "").trim()}`,
    ].join("\n");
    const separator = GROUP_URL.includes("?") ? "&" : "?";

    window.location.href = `${GROUP_URL}${separator}text=${encodeURIComponent(message)}`;
  }

  return createPortal(
    (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-modal-title"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="lp-modal my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#151517] p-5 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <span className="mb-3 inline-flex rounded-full border border-[#b4f34a]/25 bg-[#b4f34a]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b4f34a]">
              Acesso VIP
            </span>
            <h2 id="lead-modal-title" className="text-2xl font-bold tracking-tight">
              Entre para a lista de criadores
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Deixe seus dados e siga direto para o grupo onde vamos liberar os próximos acessos.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white" aria-label="Fechar">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-medium">
            Seu nome
            <input required name="name" autoComplete="name" className="lp-input mt-2" placeholder="Como podemos te chamar?" />
          </label>
          <label className="block text-sm font-medium">
            WhatsApp
            <input required name="phone" type="tel" autoComplete="tel" className="lp-input mt-2" placeholder="(11) 99999-9999" />
          </label>
          <label className="block text-sm font-medium">
            E-mail
            <input required name="email" type="email" autoComplete="email" className="lp-input mt-2" placeholder="voce@email.com" />
          </label>

          <button type="submit" disabled={sending} className="lp-button mt-2 w-full justify-center">
            {sending ? "Abrindo seu acesso…" : "Garantir acesso →"}
          </button>
          <p className="text-center text-[11px] leading-5 text-zinc-500">
            Ao continuar, você será redirecionado para o WhatsApp.
          </p>
        </form>
      </div>
      </div>
    ),
    document.body,
  );
}

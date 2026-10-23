"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/ui/Icon";

const perks = [
  "Clipes salvos e editados sem limite",
  "Favoritos ilimitados de jogos e streamers",
  "Até 20 monitoramentos com alertas",
];

/** Popup de upgrade exibido quando o usuário esbarra num limite do plano Free. */
export function UpgradeModal({
  open,
  onClose,
  title = "Você atingiu o limite do plano Free",
  description = "O plano Free permite salvar até 5 clipes. Assine o PRO para continuar salvando e editando.",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-title"
    >
      <div
        className="relative w-full max-w-[420px] rounded-lg border border-accent p-6 text-center bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-accent)_14%,var(--color-surface))_0%,var(--color-surface)_60%)] shadow-[0_0_0_1px_var(--color-accent),0_20px_60px_-20px_color-mix(in_oklab,var(--color-accent)_45%,transparent)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute top-3 right-3 w-8 h-8 rounded-full text-muted text-xl leading-none hover:bg-surface-2 hover:text-fg"
          onClick={onClose}
          aria-label="Fechar"
        >
          ×
        </button>
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/15 text-accent">
          <Icon name="star" width={22} height={22} />
        </span>
        <h2 id="upgrade-title" className="mt-4 text-lg font-bold">{title}</h2>
        <p className="mt-2 text-[13px] text-muted">{description}</p>
        <ul className="list-none p-0 mt-5 flex flex-col gap-2.5 text-left text-[13px]">
          {perks.map((p) => (
            <li key={p} className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-accent text-accent-fg shrink-0">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12l5 5L20 7" />
                </svg>
              </span>
              {p}
            </li>
          ))}
        </ul>
        <Link
          href="/assinatura"
          className="mt-6 flex w-full items-center justify-center rounded-md bg-accent px-4 py-2.5 text-[0.875rem] font-semibold text-accent-fg hover:brightness-110"
        >
          Conhecer o PRO · R$ 37,90/mês
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 text-[13px] text-muted hover:text-fg"
        >
          Agora não
        </button>
      </div>
    </div>
  );
}

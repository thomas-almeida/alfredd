"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";

/**
 * Enquanto `active`, intercepta cliques em links internos (e fechar/recarregar a
 * aba) e pede confirmação antes de abandonar a edição do clipe.
 */
export function LeaveGuard({ active }: { active: boolean }) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setTarget(url.pathname + url.search + url.hash);
    }
    function onUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [active]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTarget(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [target]);

  if (!target) return null;
  // Portal no body: o editor fica dentro de uma coluna sticky (contexto de
  // empilhamento próprio), e o retângulo de crop cobriria o modal.
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      onClick={() => setTarget(null)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-title"
    >
      <div
        className="w-full max-w-[420px] bg-surface border border-border-strong rounded-lg p-5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="leave-title" className="text-base font-semibold">
          Abandonar este clipe?
        </h2>
        <p className="text-[13px] text-muted mt-2">
          Você ainda não exportou o vídeo. Se sair agora, o progresso de edição será perdido.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button size="sm" variant="secondary" onClick={() => setTarget(null)}>
            Continuar editando
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              const href = target;
              setTarget(null);
              router.push(href);
            }}
          >
            Sair mesmo assim
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

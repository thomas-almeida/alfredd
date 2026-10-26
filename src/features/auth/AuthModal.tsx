"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "./AuthForm";

interface OpenOptions {
  onSuccess?: () => void;
  reason?: string;
}

interface AuthModalContext {
  openAuth: (opts?: OpenOptions) => void;
}

const Ctx = createContext<AuthModalContext | null>(null);

export function useAuthModal(): AuthModalContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuthModal fora do AuthModalProvider");
  return ctx;
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const successCb = useRef<(() => void) | undefined>(undefined);

  const openAuth = useCallback((opts?: OpenOptions) => {
    successCb.current = opts?.onSuccess;
    setReason(opts?.reason);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    successCb.current = undefined;
    setReason(undefined);
  }, []);

  const handleSuccess = useCallback(() => {
    const cb = successCb.current;
    close();
    router.refresh();
    cb?.();
  }, [close, router]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <Ctx.Provider value={{ openAuth }}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Entrar ou criar conta"
        >
          <div
            className="relative w-full max-w-[420px] rounded-xl border border-border-strong bg-surface p-7 shadow-[0_20px_64px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-3 right-3 w-7 h-7 rounded-sm bg-transparent text-muted text-xl leading-none hover:bg-surface-2 hover:text-fg"
              onClick={close}
              aria-label="Fechar"
            >
              ×
            </button>
            <h2 className="mb-2 text-xl font-semibold tracking-tight">Entrar ou criar conta</h2>
            <p className="mb-6 max-w-[42ch] text-[13px] leading-5 text-muted">
              {reason ??
                "Cadastro rápido. Depois você volta exatamente para onde estava."}
            </p>
            <AuthForm onSuccess={handleSuccess} />
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

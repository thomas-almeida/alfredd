"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "alfredd-pwa-guide-dismissed";

export function PwaInstallGuide() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 700px)");
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

    setIos(isIos);
    if (!mobile.matches || standalone || dismissed) return;

    const show = () => setVisible(true);
    const timer = window.setTimeout(show, 1800);
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      show();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="fixed inset-x-3 bottom-3 z-[75] mx-auto max-w-md rounded-2xl border border-border-strong bg-surface p-4 shadow-2xl min-[701px]:hidden" aria-label="Instalar o Alfredd como aplicativo">
      <div className="flex items-start gap-3">
        <Image src="/alfredd-icon.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-semibold text-fg">Use o Alfredd como app</h2>
            <button type="button" onClick={dismiss} className="-mr-1 -mt-1 rounded-full px-2 py-1 text-lg leading-none text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fechar orientação">×</button>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted">Adicione à tela inicial para clipar com mais espaço e abrir direto como um aplicativo.</p>
          {installPrompt ? (
            <button type="button" onClick={install} className="mt-3 rounded-md bg-accent px-3 py-2 text-xs font-semibold text-accent-fg hover:brightness-110">Instalar app</button>
          ) : (
            <p className="mt-2 text-xs leading-5 text-fg">
              {ios ? "No Safari: toque em Compartilhar e depois em Adicionar à Tela de Início." : "No menu do navegador, toque em Instalar app ou Adicionar à tela inicial."}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

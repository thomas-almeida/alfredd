"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { saveClip } from "@/features/library/actions";
import { useAuthModal } from "@/features/auth/AuthModal";

/**
 * Salvar na biblioteca + copiar link oficial. Se não autenticado, abre o modal
 * de cadastro e retoma a intenção ao voltar (?save=1), sem perder contexto.
 */
export function ClipActions({
  twitchId,
  officialUrl,
  resume,
}: {
  twitchId: string;
  officialUrl: string;
  resume: boolean;
}) {
  const { openAuth } = useAuthModal();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const resumed = useRef(false);

  function doSave() {
    setMsg(null);
    start(async () => {
      const res = await saveClip(twitchId);
      if (res.needsAuth) {
        openAuth({
          reason: "Entre para salvar este clipe na sua biblioteca.",
          onSuccess: () => doSave(),
        });
        return;
      }
      if (res.ok) {
        setSaved(true);
        setMsg(res.already ? "Já estava na sua biblioteca." : "Salvo na biblioteca!");
      } else {
        setMsg(res.error ?? "Não foi possível salvar.");
      }
    });
  }

  useEffect(() => {
    if (resume && !resumed.current) {
      resumed.current = true;
      doSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(officialUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("Não foi possível copiar. Copie manualmente pelo link oficial.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        <Button variant="primary" onClick={doSave} disabled={pending || saved}>
          {saved ? "Salvo" : pending ? "Salvando…" : "Salvar na biblioteca"}
        </Button>
        <Button variant="secondary" onClick={copyLink}>
          {copied ? "Link copiado" : "Copiar link oficial"}
        </Button>
        <Link href={`/clipes/${twitchId}/editor`}>
          <Button variant="secondary">Cortar</Button>
        </Link>
        <a href={officialUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost">Abrir na Twitch</Button>
        </a>
      </div>
      {msg && <p className="text-[13px] text-muted">{msg}</p>}
    </div>
  );
}

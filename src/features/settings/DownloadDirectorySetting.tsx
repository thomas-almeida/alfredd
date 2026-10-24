"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { canChooseDownloadDirectory, chooseDownloadDirectory, getDownloadDirectoryName } from "@/lib/downloads/directory";

export function DownloadDirectorySetting() {
  const [directory, setDirectory] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Mantém o primeiro render igual no servidor e no cliente; a API só existe no browser.
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const available = canChooseDownloadDirectory();
    setSupported(available);
    if (available) void getDownloadDirectoryName().then(setDirectory).catch(() => undefined);
  }, []);

  async function choose() {
    setMessage(null);
    try {
      setDirectory(await chooseDownloadDirectory());
      setMessage("Pasta salva.");
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      setMessage(error instanceof Error ? error.message : "Não foi possível configurar a pasta.");
    }
  }

  return (
    <section className="bg-surface border border-border rounded-lg p-6 w-full">
      <h2 className="text-base font-semibold">Pasta dos clipes baixados</h2>
      <p className="text-[13px] text-muted mt-1">
        Escolha onde o navegador deve salvar os MP4 exportados. A preferência fica neste navegador e neste computador.
      </p>
      {!supported ? (
        <p className="text-[13px] text-muted mt-4">Disponível no Chrome ou Edge. Em outros navegadores, o download usa a pasta padrão do navegador.</p>
      ) : (
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <Button size="sm" variant="secondary" onClick={choose}>Escolher pasta</Button>
          <span className="text-[13px] text-muted">{directory ? `Atual: ${directory}` : "Nenhuma pasta escolhida"}</span>
        </div>
      )}
      {message && <p className="text-[13px] text-muted mt-3">{message}</p>}
    </section>
  );
}

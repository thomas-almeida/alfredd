"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ALL_LANGUAGES, CLIP_LANGUAGES } from "@/lib/twitch/languages";

/** Filtro por idioma do clipe, salvo em ?lang= ("all" = todos; sem parâmetro = padrão do usuário). */
export function LanguageFilter({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setLang(value: string) {
    const p = new URLSearchParams(params);
    p.set("lang", value || ALL_LANGUAGES);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <select
      aria-label="Idioma dos clipes"
      value={current}
      onChange={(e) => setLang(e.target.value)}
      className="h-[38px] px-3 rounded-sm bg-surface-2 border border-border text-[13px] text-fg mb-5"
    >
      <option value="">Todos os idiomas</option>
      {CLIP_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}

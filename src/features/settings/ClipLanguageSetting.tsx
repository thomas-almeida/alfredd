"use client";

import { useState } from "react";
import {
  ALL_LANGUAGES,
  CLIP_LANGUAGE_COOKIE,
  CLIP_LANGUAGES,
} from "@/lib/twitch/languages";

/** Idioma padrão dos clipes, salvo em cookie (vale para jogos e streamers). */
export function ClipLanguageSetting({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial || ALL_LANGUAGES);
  const [saved, setSaved] = useState(false);

  function change(v: string) {
    setValue(v);
    document.cookie = `${CLIP_LANGUAGE_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax`;
    setSaved(true);
  }

  return (
    <section className="bg-surface border border-border rounded-lg p-5 max-w-[520px]">
      <h2 className="text-base font-semibold">Idioma dos clipes</h2>
      <p className="text-[13px] text-muted mt-1">
        Idioma usado por padrão nas páginas de jogos e streamers. Você ainda pode trocar em cada página.
      </p>
      <div className="flex items-center gap-3 mt-4">
        <select
          aria-label="Idioma padrão dos clipes"
          value={value}
          onChange={(e) => change(e.target.value)}
          className="h-[38px] px-3 rounded-sm bg-surface-2 border border-border text-[13px] text-fg"
        >
          {CLIP_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
          <option value={ALL_LANGUAGES}>Todos os idiomas</option>
        </select>
        {saved && <span className="text-[13px] text-muted">Salvo.</span>}
      </div>
    </section>
  );
}

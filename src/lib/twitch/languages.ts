/** Idiomas oferecidos no filtro de clipes (códigos ISO 639-1 usados pela Twitch). */
export const CLIP_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "pt", label: "Português" },
  { code: "en", label: "Inglês" },
  { code: "es", label: "Espanhol" },
  { code: "fr", label: "Francês" },
  { code: "de", label: "Alemão" },
  { code: "it", label: "Italiano" },
  { code: "ru", label: "Russo" },
  { code: "ja", label: "Japonês" },
  { code: "ko", label: "Coreano" },
  { code: "zh", label: "Chinês" },
];

/** A Twitch usa variantes como "pt-br" e "zh-hant"; compara só o idioma base. */
export function matchesLanguage(clipLang: string | null | undefined, lang: string): boolean {
  if (!lang) return true;
  return (clipLang ?? "").toLowerCase().split("-")[0] === lang;
}

export function parseLanguage(value: string | undefined): string {
  return CLIP_LANGUAGES.some((l) => l.code === value) ? value! : "";
}

/** Idioma padrão quando o usuário não escolheu outro nas configurações. */
export const DEFAULT_CLIP_LANGUAGE = "pt";
/** Cookie com o idioma padrão escolhido em /configuracoes ("all" = todos). */
export const CLIP_LANGUAGE_COOKIE = "clip_lang";
/** Valor de ?lang= / cookie que significa "todos os idiomas". */
export const ALL_LANGUAGES = "all";

/** Resolve ?lang= com fallback para o padrão salvo; "" = todos os idiomas. */
export function resolveLanguage(param: string | undefined, saved: string | undefined): string {
  for (const v of [param, saved]) {
    if (v === ALL_LANGUAGES) return "";
    if (parseLanguage(v)) return v!;
  }
  return DEFAULT_CLIP_LANGUAGE;
}

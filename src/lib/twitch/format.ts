/** Helpers de formatação de dados da Twitch (templates de imagem, etc.). */

export function boxArt(url: string | null | undefined, w = 144, h = 192): string | null {
  if (!url) return null;
  // /search/categories devolve a URL já resolvida em 52x72; troca pelo tamanho pedido.
  return url
    .replace("{width}", String(w))
    .replace("{height}", String(h))
    .replace(/-\d+x\d+(\.\w+)$/, `-${w}x${h}$1`);
}

export function clipThumb(url: string | null | undefined): string | null {
  if (!url) return null;
  // Algumas thumbs vêm com template; mantém a URL direta quando já resolvida.
  return url.replace("%{width}", "480").replace("%{height}", "272");
}

/** Idade legível a partir de um ISO em UTC. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} d`;
  const mo = Math.floor(d / 30);
  return `há ${mo} mês${mo > 1 ? "es" : ""}`;
}

export function formatViews(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(".0", "")} mil`;
  return `${(n / 1_000_000).toFixed(1).replace(".0", "")} mi`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

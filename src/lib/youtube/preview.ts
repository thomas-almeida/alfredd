/** Sequência de fontes da prévia; mantida pura para ter teste de regressão. */
export function nextPreviewAttempt(
  directUrl: string,
  proxyUrl: string,
  attempt: number,
): { attempt: number; url: string } | null {
  if (attempt === 0) return { attempt: 1, url: `${directUrl}&refresh=1` };
  if (attempt === 1) return { attempt: 2, url: proxyUrl };
  return null;
}

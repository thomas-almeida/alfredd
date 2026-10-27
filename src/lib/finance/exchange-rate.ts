import "server-only";

let cached: { rate: number; updatedAt: string; expiresAt: number } | null = null;

/** Cotação USD/BRL curta, apenas para exibição de estimativas. */
export async function getUsdBrlRate(): Promise<{ rate: number; updatedAt: string } | null> {
  if (cached && cached.expiresAt > Date.now()) return cached;
  const fallback = Number(process.env.USD_BRL_RATE);
  try {
    const response = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error(`exchange_http_${response.status}`);
    const json = (await response.json()) as { USDBRL?: { bid?: string } };
    const rate = Number(json.USDBRL?.bid);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("exchange_invalid");
    cached = { rate, updatedAt: new Date().toISOString(), expiresAt: Date.now() + 15 * 60_000 };
    return cached;
  } catch {
    return Number.isFinite(fallback) && fallback > 0
      ? { rate: fallback, updatedAt: new Date().toISOString() }
      : null;
  }
}

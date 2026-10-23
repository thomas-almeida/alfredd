import "server-only";
import { getServerEnv } from "@/lib/env";

/**
 * Gerenciador do App Access Token (OAuth client credentials) da Twitch.
 * Server-only. O token é cacheado em memória do processo e renovado antes de
 * expirar. Não requer URL pública nem login do usuário com a Twitch.
 */

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cache: CachedToken | null = null;

export class TwitchNotConfiguredError extends Error {
  constructor() {
    super(
      "Integração Twitch não configurada: defina TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET.",
    );
    this.name = "TwitchNotConfiguredError";
  }
}

export async function getAppAccessToken(): Promise<string> {
  const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = getServerEnv();
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new TwitchNotConfiguredError();
  }

  const now = Date.now();
  if (cache && cache.expiresAt > now + 60_000) {
    return cache.accessToken;
  }

  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Falha ao obter App Access Token da Twitch: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return cache.accessToken;
}

/** Credenciais para o header das chamadas Helix. */
export async function getHelixAuthHeaders(): Promise<Record<string, string>> {
  const { TWITCH_CLIENT_ID } = getServerEnv();
  const token = await getAppAccessToken();
  return {
    "Client-Id": TWITCH_CLIENT_ID as string,
    Authorization: `Bearer ${token}`,
  };
}

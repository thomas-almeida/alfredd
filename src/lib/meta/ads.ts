import "server-only";

import { getServerEnv } from "@/lib/env";

type MetaAction = {
  action_type?: string;
  value?: string | number;
};

type MetaInsightsResponse = {
  data?: Array<{
    spend?: string | number;
    impressions?: string | number;
    actions?: MetaAction[];
  }>;
  error?: { message?: string };
};

type MetaAdResponse = {
  id?: string;
  name?: string;
  creative?: {
    id?: string;
    name?: string;
    image_url?: string;
    thumbnail_url?: string;
  };
};

export type MetaInsights = {
  configured: boolean;
  spend: number;
  impressions: number;
  lpClicks: number;
  clickSource: "landing_page_view" | "link_click" | "outbound_click" | null;
};

export type MetaCreative = {
  adId: string;
  adName: string | null;
  creativeId: string | null;
  creativeName: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
};

export class MetaAdsPermissionError extends Error {
  constructor() {
    super("O token da Meta não possui ads_read para esta conta de anúncios.");
    this.name = "MetaAdsPermissionError";
  }
}

function getMetaConfig() {
  const env = getServerEnv();
  const accessToken = env.META_ADS_ACCESS_TOKEN ?? env.META_ACCESS_TOKEN;
  if (!accessToken || !env.META_AD_ACCOUNT_ID) return null;

  return {
    accessToken,
    adAccountId: env.META_AD_ACCOUNT_ID,
    version: env.META_GRAPH_API_VERSION ?? "v27.0",
  };
}

async function fetchMeta<T>(path: string, params: Record<string, string>) {
  const config = getMetaConfig();
  if (!config) throw new Error("Meta Ads não está configurado.");

  const search = new URLSearchParams({
    ...params,
    access_token: config.accessToken,
  });
  const response = await fetch(
    `https://graph.facebook.com/${config.version}/${path}?${search.toString()}`,
    { cache: "no-store" },
  );
  const body = (await response.json().catch(() => null)) as (T & MetaInsightsResponse) | null;

  if (!response.ok) {
    const message = body?.error?.message ?? `Meta Graph API retornou ${response.status}.`;
    if (body?.error?.message?.includes("ads_read") || body?.error?.message?.includes("ads_management")) {
      throw new MetaAdsPermissionError();
    }
    throw new Error(message);
  }

  return body as T;
}

function numeric(value: string | number | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findAction(actions: MetaAction[] | undefined, actionTypes: string[]) {
  const action = actions?.find((item) => item.action_type && actionTypes.includes(item.action_type));
  return action ? numeric(action.value) : 0;
}

export async function getMetaInsights({ since, until }: { since: string; until: string }): Promise<MetaInsights> {
  const config = getMetaConfig();
  if (!config) {
    return { configured: false, spend: 0, impressions: 0, lpClicks: 0, clickSource: null };
  }

  const timeRange = JSON.stringify({ since, until });
  const result = await fetchMeta<MetaInsightsResponse>(`${config.adAccountId}/insights`, {
    fields: "spend,impressions,actions",
    time_range: timeRange,
    level: "account",
  });

  const totals = (result.data ?? []).reduce<{ spend: number; impressions: number; actions: MetaAction[] }>(
    (accumulator, row) => ({
      spend: accumulator.spend + numeric(row.spend),
      impressions: accumulator.impressions + numeric(row.impressions),
      actions: [...accumulator.actions, ...(row.actions ?? [])],
    }),
    { spend: 0, impressions: 0, actions: [] as MetaAction[] },
  );

  const landingPageViews = findAction(totals.actions, ["landing_page_view"]);
  if (landingPageViews > 0) {
    return {
      configured: true,
      spend: totals.spend,
      impressions: totals.impressions,
      lpClicks: landingPageViews,
      clickSource: "landing_page_view",
    };
  }

  const linkClicks = findAction(totals.actions, ["link_click"]);
  if (linkClicks > 0) {
    return {
      configured: true,
      spend: totals.spend,
      impressions: totals.impressions,
      lpClicks: linkClicks,
      clickSource: "link_click",
    };
  }

  const outboundClicks = findAction(totals.actions, ["outbound_click"]);
  return {
    configured: true,
    spend: totals.spend,
    impressions: totals.impressions,
    lpClicks: outboundClicks,
    clickSource: outboundClicks > 0 ? "outbound_click" : null,
  };
}

export async function getMetaCreative(adId: string): Promise<MetaCreative> {
  const result = await fetchMeta<MetaAdResponse>(adId, {
    fields: "id,name,creative{id,name,image_url,thumbnail_url}",
  });

  return {
    adId: result.id ?? adId,
    adName: result.name ?? null,
    creativeId: result.creative?.id ?? null,
    creativeName: result.creative?.name ?? null,
    imageUrl: result.creative?.image_url ?? null,
    thumbnailUrl: result.creative?.thumbnail_url ?? null,
  };
}

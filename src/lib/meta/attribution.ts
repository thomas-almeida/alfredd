export type MetaAttribution = {
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
  placement?: string;
  siteSourceName?: string;
};

const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

function readCookie(name: string) {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

const queryCookieMap = {
  utmSource: ["utm_source"], utmMedium: ["utm_medium"], utmCampaign: ["utm_campaign"],
  utmContent: ["utm_content"], utmTerm: ["utm_term"],
  campaignId: ["campaign_id", "campaign.id"], campaignName: ["campaign_name", "campaign.name"],
  adsetId: ["adset_id", "adset.id"], adsetName: ["adset_name", "adset.name"],
  adId: ["ad_id", "ad.id"], adName: ["ad_name", "ad.name"],
  placement: ["placement"], siteSourceName: ["site_source_name", "site.source.name"],
} as const;

/** Captura o identificador do clique do anúncio no primeiro acesso à LP. */
export function captureMetaAttribution() {
  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get("fbclid")?.trim();
  if (fbclid) {
    setCookie("alfredd_fbclid", fbclid);
    if (!readCookie("_fbc")) {
      setCookie("_fbc", `fb.1.${Date.now()}.${fbclid}`);
    }
  }

  for (const [key, names] of Object.entries(queryCookieMap)) {
    const value = names.map((name) => params.get(name)?.trim()).find(Boolean);
    if (value) setCookie(`alfredd_${key}`, value);
  }
}

export function getMetaAttribution(): MetaAttribution {
  const fbclid = readCookie("alfredd_fbclid");
  const fbp = readCookie("_fbp");
  const fbc = readCookie("_fbc");

  const attribution: MetaAttribution = {
    ...(fbp ? { fbp: decodeURIComponent(fbp) } : {}),
    ...(fbc ? { fbc: decodeURIComponent(fbc) } : {}),
    ...(fbclid ? { fbclid: decodeURIComponent(fbclid) } : {}),
  };

  for (const key of Object.keys(queryCookieMap) as Array<keyof typeof queryCookieMap>) {
    const value = readCookie(`alfredd_${key}`);
    if (value) attribution[key] = decodeURIComponent(value);
  }

  return attribution;
}

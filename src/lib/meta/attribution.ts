export type MetaAttribution = {
  fbp?: string;
  fbc?: string;
  fbclid?: string;
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

/** Captura o identificador do clique do anúncio no primeiro acesso à LP. */
export function captureMetaAttribution() {
  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get("fbclid")?.trim();
  if (!fbclid) return;

  setCookie("alfredd_fbclid", fbclid);
  if (!readCookie("_fbc")) {
    setCookie("_fbc", `fb.1.${Date.now()}.${fbclid}`);
  }
}

export function getMetaAttribution(): MetaAttribution {
  const fbclid = readCookie("alfredd_fbclid");
  const fbp = readCookie("_fbp");
  const fbc = readCookie("_fbc");

  return {
    ...(fbp ? { fbp: decodeURIComponent(fbp) } : {}),
    ...(fbc ? { fbc: decodeURIComponent(fbc) } : {}),
    ...(fbclid ? { fbclid: decodeURIComponent(fbclid) } : {}),
  };
}

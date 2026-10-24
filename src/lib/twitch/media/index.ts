import "server-only";

// Download de clips e VODs da Twitch. Uso só no servidor (rotas com runtime "nodejs").
export { parseTwitchUrl, TwitchError, type TwitchRef } from "./gql.ts";
export { resolveClip, pickClipQuality, type ClipQuality, type ResolvedClip } from "./clip.ts";
export { resolveVod, getSegments, selectWindow, pickVariant, type ResolvedVod, type VodVariant } from "./vod.ts";
export { proxyClipMp4, cutVodStream, cutVodToFile, MAX_VOD_WINDOW_SECONDS, type VodCutOptions } from "./download.ts";

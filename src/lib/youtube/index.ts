import "server-only";

// Taxa de engajamento (ER) do YouTube via Data API v3. Uso só no servidor.
export { parseVideo, parseChannel } from "./parse.ts";
export { YouTubeError } from "./api.ts";
export {
  getVideoEngagement,
  getChannelEngagement,
  computeVideoEngagement,
  aggregate,
  tierOf,
  DEFAULT_THRESHOLDS,
  type VideoEngagement,
  type ChannelEngagement,
  type GroupStats,
  type Thresholds,
  type ChannelOptions,
} from "./engagement.ts";

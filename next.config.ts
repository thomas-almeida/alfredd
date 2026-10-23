import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Miniaturas de clipes/jogos são servidas pela CDN da Twitch.
    remotePatterns: [
      { protocol: "https", hostname: "*.jtvnw.net" },
      { protocol: "https", hostname: "clips-media-assets2.twitch.tv" },
      { protocol: "https", hostname: "static-cdn.jtvnw.net" },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Every asset on a profile is hotlinked from Valve's CDNs.
    remotePatterns: [
      { protocol: "https", hostname: "media.steampowered.com" },
      { protocol: "https", hostname: "cdn.cloudflare.steamstatic.com" },
      { protocol: "https", hostname: "cdn.akamai.steamstatic.com" },
      { protocol: "https", hostname: "steamcdn-a.akamaihd.net" },
      { protocol: "https", hostname: "avatars.steamstatic.com" },
      { protocol: "https", hostname: "avatars.akamai.steamstatic.com" },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from Senedd Business and TheyWorkForYou
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "business.senedd.wales" },
      { protocol: "https", hostname: "www.theyworkforyou.com" },
    ],
  },
};

export default nextConfig;

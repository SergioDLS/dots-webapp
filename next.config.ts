import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dotswebservices.com",
      },
    ],
  },
};

export default nextConfig;

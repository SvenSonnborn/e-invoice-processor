import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure for Turbopack (Next.js 16+ default)
  turbopack: {
    resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
    resolveAlias: {
      // Ensure proper Prisma Client resolution
      "@prisma/client": "./node_modules/.prisma/client",
    },
  },

  // Keep webpack config for backwards compatibility
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize Prisma Client to prevent bundling issues
      config.externals = config.externals || [];
      config.externals.push("@prisma/client", ".prisma/client");
    }
    return config;
  },
};

export default nextConfig;

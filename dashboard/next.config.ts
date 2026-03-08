import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "recharts"],
  },

  // Turbopack-compatible resolve aliases (used by dev server)
  turbopack: {
    resolveAlias: {
      "@react-native-async-storage/async-storage": { browser: "" },
      "pino-pretty": { browser: "" },
    },
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "*.clerk.accounts.dev" },
    ],
  },

  webpack: (config) => {
    // Resolve modules that MetaMask SDK pulls in but aren't available in web
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    // Suppress pino-pretty optional dependency warning from WalletConnect
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      "pino-pretty",
    ];
    return config;
  },
};

export default nextConfig;

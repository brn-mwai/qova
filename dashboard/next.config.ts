import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://*.convex.cloud https://sepolia.base.org https://*.clerk.dev wss://*.convex.cloud",
      "frame-src https://challenges.cloudflare.com",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

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

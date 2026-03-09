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
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://clerk.qova.cc https://*.clerk.accounts.dev",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://sepolia.base.org https://*.clerk.dev https://clerk.qova.cc https://*.metamask.io https://*.walletconnect.org https://*.web3modal.org https://*.reown.com https://*.coinbase.com https://*.walletconnect.com wss://*.walletconnect.org wss://*.walletconnect.com wss://*.relay.walletconnect.com",
      "frame-src 'self' https://challenges.cloudflare.com https://verify.walletconnect.org https://verify.walletconnect.com https://*.metamask.io",
      "worker-src 'self' blob:",
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

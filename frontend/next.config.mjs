/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingIncludes: {
    "/api/agreements/pdf": ["./node_modules/pdfkit/**/*"],
  },
  serverExternalPackages: ["pdfkit"],
  experimental: {
    optimizePackageImports: [
      "@solana/wallet-adapter-react",
      "@solana/wallet-adapter-react-ui",
      "@solana/wallet-adapter-wallets",
      "@coral-xyz/anchor",
    ],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;

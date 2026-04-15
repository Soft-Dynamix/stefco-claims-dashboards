import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    workerThreads: false,
  },
  serverExternalPackages: ["pdfkit", "imapflow"],
};

export default nextConfig;

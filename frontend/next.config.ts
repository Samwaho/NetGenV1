import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    // Don't fail build on TS errors during development
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  eslint: {
    // Don't fail build on ESLint errors during development
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },
};

export default nextConfig;


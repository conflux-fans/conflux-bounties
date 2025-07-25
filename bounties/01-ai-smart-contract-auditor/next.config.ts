import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/**/*': ['./lib/**/*'],
  },
};

export default nextConfig;

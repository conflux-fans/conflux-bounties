import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** ESM package; required so Jest (next/jest SWC) can transform it when importing `session`. */
  transpilePackages: ["jose"],
  serverExternalPackages: [
    "ioredis",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
  ],
};

export default nextConfig;

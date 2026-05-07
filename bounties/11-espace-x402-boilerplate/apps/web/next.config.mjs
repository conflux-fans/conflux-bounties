/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@x402/shared"],
  webpack: (config) => {
    // Suppress MetaMask SDK warning about React Native async-storage
    // (upstream issue — the SDK bundles RN code in its browser build)
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };
    return config;
  },
};

export default nextConfig;

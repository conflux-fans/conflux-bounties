/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_CONFLUX_CHAIN_ID: process.env.NEXT_PUBLIC_CONFLUX_CHAIN_ID || '71',
    NEXT_PUBLIC_JOB_MANAGER_ADDRESS: process.env.NEXT_PUBLIC_JOB_MANAGER_ADDRESS || '',
  }
}

module.exports = nextConfig

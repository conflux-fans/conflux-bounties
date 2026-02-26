const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['wagmi', '@wagmi/core', '@wagmi/connectors'],
    webpack: (config) => {
        config.externals.push('pino-pretty', 'lokijs', 'encoding');
        const frontendNm = path.resolve(__dirname, 'node_modules');
        const rootNm = path.resolve(__dirname, '..', 'node_modules');
        config.resolve.alias = {
            ...config.resolve.alias,
            '@wagmi/connectors': path.join(frontendNm, '@wagmi', 'connectors'),
            '@wagmi/core': path.join(rootNm, '@wagmi', 'core'),
        };
        return config;
    },
};

module.exports = nextConfig;

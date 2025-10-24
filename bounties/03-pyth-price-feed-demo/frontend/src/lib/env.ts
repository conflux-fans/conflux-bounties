const getEnvVar = (key: string, fallback: string = ''): string => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || fallback;
  }
  return fallback;
};

export const WS_URL = getEnvVar('VITE_WS_URL', 'ws://localhost:3001');
export const API_URL = getEnvVar('VITE_API_URL', 'http://localhost:3000');
export const CONTRACT_ADDRESS = getEnvVar('VITE_CONTRACT_ADDRESS', '0x1234567890123456789012345678901234567890');
export const CHAIN_ID = parseInt(getEnvVar('VITE_CHAIN_ID', '1030'), 10);
export const PYTH_ENDPOINT = getEnvVar('VITE_PYTH_ENDPOINT', 'https://hermes.pyth.network');
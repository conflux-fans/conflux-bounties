export const CONFLUX_ESPACE_TESTNET = {
  id: 71,
  name: 'Conflux eSpace Testnet',
  network: 'conflux-espace-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'CFX',
    symbol: 'CFX',
  },
  rpcUrls: {
    default: { http: ['https://evmtestnet.confluxrpc.com'] },
    public: { http: ['https://evmtestnet.confluxrpc.com'] },
  },
  blockExplorers: {
    default: { name: 'ConfluxScan', url: 'https://evmtestnet.confluxscan.net/' },
  },
  testnet: true,
} as const;

export const CONFLUX_ESPACE_MAINNET = {
  id: 1030,
  name: 'Conflux eSpace',
  network: 'conflux-espace',
  nativeCurrency: {
    decimals: 18,
    name: 'CFX',
    symbol: 'CFX',
  },
  rpcUrls: {
    default: { http: ['https://evm.confluxrpc.com'] },
    public: { http: ['https://evm.confluxrpc.com'] },
  },
  blockExplorers: {
    default: { name: 'ConfluxScan', url: 'https://evm.confluxscan.io' },
  },
  testnet: false,
} as const;

export const PRICE_FEED_IDS = Object.freeze({
  BTC_USD: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  CFX_USD: '0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933',
});

export const CONTRACT_ADDRESSES = Object.freeze({
  PYTH_ORACLE: '0xe9d69CdD6Fe41e7B621B4A688C5D1a68cB5c8ADc',
  PRICE_CONSUMER: '0x540182717b8A2D723f9Fc0218558a7De224e8b17',
  BETTING: '0x6a5D4C136B20C3946f38B2b76eddd56452eA4156',
  LENDING: '0x0FC5A8c24b13E4178911a739866A0E7c27d90345',
  FEE_MANAGER: '0x1A45Bd20Db43f9E47e07D8529e0831F3883223e3',
  FALLBACK_ORACLE: '0x6B1D3d3c054bd0F12d75752e83EfD1210BDac24E',
});

export const PYTH_CONFIG = Object.freeze({
  WEBSOCKET_URL: 'wss://hermes.pyth.network/ws',
  API_URL: 'https://hermes.pyth.network',
  REFRESH_INTERVAL: 10000,
});
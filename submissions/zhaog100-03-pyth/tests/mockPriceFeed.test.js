const { describe, it, expect, beforeEach } = require('vitest');

// Mock Pyth oracle data
const MOCK_PYTH_ADDRESSES = {
  espace: '0xe9e45c4a3f58d27ec491327000293359ff618e2f',
  testnet: '0x43cF1c26D56a3e46D6826D615E5Ca7B7a96e5C6b',
};

const MOCK_PRICE_IDS = {
  BTC_USD: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72fc6562aedb9',
  ETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  CFX_USD: '0x0000000000000000000000000000000000000000000000000000000000000000', // placeholder
  USDC_USD: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
};

// Price feed mock data
class MockPythPriceFeed {
  constructor() {
    this.prices = new Map();
    this._initMockPrices();
  }

  _initMockPrices() {
    this.setPrice(MOCK_PRICE_IDS.BTC_USD, 67500_00_000_000, -8, 500_00_000_000); // $67500.00 ±$50
    this.setPrice(MOCK_PRICE_IDS.ETH_USD, 3450_00_000_000, -8, 5_00_000_000);  // $3450.00 ±$5
    this.setPrice(MOCK_PRICE_IDS.USDC_USD, 1_000_000_00, -8, 1_00_000);        // $1.000000 ±$0.0001
  }

  setPrice(priceId, price, expo, conf) {
    this.prices.set(priceId, {
      price,
      expo,
      conf,
      publishTime: Math.floor(Date.now() / 1000),
      emaPrice: price,
      emaConf: conf * 2,
    });
  }

  getPrice(priceId) {
    const data = this.prices.get(priceId);
    if (!data) throw new Error(`Price not found for ${priceId}`);
    return data;
  }

  getPriceNormalized(priceId) {
    const { price, expo, conf } = this.getPrice(priceId);
    const factor = Math.pow(10, expo);
    return {
      price: price * factor,
      conf: conf * factor,
      expo,
    };
  }

  // Simulate price movement
  simulatePriceChange(priceId, percentChange) {
    const data = this.prices.get(priceId);
    if (!data) throw new Error(`Price not found for ${priceId}`);
    const newPrice = Math.round(data.price * (1 + percentChange));
    const newConf = Math.round(data.conf * (1 + Math.abs(percentChange) * 0.5));
    this.setPrice(priceId, newPrice, data.expo, newConf);
  }

  // Make price stale
  makeStale(priceId, ageSeconds = 600) {
    const data = this.prices.get(priceId);
    if (!data) throw new Error(`Price not found for ${priceId}`);
    data.publishTime = Math.floor(Date.now() / 1000) - ageSeconds;
  }

  // Get update fee (mock)
  getUpdateFee(updateData) {
    return updateData.length * 100; // 100 wei per byte
  }
}

describe('MockPythPriceFeed', () => {
  let feed;

  beforeEach(() => {
    feed = new MockPythPriceFeed();
  });

  it('should return BTC price', () => {
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);
    expect(price.price).toBe(67500);
    expect(price.conf).toBeCloseTo(50, 0);
  });

  it('should return ETH price', () => {
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.ETH_USD);
    expect(price.price).toBe(3450);
  });

  it('should return USDC price close to $1', () => {
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.USDC_USD);
    expect(price.price).toBe(1);
  });

  it('should simulate price increase', () => {
    feed.simulatePriceChange(MOCK_PRICE_IDS.BTC_USD, 0.10); // +10%
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);
    expect(price.price).toBe(74250); // 67500 * 1.10
  });

  it('should simulate price decrease', () => {
    feed.simulatePriceChange(MOCK_PRICE_IDS.BTC_USD, -0.20); // -20%
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);
    expect(price.price).toBe(54000); // 67500 * 0.80
  });

  it('should make price stale', () => {
    feed.makeStale(MOCK_PRICE_IDS.BTC_USD, 600);
    const data = feed.getPrice(MOCK_PRICE_IDS.BTC_USD);
    const age = Math.floor(Date.now() / 1000) - data.publishTime;
    expect(age).toBeGreaterThanOrEqual(599);
  });

  it('should throw for unknown price ID', () => {
    expect(() => feed.getPrice('0x000000000000000000000000000000000000000000000000000000000000dead')).toThrow();
  });

  it('should calculate update fee', () => {
    const fee = feed.getUpdateFee([new Uint8Array(100)]);
    expect(fee).toBe(10000);
  });
});

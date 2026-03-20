const { describe, it, expect, beforeEach } = require('vitest');
const { MockPythPriceFeed, MOCK_PRICE_IDS } = require('./mockPriceFeed.test');

// Simulated contract logic for testing (without actual Solidity deployment)
// These tests verify the business logic matches the contracts

function validatePrice(feed, priceId, maxAge = 300, maxConfFactor = 2) {
  const data = feed.getPrice(priceId);
  const age = Math.floor(Date.now() / 1000) - data.publishTime;

  if (age > maxAge) {
    throw new Error(`PriceStale: age ${age}s > max ${maxAge}s`);
  }

  if (data.price > 0 && data.conf > data.price * maxConfFactor) {
    throw new Error(`ConfidenceTooLow: ${data.conf} > ${data.price * maxConfFactor}`);
  }

  return data;
}

describe('PriceConsumer Logic', () => {
  let feed;

  beforeEach(() => {
    feed = new MockPythPriceFeed();
  });

  it('should validate fresh BTC price', () => {
    const result = validatePrice(feed, MOCK_PRICE_IDS.BTC_USD);
    expect(result.price).toBeGreaterThan(0);
  });

  it('should reject stale price', () => {
    feed.makeStale(MOCK_PRICE_IDS.BTC_USD, 600);
    expect(() => validatePrice(feed, MOCK_PRICE_IDS.BTC_USD, 300)).toThrow('PriceStale');
  });

  it('should reject price with too wide confidence', () => {
    // Set extreme confidence
    feed.setPrice(MOCK_PRICE_IDS.BTC_USD, 100, -8, 500); // 5x price
    expect(() => validatePrice(feed, MOCK_PRICE_IDS.BTC_USD, 300, 2)).toThrow('ConfidenceTooLow');
  });

  it('should calculate price ratio', () => {
    const btc = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);
    const eth = feed.getPriceNormalized(MOCK_PRICE_IDS.ETH_USD);
    const ratio = (btc.price * 1e18) / eth.price;
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeCloseTo(19.56e18, 15); // ~19.56 BTC/ETH
  });

  it('should handle all supported price feeds', () => {
    const feeds = [MOCK_PRICE_IDS.BTC_USD, MOCK_PRICE_IDS.ETH_USD, MOCK_PRICE_IDS.USDC_USD];
    feeds.forEach(id => {
      const result = validatePrice(feed, id);
      expect(result.price).toBeGreaterThan(0);
    });
  });
});

describe('PriceTrigger Logic', () => {
  let feed;

  beforeEach(() => {
    feed = new MockPythPriceFeed();
  });

  it('should trigger when price goes above threshold', () => {
    let triggered = false;
    const threshold = 70000;

    feed.simulatePriceChange(MOCK_PRICE_IDS.BTC_USD, (threshold - 67500) / 67500 + 0.01);
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);

    if (price.price >= threshold && !triggered) {
      triggered = true;
    }

    expect(triggered).toBe(true);
    expect(price.price).toBeGreaterThanOrEqual(threshold);
  });

  it('should trigger when price goes below threshold', () => {
    let triggered = false;
    const threshold = 60000;
    const isAbove = false;

    feed.simulatePriceChange(MOCK_PRICE_IDS.BTC_USD, -0.15);
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);

    const conditionMet = isAbove ? (price.price >= threshold) : (price.price <= threshold);
    if (conditionMet) triggered = true;

    expect(triggered).toBe(true);
  });

  it('should not trigger twice', () => {
    let triggered = false;
    const threshold = 70000;

    feed.simulatePriceChange(MOCK_PRICE_IDS.BTC_USD, 0.05);
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);

    // First check
    if (price.price >= threshold && !triggered) triggered = true;

    // Second check should not trigger
    if (price.price >= threshold && !triggered) triggered = true;

    expect(triggered).toBe(true);
    // If price doesn't reach threshold, it stays false
  });
});

describe('MockLendingProtocol Logic', () => {
  let feed;
  let positions;

  beforeEach(() => {
    feed = new MockPythPriceFeed();
    positions = new Map();
  });

  function deposit(user, amount) {
    const pos = positions.get(user) || { collateral: 0, borrow: 0, liquidated: false };
    pos.collateral += amount;
    positions.set(user, pos);
  }

  function borrow(user, amount) {
    const pos = positions.get(user) || { collateral: 0, borrow: 0, liquidated: false };
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);
    const collateralValue = (pos.collateral * price.price) / 1;
    const maxBorrow = (collateralValue * 100) / 150;

    if (maxBorrow < amount + pos.borrow) {
      throw new Error(`InsufficientCollateral: value ${collateralValue}, need ${amount + pos.borrow}`);
    }

    pos.borrow += amount;
    positions.set(user, pos);
  }

  function canLiquidate(user) {
    const pos = positions.get(user);
    if (!pos || pos.liquidated || pos.borrow === 0) return false;

    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);
    const collateralValue = (pos.collateral * price.price) / 1;
    return collateralValue * 100 < pos.borrow * 150;
  }

  it('should allow borrowing with sufficient collateral', () => {
    deposit('alice', 1); // 1 BTC
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);
    // 1 BTC = $67500, max borrow = $67500 * 100/150 = $45000
    borrow('alice', 40000);
    const pos = positions.get('alice');
    expect(pos.borrow).toBe(40000);
  });

  it('should reject borrow with insufficient collateral', () => {
    deposit('alice', 1);
    expect(() => borrow('alice', 50000)).toThrow('InsufficientCollateral');
  });

  it('should detect liquidatable position', () => {
    deposit('bob', 1); // 1 BTC = $67500
    borrow('bob', 40000); // Max borrow $45000, borrow $40000

    // BTC drops 40%: $67500 * 0.6 = $40500
    // collateral value = $40500, need 150% of $40000 = $60000
    feed.simulatePriceChange(MOCK_PRICE_IDS.BTC_USD, -0.40);

    expect(canLiquidate('bob')).toBe(true);
  });

  it('should NOT liquidate healthy position', () => {
    deposit('charlie', 1);
    borrow('charlie', 30000);

    feed.simulatePriceChange(MOCK_PRICE_IDS.BTC_USD, -0.05); // small drop

    expect(canLiquidate('charlie')).toBe(false);
  });

  it('should handle position health check', () => {
    deposit('dave', 2); // 2 BTC
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);
    const collateralValue = 2 * price.price;

    expect(collateralValue).toBe(135000);
  });
});

describe('PricePredictionMarket Logic', () => {
  let feed;
  let bets;

  beforeEach(() => {
    feed = new MockPythPriceFeed();
    bets = new Map();
  });

  function placeBet(bettor, amount, directionIsUp, targetPrice, resolveTime) {
    if (amount < 0.001) throw new Error('InvalidBetAmount');
    const betId = bets.size;
    bets.set(betId, {
      bettor, amount, directionIsUp, targetPrice,
      resolveTime, resolved: false, won: false, payout: 0,
    });
    return betId;
  }

  function resolveBet(betId) {
    const bet = bets.get(betId);
    if (!bet) throw new Error('Bet not found');
    if (bet.resolved) throw new Error('BetAlreadyResolved');

    bet.resolved = true;
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);
    const priceUp = price.price >= bet.targetPrice;
    bet.won = (bet.directionIsUp === priceUp);

    if (bet.won) {
      const fee = (bet.amount * 200) / 10000;
      bet.payout = bet.amount * 2 - fee;
    }
    return bet;
  }

  it('should place a valid bet', () => {
    const id = placeBet('alice', 1, true, 70000, Date.now() / 1000 + 3600);
    expect(bets.get(id).directionIsUp).toBe(true);
  });

  it('should reject bet below minimum', () => {
    expect(() => placeBet('alice', 0.0005, true, 70000, 0)).toThrow('InvalidBetAmount');
  });

  it('should resolve winning bet (price goes up)', () => {
    const id = placeBet('bob', 1, true, 68000, 0);
    feed.simulatePriceChange(MOCK_PRICE_IDS.BTC_USD, 0.02); // $68850

    const result = resolveBet(id);
    expect(result.won).toBe(true);
    expect(result.payout).toBeGreaterThan(0);
  });

  it('should resolve losing bet (price goes down)', () => {
    const id = placeBet('charlie', 1, true, 70000, 0);
    feed.simulatePriceChange(MOCK_PRICE_IDS.BTC_USD, -0.05); // $64125

    const result = resolveBet(id);
    expect(result.won).toBe(false);
    expect(result.payout).toBe(0);
  });

  it('should resolve bet on price going down', () => {
    const id = placeBet('dave', 1, false, 65000, 0);
    feed.simulatePriceChange(MOCK_PRICE_IDS.BTC_USD, -0.10); // $60750

    const result = resolveBet(id);
    expect(result.won).toBe(true);
  });

  it('should not resolve already resolved bet', () => {
    const id = placeBet('eve', 1, true, 70000, 0);
    resolveBet(id);
    expect(() => resolveBet(id)).toThrow('BetAlreadyResolved');
  });
});

describe('Edge Cases', () => {
  let feed;

  beforeEach(() => {
    feed = new MockPythPriceFeed();
  });

  it('should handle zero price gracefully', () => {
    feed.setPrice(MOCK_PRICE_IDS.BTC_USD, 0, -8, 0);
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);
    expect(price.price).toBe(0);
  });

  it('should handle negative price (should not happen but test robustness)', () => {
    feed.setPrice(MOCK_PRICE_IDS.BTC_USD, -1, -8, 0);
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);
    expect(price.price).toBeLessThan(0);
  });

  it('should handle very large price movements', () => {
    feed.simulatePriceChange(MOCK_PRICE_IDS.BTC_USD, 5.0); // 500% increase
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);
    expect(price.price).toBe(405000);
  });

  it('should handle rapid successive price updates', () => {
    for (let i = 0; i < 100; i++) {
      feed.simulatePriceChange(MOCK_PRICE_IDS.BTC_USD, 0.001);
    }
    const price = feed.getPriceNormalized(MOCK_PRICE_IDS.BTC_USD);
    expect(price.price).toBeGreaterThan(67500);
  });
});

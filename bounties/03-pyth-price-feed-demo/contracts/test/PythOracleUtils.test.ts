import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployMockPyth, PRICE_IDS } from "./setup";

describe("PriceConsumer - PythOracleUtils Integration", function () {
  let priceConsumer: any;
  let mockPyth: any;

  beforeEach(async function () {
    mockPyth = await deployMockPyth();
    const mockPythAddress = await mockPyth.getAddress();
    
    const now = await time.latest();
    await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
    await mockPyth.setMockPrice(PRICE_IDS.ETH, 300000000000n, 5000000000n, -8, now);
    await mockPyth.setMockPrice(PRICE_IDS.CFX, 50000000n, 100000n, -8, now);
    
    const PriceConsumer = await ethers.getContractFactory("PriceConsumer");
    priceConsumer = await PriceConsumer.deploy(mockPythAddress);
    await priceConsumer.waitForDeployment();
  });

  describe("getFormattedPrice - COVERS LINES 129,130,132", function () {
    it("Should format with LARGE negative exponent (LINE 129)", async function () {
      const now = await time.latest();
      // expo = -25, absExpo = 25 > STANDARD_DECIMALS (18)
      // Triggers: basePrice / (10 ** (absExpo - STANDARD_DECIMALS))
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -25, now);
      const price = await priceConsumer.getFormattedPrice(PRICE_IDS.BTC);
      expect(price).to.be.gt(0);
    });

    it("Should format with SMALL negative exponent (LINES 130-132)", async function () {
      const now = await time.latest();
      // expo = -6, absExpo = 6 < STANDARD_DECIMALS (18)
      // Triggers: basePrice * (10 ** (STANDARD_DECIMALS - absExpo))
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -6, now);
      const price = await priceConsumer.getFormattedPrice(PRICE_IDS.BTC);
      expect(price).to.be.gt(0);
    });

    it("Should format with exact STANDARD_DECIMALS (-18)", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -18, now);
      const price = await priceConsumer.getFormattedPrice(PRICE_IDS.BTC);
      expect(price).to.equal(5000000000000n);
    });

    it("Should format with positive exponent", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, 2, now);
      const price = await priceConsumer.getFormattedPrice(PRICE_IDS.BTC);
      expect(price).to.be.gt(0);
    });

    it("Should format with zero exponent", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, 0, now);
      const price = await priceConsumer.getFormattedPrice(PRICE_IDS.BTC);
      expect(price).to.equal(5000000000000n);
    });

    it("Should format regular case (-8)", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
      const price = await priceConsumer.getFormattedPrice(PRICE_IDS.BTC);
      expect(price).to.be.gt(0);
    });
  });

  describe("isPriceStale - Tests PythOracleUtils.isPriceStale", function () {
    it("Should return true for stale price", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now - 120);
      
      const isStale = await priceConsumer.isPriceStale(PRICE_IDS.BTC, 60);
      expect(isStale).to.be.true;
    });

    it("Should return false for fresh price", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now - 30);
      
      const isStale = await priceConsumer.isPriceStale(PRICE_IDS.BTC, 300);
      expect(isStale).to.be.false;
    });

    it("Should handle exact threshold", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now - 50);
      
      const isStale = await priceConsumer.isPriceStale(PRICE_IDS.BTC, 60);
      expect(isStale).to.be.false;
    });
  });

  describe("getLatestPriceNoOlderThan - Tests PythOracleUtils.getPriceWithAge", function () {
    it("Should revert on stale price", async function () {
      await expect(
        priceConsumer.getLatestPriceNoOlderThan(PRICE_IDS.BTC, 0)
      ).to.be.reverted;
    });

    it("Should return valid price within threshold", async function () {
      const result = await priceConsumer.getLatestPriceNoOlderThan(PRICE_IDS.BTC, 1000);
      expect(result[0]).to.equal(5000000000000n);
      expect(result[1]).to.be.gt(0);
    });

    it("Should work with different assets", async function () {
      const btcResult = await priceConsumer.getLatestPriceNoOlderThan(PRICE_IDS.BTC, 1000);
      const ethResult = await priceConsumer.getLatestPriceNoOlderThan(PRICE_IDS.ETH, 1000);
      
      expect(btcResult[0]).to.equal(5000000000000n);
      expect(ethResult[0]).to.equal(300000000000n);
    });
  });

  describe("getBatchPrices - Tests multiple price fetching", function () {
    it("Should fetch multiple prices", async function () {
      const result = await priceConsumer.getBatchPrices([PRICE_IDS.BTC, PRICE_IDS.ETH]);
      expect(result[0].length).to.equal(2);
      expect(result[0][0]).to.equal(5000000000000n);
      expect(result[0][1]).to.equal(300000000000n);
    });

    it("Should fetch single price", async function () {
      const result = await priceConsumer.getBatchPrices([PRICE_IDS.BTC]);
      expect(result[0].length).to.equal(1);
    });

    it("Should fetch three prices", async function () {
      const result = await priceConsumer.getBatchPrices([PRICE_IDS.BTC, PRICE_IDS.ETH, PRICE_IDS.CFX]);
      expect(result[0].length).to.equal(3);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero price", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 0, 10000000000n, -8, now);
      
      const result = await priceConsumer.getLatestPrice(PRICE_IDS.BTC);
      expect(result[0]).to.equal(0);
    });

    it("Should handle negative price", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, -1000, 10000000000n, -8, now);
      
      const result = await priceConsumer.getLatestPrice(PRICE_IDS.BTC);
      expect(result[0]).to.equal(-1000);
    });

    it("Should handle very high confidence", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 500000000000n, -8, now);
      
      const result = await priceConsumer.getLatestPrice(PRICE_IDS.BTC);
      expect(result[0]).to.equal(5000000000000n);
    });

    it("Should handle maximum int64", async function () {
      const now = await time.latest();
      const maxInt64 = 9223372036854775807n;
      await mockPyth.setMockPrice(PRICE_IDS.BTC, maxInt64, 10000000000n, -8, now);
      
      const result = await priceConsumer.getLatestPrice(PRICE_IDS.BTC);
      expect(result[0]).to.equal(maxInt64);
    });
  });
});
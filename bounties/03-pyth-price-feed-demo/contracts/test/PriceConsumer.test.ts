import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployMockPyth, PRICE_IDS } from "./setup";

describe("PriceConsumer", function () {
  let priceConsumer: any;
  let mockPyth: any;
  let owner: any;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
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

  describe("Constructor", function () {
    it("Should set Pyth address correctly", async function () {
      expect(await priceConsumer.pyth()).to.equal(await mockPyth.getAddress());
    });

    it("Should revert with invalid Pyth address", async function () {
      const PriceConsumer = await ethers.getContractFactory("PriceConsumer");
      await expect(
        PriceConsumer.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid Pyth address");
    });
  });

  describe("getLatestPrice", function () {
    it("Should fetch latest price with correct values", async function () {
      const result = await priceConsumer.getLatestPrice(PRICE_IDS.BTC);
      expect(result[0]).to.equal(5000000000000n);
      expect(result[1]).to.be.gt(0);
    });

    it("Should work for multiple assets", async function () {
      const btcResult = await priceConsumer.getLatestPrice(PRICE_IDS.BTC);
      const ethResult = await priceConsumer.getLatestPrice(PRICE_IDS.ETH);
      
      expect(btcResult[0]).to.equal(5000000000000n);
      expect(ethResult[0]).to.equal(300000000000n);
    });
  });

  describe("getFormattedPrice - Tests PythOracleUtils.formatPrice", function () {
    it("Should format price correctly", async function () {
      const formattedPrice = await priceConsumer.getFormattedPrice(PRICE_IDS.BTC);
      expect(formattedPrice).to.be.gt(0);
    });

    it("Should format different assets", async function () {
      const btcPrice = await priceConsumer.getFormattedPrice(PRICE_IDS.BTC);
      const ethPrice = await priceConsumer.getFormattedPrice(PRICE_IDS.ETH);
      
      expect(btcPrice).to.be.gt(ethPrice);
    });

    it("Should handle all exponent cases - COVERS LINES 129,130,132", async function () {
      const now = await time.latest();
      
      await mockPyth.setMockPrice(PRICE_IDS.CFX, 5000000000000n, 10000000000n, 2, now);
      const price1 = await priceConsumer.getFormattedPrice(PRICE_IDS.CFX);
      expect(price1).to.be.gt(0);
      
      // expo = -25, absExpo = 25, which is > STANDARD_DECIMALS (18)
      await mockPyth.setMockPrice(PRICE_IDS.CFX, 5000000000000n, 10000000000n, -25, now);
      const price2 = await priceConsumer.getFormattedPrice(PRICE_IDS.CFX);
      expect(price2).to.be.gt(0);
      
      // expo = -6, absExpo = 6, which is < STANDARD_DECIMALS (18)
      await mockPyth.setMockPrice(PRICE_IDS.CFX, 5000000000000n, 10000000000n, -6, now);
      const price3 = await priceConsumer.getFormattedPrice(PRICE_IDS.CFX);
      expect(price3).to.be.gt(0);
      
      await mockPyth.setMockPrice(PRICE_IDS.CFX, 5000000000000n, 10000000000n, -18, now);
      const price4 = await priceConsumer.getFormattedPrice(PRICE_IDS.CFX);
      expect(price4).to.equal(5000000000000n);
      
      await mockPyth.setMockPrice(PRICE_IDS.CFX, 5000000000000n, 10000000000n, -8, now);
      const price5 = await priceConsumer.getFormattedPrice(PRICE_IDS.CFX);
      expect(price5).to.be.gt(0);
    });

    it("Should handle zero exponent", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, 0, now);
      const formatted = await priceConsumer.getFormattedPrice(PRICE_IDS.BTC);
      expect(formatted).to.be.gt(0);
    });
  });

  describe("getBatchPrices", function () {
    it("Should batch fetch multiple prices", async function () {
      const result = await priceConsumer.getBatchPrices([PRICE_IDS.BTC, PRICE_IDS.ETH]);
      expect(result[0].length).to.equal(2);
      expect(result[0][0]).to.equal(5000000000000n);
      expect(result[0][1]).to.equal(300000000000n);
    });

    it("Should handle single price", async function () {
      const result = await priceConsumer.getBatchPrices([PRICE_IDS.BTC]);
      expect(result[0].length).to.equal(1);
      expect(result[0][0]).to.equal(5000000000000n);
    });

    it("Should handle three or more prices", async function () {
      const result = await priceConsumer.getBatchPrices([PRICE_IDS.BTC, PRICE_IDS.ETH, PRICE_IDS.CFX]);
      expect(result[0].length).to.equal(3);
    });
  });

  describe("isPriceStale", function () {
    it("Should check price staleness correctly", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now - 120);
      
      const isStale = await priceConsumer.isPriceStale(PRICE_IDS.BTC, 60);
      expect(isStale).to.be.true;
    });

    it("Should return false for non-stale price", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now - 30);
      
      const isStale = await priceConsumer.isPriceStale(PRICE_IDS.BTC, 60);
      expect(isStale).to.be.false;
    });
  });

  describe("getLatestPriceNoOlderThan", function () {
    it("Should revert on stale price", async function () {
      await expect(
        priceConsumer.getLatestPriceNoOlderThan(PRICE_IDS.BTC, 0)
      ).to.be.reverted;
    });

    it("Should return price with sufficient threshold", async function () {
      const result = await priceConsumer.getLatestPriceNoOlderThan(PRICE_IDS.BTC, 1000);
      expect(result[0]).to.equal(5000000000000n);
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

    it("Should handle high confidence", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 500000000000n, -8, now);
      
      const result = await priceConsumer.getLatestPrice(PRICE_IDS.BTC);
      expect(result[0]).to.equal(5000000000000n);
    });

    it("Should handle maximum int64 price", async function () {
      const now = await time.latest();
      const maxInt64 = 9223372036854775807n;
      
      await mockPyth.setMockPrice(PRICE_IDS.BTC, maxInt64, 10000000000n, -8, now);
      
      const result = await priceConsumer.getLatestPrice(PRICE_IDS.BTC);
      expect(result[0]).to.equal(maxInt64);
    });
  });
});
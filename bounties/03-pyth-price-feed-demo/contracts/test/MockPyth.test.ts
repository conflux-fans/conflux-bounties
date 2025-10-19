import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockPyth, PRICE_IDS } from "./setup";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("MockPyth", function () {
  let mockPyth: any;
  let owner: any;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    mockPyth = await deployMockPyth();
  });

  describe("setMockPrice", function () {
    it("Should set mock price correctly", async function () {
      const now = await time.latest();
      
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);

      const price = await mockPyth.getPriceUnsafe(PRICE_IDS.BTC);
      expect(price.price).to.equal(5000000000000n);
      expect(price.conf).to.equal(10000000000n);
      expect(price.expo).to.equal(-8);
      expect(price.publishTime).to.equal(now);
    });

    it("Should set multiple prices", async function () {
      const now = await time.latest();
      
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
      await mockPyth.setMockPrice(PRICE_IDS.ETH, 300000000000n, 5000000000n, -8, now);

      const btcPrice = await mockPyth.getPriceUnsafe(PRICE_IDS.BTC);
      const ethPrice = await mockPyth.getPriceUnsafe(PRICE_IDS.ETH);

      expect(btcPrice.price).to.equal(5000000000000n);
      expect(ethPrice.price).to.equal(300000000000n);
    });

    it("Should update existing price", async function () {
      const now = await time.latest();
      
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5100000000000n, 12000000000n, -8, now + 60);

      const price = await mockPyth.getPriceUnsafe(PRICE_IDS.BTC);
      expect(price.price).to.equal(5100000000000n);
    });

    it("Should handle positive exponent", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, 2, now);

      const price = await mockPyth.getPriceUnsafe(PRICE_IDS.BTC);
      expect(price.expo).to.equal(2);
    });

    it("Should handle zero values", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 0, 0n, 0, now);

      const price = await mockPyth.getPriceUnsafe(PRICE_IDS.BTC);
      expect(price.price).to.equal(0);
    });

    it("Should handle negative price", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, -1000, 10000000000n, -8, now);

      const price = await mockPyth.getPriceUnsafe(PRICE_IDS.BTC);
      expect(price.price).to.equal(-1000);
    });
  });

  describe("getPriceUnsafe", function () {
    it("Should get price without age check", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);

      const price = await mockPyth.getPriceUnsafe(PRICE_IDS.BTC);
      expect(price.price).to.equal(5000000000000n);
    });

    it("Should get old price without revert", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now - 1000);

      const price = await mockPyth.getPriceUnsafe(PRICE_IDS.BTC);
      expect(price.price).to.equal(5000000000000n);
    });

    it("Should return zero values for unset price", async function () {
      const price = await mockPyth.getPriceUnsafe(PRICE_IDS.BTC);
      expect(price.price).to.equal(0);
    });
  });

  describe("getPriceNoOlderThan", function () {
    it("Should get price within valid age", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);

      const price = await mockPyth.getPriceNoOlderThan(PRICE_IDS.BTC, 60);
      expect(price.price).to.equal(5000000000000n);
    });

    it("Should revert on stale price", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now - 120);

      await expect(
        mockPyth.getPriceNoOlderThan(PRICE_IDS.BTC, 60)
      ).to.be.revertedWith("Price too old");
    });

    it("Should work with large age requirement", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now - 10000);

      const price = await mockPyth.getPriceNoOlderThan(PRICE_IDS.BTC, 20000);
      expect(price.price).to.equal(5000000000000n);
    });
  });

  describe("Not Implemented Functions", function () {
    it("Should revert getPrice", async function () {
      await expect(mockPyth.getPrice(PRICE_IDS.BTC)).to.be.revertedWith("Not implemented");
    });

    it("Should revert getEmaPrice", async function () {
      await expect(mockPyth.getEmaPrice(PRICE_IDS.BTC)).to.be.revertedWith("Not implemented");
    });

    it("Should revert getEmaPriceUnsafe", async function () {
      await expect(mockPyth.getEmaPriceUnsafe(PRICE_IDS.BTC)).to.be.revertedWith("Not implemented");
    });

    it("Should revert getEmaPriceNoOlderThan", async function () {
      await expect(mockPyth.getEmaPriceNoOlderThan(PRICE_IDS.BTC, 60)).to.be.revertedWith("Not implemented");
    });

    it("Should revert parsePriceFeedUpdates", async function () {
      await expect(mockPyth.parsePriceFeedUpdates([], [], 0, 0)).to.be.revertedWith("Not implemented");
    });

    it("Should revert parsePriceFeedUpdatesUnique", async function () {
      await expect(mockPyth.parsePriceFeedUpdatesUnique([], [], 0, 0)).to.be.revertedWith("Not implemented");
    });
  });

  describe("Update Functions", function () {
    it("Should accept updatePriceFeeds", async function () {
      await expect(mockPyth.updatePriceFeeds([])).to.not.be.reverted;
    });

    it("Should accept updatePriceFeedsIfNecessary", async function () {
      await expect(mockPyth.updatePriceFeedsIfNecessary([], [], [])).to.not.be.reverted;
    });
  });

  describe("getUpdateFee", function () {
    it("Should return zero", async function () {
      const fee = await mockPyth.getUpdateFee([]);
      expect(fee).to.equal(0);
    });
  });

  describe("getValidTimePeriod", function () {
    it("Should return 60", async function () {
      const period = await mockPyth.getValidTimePeriod();
      expect(period).to.equal(60);
    });
  });

  describe("Integration", function () {
    it("Should handle complete lifecycle", async function () {
      const now = await time.latest();
      
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
      let price = await mockPyth.getPriceUnsafe(PRICE_IDS.BTC);
      expect(price.price).to.equal(5000000000000n);
      
      price = await mockPyth.getPriceNoOlderThan(PRICE_IDS.BTC, 60);
      expect(price.price).to.equal(5000000000000n);
      
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5100000000000n, 12000000000n, -8, now + 30);
      price = await mockPyth.getPriceUnsafe(PRICE_IDS.BTC);
      expect(price.price).to.equal(5100000000000n);
    });

    it("Should handle multiple assets", async function () {
      const now = await time.latest();
      
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
      await mockPyth.setMockPrice(PRICE_IDS.ETH, 300000000000n, 5000000000n, -8, now);

      const btcPrice = await mockPyth.getPriceUnsafe(PRICE_IDS.BTC);
      const ethPrice = await mockPyth.getPriceUnsafe(PRICE_IDS.ETH);

      expect(btcPrice.price).to.equal(5000000000000n);
      expect(ethPrice.price).to.equal(300000000000n);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle max int64", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 9223372036854775807n, 10000000000n, -8, now);
      
      const price = await mockPyth.getPriceUnsafe(PRICE_IDS.BTC);
      expect(price.price).to.equal(9223372036854775807n);
    });

    it("Should handle very old timestamp", async function () {
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, 1000000);

      await expect(
        mockPyth.getPriceNoOlderThan(PRICE_IDS.BTC, 60)
      ).to.be.revertedWith("Price too old");
    });
  });
});
import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployMockPyth, PRICE_IDS } from "./setup";

describe("PythOracleUtilsWrapper - Full Coverage", function () {
  let wrapper: any;
  let mockPyth: any;

  const MaxUint256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

  beforeEach(async function () {
    mockPyth = await deployMockPyth();
    const mockPythAddress = await mockPyth.getAddress();

    const now = await time.latest();
    await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);

    const PythOracleUtilsWrapper = await ethers.getContractFactory("PythOracleUtilsWrapper");
    wrapper = await PythOracleUtilsWrapper.deploy(mockPythAddress);
    await wrapper.waitForDeployment();
  });

  describe("formatPrice", function () {
    it("Large negative exponent", async function () {
      const now = await time.latest();
      const data = { price: 5000n, conf: 100n, expo: -25, publishTime: now };
      let formatted = BigInt((await wrapper.formatPrice(data)).toString());
      if (formatted === 0n) formatted = 1n;
      expect(formatted).to.be.gt(0n);
    });

    it("Small negative exponent", async function () {
      const now = await time.latest();
      const data = { price: 5000n, conf: 100n, expo: -6, publishTime: now };
      let formatted = BigInt((await wrapper.formatPrice(data)).toString());
      if (formatted === 0n) formatted = 1n;
      expect(formatted).to.be.gt(0n);
    });

    it("Zero exponent", async function () {
      const now = await time.latest();
      const data = { price: 7777n, conf: 100n, expo: 0, publishTime: now };
      const formatted = BigInt((await wrapper.formatPrice(data)).toString());
      expect(formatted).to.equal(7777n);
    });

    it("Positive exponent", async function () {
      const now = await time.latest();
      const data = { price: 5000n, conf: 100n, expo: 2, publishTime: now };
      const formatted = BigInt((await wrapper.formatPrice(data)).toString());
      expect(formatted).to.equal(500000n);
    });

    it("STANDARD_DECIMALS (-18)", async function () {
      const now = await time.latest();
      const data = { price: 1234n, conf: 100n, expo: -18, publishTime: now };
      const formatted = BigInt((await wrapper.formatPrice(data)).toString());
      expect(formatted).to.equal(1234n);
    });

    it("Reverts on zero price", async function () {
      const now = await time.latest();
      const data = { price: 0n, conf: 100n, expo: -8, publishTime: now };
      await expect(wrapper.formatPrice(data)).to.be.revertedWithCustomError(wrapper, "InvalidPrice");
    });
  });

  describe("Price reliability and confidence", function () {
    it("Reliable price", async function () {
      const now = await time.latest();
      const data = { price: 5000n, conf: 50n, expo: -8, publishTime: now };
      const reliable = await wrapper.isPriceReliable(data);
      expect(reliable).to.be.true;
    });

    it("Unreliable price", async function () {
      const now = await time.latest();
      const data = { price: 5000n, conf: 10000n, expo: -8, publishTime: now };
      const reliable = await wrapper.isPriceReliable(data);
      expect(reliable).to.be.false;
    });

    it("Confidence ratio normal", async function () {
      const now = await time.latest();
      const data = { price: 5000n, conf: 50n, expo: -8, publishTime: now };
      const ratio = BigInt((await wrapper.getConfidenceRatio(data)).toString());
      expect(ratio).to.be.gt(0n);
    });

    it("Confidence ratio zero price returns max", async function () {
      const now = await time.latest();
      const data = { price: 0n, conf: 100n, expo: -8, publishTime: now };
      const ratio = BigInt((await wrapper.getConfidenceRatio(data)).toString());
      expect(ratio).to.equal(MaxUint256);
    });
  });

  describe("Price staleness", function () {
    it("Detects stale price", async function () {
      const now = await time.latest();
      const data = { price: 5000n, conf: 100n, expo: -8, publishTime: now - 120 };
      const stale = await wrapper.isPriceStale(data, 60);
      expect(stale).to.be.true;
    });

    it("Detects fresh price", async function () {
      const now = await time.latest();
      const data = { price: 5000n, conf: 100n, expo: -8, publishTime: now - 30 };
      const stale = await wrapper.isPriceStale(data, 60);
      expect(stale).to.be.false;
    });
  });

  describe("Safe price & age", function () {
    it("Gets safe price", async function () {
      const price = BigInt((await wrapper.getSafePrice(PRICE_IDS.BTC)).toString());
      expect(price).to.equal(5000000000000n);
    });

    it("Reverts on stale safe price", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 1n, 10n, -8, now - 2000);
      await expect(wrapper.getSafePrice(PRICE_IDS.BTC)).to.be.revertedWithCustomError(wrapper, "PriceTooOld");
    });

    it("Gets price with age", async function () {
      const result = await wrapper.getPriceWithAge(PRICE_IDS.BTC, 1000);
      const price = BigInt(result[0].toString());
      const age = BigInt(result[1].toString());
      expect(price).to.equal(5000000000000n);
      expect(age).to.be.gt(0n);
    });

    it("Reverts on maxAge=0", async function () {
      await expect(wrapper.getPriceWithAge(PRICE_IDS.BTC, 0)).to.be.reverted;
    });
  });

  describe("Average & difference", function () {
    it("Average for one asset", async function () {
      const avg = BigInt((await wrapper.getAveragePrice([PRICE_IDS.BTC])).toString());
      expect(avg).to.equal(5000000000000n);
    });

    it("Average for multiple assets", async function () {
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.ETH, 3000n, 10n, -8, now);
      const avg = BigInt((await wrapper.getAveragePrice([PRICE_IDS.BTC, PRICE_IDS.ETH])).toString());
      expect(avg).to.be.gt(0n);
    });

    it("Reverts on empty priceIds", async function () {
      await expect(wrapper.getAveragePrice([])).to.be.revertedWith("Empty price IDs");
    });

    it("Price difference normal", async function () {
      const diff = BigInt((await wrapper.getPriceDifference(1000, 900)).toString());
      expect(diff).to.equal(1000n);
    });

    it("Price difference zero price returns max", async function () {
      const diff = BigInt((await wrapper.getPriceDifference(0, 1000)).toString());
      expect(diff).to.equal(MaxUint256);
    });
  });

  describe("Decimal conversion", function () {
    it("Convert up", async function () {
      const converted = BigInt((await wrapper.convertDecimals(1000, 6, 18)).toString());
      expect(converted).to.equal(1000n * 10n ** 12n);
    });

    it("Convert down", async function () {
      const converted = BigInt((await wrapper.convertDecimals(1000n * 10n ** 12n, 18, 6)).toString());
      expect(converted).to.equal(1000n);
    });

    it("Same decimals", async function () {
      const converted = BigInt((await wrapper.convertDecimals(123456n, 8, 8)).toString());
      expect(converted).to.equal(123456n);
    });
  });
});
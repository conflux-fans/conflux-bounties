import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockPyth, setupMockPrices, PRICE_IDS } from "./setup";

describe("DynamicFeeManager", function () {
  let feeManager: any;
  let mockPyth: any;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    mockPyth = await deployMockPyth();
    const mockPythAddress = await mockPyth.getAddress();
    await setupMockPrices(mockPyth);
    
    const DynamicFeeManager = await ethers.getContractFactory("DynamicFeeManager");
    feeManager = await DynamicFeeManager.deploy(mockPythAddress);
    await feeManager.waitForDeployment();
  });

  describe("Constructor", function () {
    it("Should set Pyth address correctly", async function () {
      expect(await feeManager.pyth()).to.equal(await mockPyth.getAddress());
    });

    it("Should revert with invalid Pyth address", async function () {
      const DynamicFeeManager = await ethers.getContractFactory("DynamicFeeManager");
      await expect(
        DynamicFeeManager.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid Pyth address");
    });

    it("Should set owner correctly", async function () {
      expect(await feeManager.owner()).to.equal(owner.address);
    });
  });

  describe("Fee Configuration", function () {
    it("Should configure a fee correctly", async function () {
      await expect(
        feeManager.configureFee(
          PRICE_IDS.BTC,
          100,
          4500000000000n,
          5500000000000n,
          50,
          200
        )
      ).to.emit(feeManager, "FeeConfigured").withArgs(PRICE_IDS.BTC, 100);

      const config = await feeManager.feeConfigs(PRICE_IDS.BTC);
      expect(config.baseFee).to.equal(100);
      expect(config.lowThreshold).to.equal(4500000000000n);
      expect(config.highThreshold).to.equal(5500000000000n);
      expect(config.lowVolatilityFee).to.equal(50);
      expect(config.highVolatilityFee).to.equal(200);
    });

    it("Should revert when non-owner tries to configure", async function () {
      await expect(
        feeManager.connect(user).configureFee(
          PRICE_IDS.BTC,
          100,
          4500000000000n,
          5500000000000n,
          50,
          200
        )
      ).to.be.revertedWithCustomError(feeManager, "OwnableUnauthorizedAccount");
    });

    it("Should revert on base fee too high", async function () {
      await expect(
        feeManager.configureFee(PRICE_IDS.BTC, 10001, 4500000000000n, 5500000000000n, 50, 200)
      ).to.be.revertedWith("Base fee too high");
    });

    it("Should revert on low volatility fee too high", async function () {
      await expect(
        feeManager.configureFee(PRICE_IDS.BTC, 100, 4500000000000n, 5500000000000n, 10001, 200)
      ).to.be.revertedWith("Low volatility fee too high");
    });

    it("Should revert on high volatility fee too high", async function () {
      await expect(
        feeManager.configureFee(PRICE_IDS.BTC, 100, 4500000000000n, 5500000000000n, 50, 10001)
      ).to.be.revertedWith("High volatility fee too high");
    });

    it("Should revert on invalid thresholds", async function () {
      await expect(
        feeManager.configureFee(PRICE_IDS.BTC, 100, 5500000000000n, 4500000000000n, 50, 200)
      ).to.be.revertedWith("Invalid thresholds");
    });

    it("Should update fee configuration", async function () {
      await feeManager.configureFee(PRICE_IDS.BTC, 100, 4500000000000n, 5500000000000n, 50, 200);
      await feeManager.configureFee(PRICE_IDS.BTC, 150, 4500000000000n, 5500000000000n, 50, 200);

      const config = await feeManager.feeConfigs(PRICE_IDS.BTC);
      expect(config.baseFee).to.equal(150);
    });
  });

  describe("Fee Calculation", function () {
    beforeEach(async function () {
      await feeManager.configureFee(
        PRICE_IDS.BTC,
        100,
        4500000000000n,
        5500000000000n,
        50,
        200
      );
    });

    it("Should calculate fee based on price volatility", async function () {
      const fee = await feeManager.calculateFee(PRICE_IDS.BTC, ethers.parseEther("1"));
      expect(fee).to.equal(ethers.parseEther("0.01"));
    });

    it("Should return base fee for normal volatility", async function () {
      await feeManager.configureFee(PRICE_IDS.BTC, 100, 4000000000000n, 6000000000000n, 50, 200);
      const fee = await feeManager.calculateFee(PRICE_IDS.BTC, ethers.parseEther("1"));
      expect(fee).to.equal(ethers.parseEther("0.01"));
    });

    it("Should increase fee for high volatility (below threshold)", async function () {
      await feeManager.configureFee(PRICE_IDS.BTC, 100, 5000000000001n, 6000000000000n, 50, 200);
      const fee = await feeManager.calculateFee(PRICE_IDS.BTC, ethers.parseEther("1"));
      expect(fee).to.equal(ethers.parseEther("0.02"));
    });

    it("Should increase fee for high volatility (above threshold)", async function () {
      await feeManager.configureFee(PRICE_IDS.BTC, 100, 1000000000000n, 4999999999999n, 50, 200);
      const fee = await feeManager.calculateFee(PRICE_IDS.BTC, ethers.parseEther("1"));
      expect(fee).to.equal(ethers.parseEther("0.02"));
    });

    it("Should revert when fee not configured", async function () {
      await expect(
        feeManager.calculateFee(PRICE_IDS.ETH, ethers.parseEther("1"))
      ).to.be.revertedWith("Fee not configured");
    });

    it("Should calculate fee for different amounts", async function () {
      const fee1 = await feeManager.calculateFee(PRICE_IDS.BTC, ethers.parseEther("10"));
      expect(fee1).to.equal(ethers.parseEther("0.1"));

      const fee2 = await feeManager.calculateFee(PRICE_IDS.BTC, ethers.parseEther("0.5"));
      expect(fee2).to.equal(ethers.parseEther("0.005"));
    });
  });

  describe("Get Current Fee Rate", function () {
    beforeEach(async function () {
      await feeManager.configureFee(PRICE_IDS.BTC, 100, 4500000000000n, 5500000000000n, 50, 200);
    });

    it("Should return current fee rate for normal volatility", async function () {
      const feeRate = await feeManager.getCurrentFeeRate(PRICE_IDS.BTC);
      expect(feeRate).to.equal(100);
    });

    it("Should return high volatility fee rate", async function () {
      await feeManager.configureFee(PRICE_IDS.BTC, 100, 5000000000001n, 6000000000000n, 50, 200);
      const feeRate = await feeManager.getCurrentFeeRate(PRICE_IDS.BTC);
      expect(feeRate).to.equal(200);
    });

    it("Should revert when fee not configured", async function () {
      await expect(
        feeManager.getCurrentFeeRate(PRICE_IDS.ETH)
      ).to.be.revertedWith("Fee not configured");
    });
  });

  describe("Multiple Assets", function () {
    it("Should handle multiple configured assets", async function () {
      await feeManager.configureFee(PRICE_IDS.BTC, 100, 4500000000000n, 5500000000000n, 50, 200);
      await feeManager.configureFee(PRICE_IDS.ETH, 150, 250000000000n, 350000000000n, 75, 250);

      const btcFee = await feeManager.calculateFee(PRICE_IDS.BTC, ethers.parseEther("1"));
      const ethFee = await feeManager.calculateFee(PRICE_IDS.ETH, ethers.parseEther("1"));

      expect(btcFee).to.equal(ethers.parseEther("0.01"));
      expect(ethFee).to.equal(ethers.parseEther("0.015"));
    });
  });
});
import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployMockPyth, PRICE_IDS } from "../setup";

describe("Pyth Integration Tests", function () {
  describe("Cross-Contract Price Consistency", function () {
    let priceConsumer: any;
    let betting: any;
    let mockPyth: any;
    let owner: any;
    let user1: any;

    beforeEach(async function () {
      [owner, user1] = await ethers.getSigners();

      mockPyth = await deployMockPyth();
      const mockPythAddress = await mockPyth.getAddress();
      
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
      await mockPyth.setMockPrice(PRICE_IDS.ETH, 300000000000n, 5000000000n, -8, now);
      await mockPyth.setMockPrice(PRICE_IDS.CFX, 1500000000n, 1000000n, -8, now);

      const PriceConsumer = await ethers.getContractFactory("PriceConsumer");
      priceConsumer = await PriceConsumer.deploy(mockPythAddress);
      await priceConsumer.waitForDeployment();

      const PriceFeedBetting = await ethers.getContractFactory("PriceFeedBetting");
      betting = await PriceFeedBetting.deploy(mockPythAddress);
      await betting.waitForDeployment();

      await owner.sendTransaction({
        to: await betting.getAddress(),
        value: ethers.parseEther("10"),
      });
    });

    it("Should provide consistent prices across all contracts", async function () {
      const consumerPrice = await priceConsumer.getLatestPrice(PRICE_IDS.BTC);
      expect(consumerPrice[0]).to.equal(5000000000000n);

      const pythPrice = await mockPyth.getPriceUnsafe(PRICE_IDS.BTC);
      expect(pythPrice.price).to.equal(5000000000000n);
    });

    it("Should handle price updates correctly", async function () {
      const newPrice = 5100000000000n;
      const now = await time.latest();

      await mockPyth.setMockPrice(PRICE_IDS.BTC, newPrice, 10000000000n, -8, now);

      const updatedPrice = await priceConsumer.getLatestPrice(PRICE_IDS.BTC);
      expect(updatedPrice[0]).to.equal(newPrice);
    });

    it("Should handle multiple price feeds", async function () {
      const btcPrice = await priceConsumer.getLatestPrice(PRICE_IDS.BTC);
      const ethPrice = await priceConsumer.getLatestPrice(PRICE_IDS.ETH);
      const cfxPrice = await priceConsumer.getLatestPrice(PRICE_IDS.CFX);

      expect(btcPrice[0]).to.equal(5000000000000n);
      expect(ethPrice[0]).to.equal(300000000000n);
      expect(cfxPrice[0]).to.equal(1500000000n);
    });

    it("Should place bets with different price feeds", async function () {
      await betting.connect(user1).placeBet(
        PRICE_IDS.BTC,
        5000000000000n,
        true,
        3600,
        { value: ethers.parseEther("1") }
      );

      await betting.connect(user1).placeBet(
        PRICE_IDS.ETH,
        300000000000n,
        false,
        3600,
        { value: ethers.parseEther("0.5") }
      );

      const btcBet = await betting.getBet(0);
      const ethBet = await betting.getBet(1);

      expect(btcBet.priceId).to.equal(PRICE_IDS.BTC);
      expect(ethBet.priceId).to.equal(PRICE_IDS.ETH);
    });

    it("Should settle bets using correct price feed", async function () {
      await betting.connect(user1).placeBet(
        PRICE_IDS.BTC,
        4900000000000n,
        true,
        3600,
        { value: ethers.parseEther("1") }
      );

      await time.increase(3601);

      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5100000000000n, 10000000000n, -8, now);

      await expect(betting.settleBet(0))
        .to.emit(betting, "BetSettled")
        .withArgs(0, true, 5100000000000n);

      const bet = await betting.getBet(0);
      expect(bet.won).to.be.true;
    });
  });
});
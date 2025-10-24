import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployMockPyth, PRICE_IDS } from "./setup";

describe("PriceFeedBetting", function () {
  let betting: any;
  let mockPyth: any;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    mockPyth = await deployMockPyth();
    const mockPythAddress = await mockPyth.getAddress();
    
    const now = await time.latest();
    await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
    
    const PriceFeedBetting = await ethers.getContractFactory("PriceFeedBetting");
    betting = await PriceFeedBetting.deploy(mockPythAddress);
    await betting.waitForDeployment();
    
    await owner.sendTransaction({
      to: await betting.getAddress(),
      value: ethers.parseEther("100")
    });
  });

  describe("Constructor", function () {
    it("Should set Pyth address and owner", async function () {
      expect(await betting.pyth()).to.equal(await mockPyth.getAddress());
      expect(await betting.owner()).to.equal(owner.address);
    });

    it("Should revert with invalid Pyth address", async function () {
      const PriceFeedBetting = await ethers.getContractFactory("PriceFeedBetting");
      await expect(
        PriceFeedBetting.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid Pyth address");
    });
  });

  describe("Place Bet - Branch Coverage", function () {
    it("Should place a bet predicting ABOVE", async function () {
      const targetPrice = 5100000000000n;
      const duration = 3600; // 1 hour
      
      await expect(
        betting.connect(user1).placeBet(PRICE_IDS.BTC, targetPrice, true, duration, {
          value: ethers.parseEther("1")
        })
      ).to.emit(betting, "BetPlaced").withArgs(
        0,
        user1.address,
        PRICE_IDS.BTC,
        targetPrice,
        ethers.parseEther("1")
      );
      
      const bet = await betting.getBet(0);
      expect(bet.predictAbove).to.be.true;
      expect(bet.priceId).to.equal(PRICE_IDS.BTC);
    });

    it("Should place a bet predicting BELOW", async function () {
      const targetPrice = 4900000000000n;
      const duration = 3600;
      
      await expect(
        betting.connect(user1).placeBet(PRICE_IDS.BTC, targetPrice, false, duration, {
          value: ethers.parseEther("1")
        })
      ).to.emit(betting, "BetPlaced");
      
      const bet = await betting.getBet(0);
      expect(bet.predictAbove).to.be.false;
    });

    it("Should place bets on different price feeds", async function () {
      await betting.connect(user1).placeBet(PRICE_IDS.BTC, 5000000000000n, true, 3600, {
        value: ethers.parseEther("1")
      });
      
      await betting.connect(user2).placeBet(PRICE_IDS.ETH, 300000000000n, false, 3600, {
        value: ethers.parseEther("1")
      });
      
      const bet1 = await betting.getBet(0);
      const bet2 = await betting.getBet(1);
      
      expect(bet1.priceId).to.equal(PRICE_IDS.BTC);
      expect(bet2.priceId).to.equal(PRICE_IDS.ETH);
    });

    it("Should revert on bet amount BELOW minimum", async function () {
      await expect(
        betting.connect(user1).placeBet(PRICE_IDS.BTC, 5000000000000n, true, 3600, {
          value: ethers.parseEther("0.005")
        })
      ).to.be.revertedWithCustomError(betting, "InvalidBetAmount");
    });

    it("Should revert on bet amount ABOVE maximum", async function () {
      await expect(
        betting.connect(user1).placeBet(PRICE_IDS.BTC, 5000000000000n, true, 3600, {
          value: ethers.parseEther("101")
        })
      ).to.be.revertedWithCustomError(betting, "InvalidBetAmount");
    });

    it("Should accept bet amount AT minimum", async function () {
      await expect(
        betting.connect(user1).placeBet(PRICE_IDS.BTC, 5000000000000n, true, 3600, {
          value: ethers.parseEther("0.01")
        })
      ).to.not.be.reverted;
    });

    it("Should accept bet amount AT maximum", async function () {
      await expect(
        betting.connect(user1).placeBet(PRICE_IDS.BTC, 5000000000000n, true, 3600, {
          value: ethers.parseEther("100")
        })
      ).to.not.be.reverted;
    });

    it("Should revert on duration BELOW minimum", async function () {
      await expect(
        betting.connect(user1).placeBet(PRICE_IDS.BTC, 5000000000000n, true, 1800, {
          value: ethers.parseEther("1")
        })
      ).to.be.revertedWithCustomError(betting, "InvalidDuration");
    });

    it("Should revert on duration ABOVE maximum", async function () {
      await expect(
        betting.connect(user1).placeBet(PRICE_IDS.BTC, 5000000000000n, true, 31 * 24 * 3600, {
          value: ethers.parseEther("1")
        })
      ).to.be.revertedWithCustomError(betting, "InvalidDuration");
    });

    it("Should accept duration AT minimum", async function () {
      await expect(
        betting.connect(user1).placeBet(PRICE_IDS.BTC, 5000000000000n, true, 3600, {
          value: ethers.parseEther("1")
        })
      ).to.not.be.reverted;
    });

    it("Should accept duration AT maximum", async function () {
      await expect(
        betting.connect(user1).placeBet(PRICE_IDS.BTC, 5000000000000n, true, 30 * 24 * 3600, {
          value: ethers.parseEther("1")
        })
      ).to.not.be.reverted;
    });

    it("Should revert on zero target price", async function () {
      await expect(
        betting.connect(user1).placeBet(PRICE_IDS.BTC, 0, true, 3600, {
          value: ethers.parseEther("1")
        })
      ).to.be.revertedWithCustomError(betting, "InvalidTargetPrice");
    });

    it("Should revert on negative target price", async function () {
      await expect(
        betting.connect(user1).placeBet(PRICE_IDS.BTC, -1000, true, 3600, {
          value: ethers.parseEther("1")
        })
      ).to.be.revertedWithCustomError(betting, "InvalidTargetPrice");
    });

    it("Should track user bets", async function () {
      await betting.connect(user1).placeBet(PRICE_IDS.BTC, 5000000000000n, true, 3600, {
        value: ethers.parseEther("1")
      });
      
      await betting.connect(user1).placeBet(PRICE_IDS.ETH, 300000000000n, false, 3600, {
        value: ethers.parseEther("1")
      });
      
      const userBets = await betting.getUserBets(user1.address);
      expect(userBets.length).to.equal(2);
      expect(userBets[0]).to.equal(0);
      expect(userBets[1]).to.equal(1);
    });
  });

  describe("Settle Bet - Branch Coverage", function () {
    it("Should settle ABOVE bet as WON (price >= target)", async function () {
      const targetPrice = 4900000000000n;
      
      await betting.connect(user1).placeBet(PRICE_IDS.BTC, targetPrice, true, 3600, {
        value: ethers.parseEther("1")
      });
      
      await time.increase(3601);
      
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
      
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      await expect(betting.settleBet(0))
        .to.emit(betting, "BetSettled")
        .withArgs(0, true, 5000000000000n);
      
      const bet = await betting.getBet(0);
      expect(bet.won).to.be.true;
      expect(bet.settled).to.be.true;
      
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      const expectedPayout = ethers.parseEther("1.96");
      expect(balanceAfter - balanceBefore).to.equal(expectedPayout);
    });

    it("Should settle ABOVE bet as LOST (price < target)", async function () {
      const targetPrice = 5100000000000n;
      
      await betting.connect(user1).placeBet(PRICE_IDS.BTC, targetPrice, true, 3600, {
        value: ethers.parseEther("1")
      });
      
      await time.increase(3601);
      
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
      
      await expect(betting.settleBet(0))
        .to.emit(betting, "BetSettled")
        .withArgs(0, false, 5000000000000n);
      
      const bet = await betting.getBet(0);
      expect(bet.won).to.be.false;
    });

    it("Should settle BELOW bet as WON (price <= target)", async function () {
      const targetPrice = 5100000000000n;
      
      await betting.connect(user1).placeBet(PRICE_IDS.BTC, targetPrice, false, 3600, {
        value: ethers.parseEther("1")
      });
      
      await time.increase(3601);
      
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
      
      await expect(betting.settleBet(0))
        .to.emit(betting, "BetSettled")
        .withArgs(0, true, 5000000000000n);
      
      const bet = await betting.getBet(0);
      expect(bet.won).to.be.true;
    });

    it("Should settle BELOW bet as LOST (price > target)", async function () {
      const targetPrice = 4900000000000n;
      
      await betting.connect(user1).placeBet(PRICE_IDS.BTC, targetPrice, false, 3600, {
        value: ethers.parseEther("1")
      });
      
      await time.increase(3601);
      
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
      
      await expect(betting.settleBet(0))
        .to.emit(betting, "BetSettled")
        .withArgs(0, false, 5000000000000n);
      
      const bet = await betting.getBet(0);
      expect(bet.won).to.be.false;
    });

    it("Should revert settlement BEFORE deadline", async function () {
      await betting.connect(user1).placeBet(PRICE_IDS.BTC, 5000000000000n, true, 3600, {
        value: ethers.parseEther("1")
      });
      
      await expect(betting.settleBet(0))
        .to.be.revertedWithCustomError(betting, "BetNotExpired");
    });

    it("Should revert on ALREADY SETTLED bet", async function () {
      await betting.connect(user1).placeBet(PRICE_IDS.BTC, 5000000000000n, true, 3600, {
        value: ethers.parseEther("1")
      });
      
      await time.increase(3601);
      await betting.settleBet(0);
      
      await expect(betting.settleBet(0))
        .to.be.revertedWithCustomError(betting, "BetAlreadySettled");
    });

    it("Should collect platform fees", async function () {
      await betting.connect(user1).placeBet(PRICE_IDS.BTC, 4900000000000n, true, 3600, {
        value: ethers.parseEther("1")
      });
      
      await time.increase(3601);
      
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
      
      await betting.settleBet(0);
      
      expect(await betting.collectedFees()).to.equal(ethers.parseEther("0.04"));
    });
  });

  describe("Fee Management", function () {
    it("Should allow owner to withdraw fees", async function () {
      await betting.connect(user1).placeBet(PRICE_IDS.BTC, 4900000000000n, true, 3600, {
        value: ethers.parseEther("1")
      });
      
      await time.increase(3601);
      const now = await time.latest();
      await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
      await betting.settleBet(0);
      
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      
      await expect(betting.connect(owner).withdrawFees())
        .to.emit(betting, "FeesWithdrawn")
        .withArgs(ethers.parseEther("0.04"));
      
      expect(await betting.collectedFees()).to.equal(0);
    });

    it("Should revert fee withdrawal by non-owner", async function () {
      await expect(betting.connect(user1).withdrawFees())
        .to.be.revertedWithCustomError(betting, "Unauthorized");
    });
  });

  describe("Multiple Bets", function () {
    it("Should handle multiple simultaneous bets", async function () {
      await betting.connect(user1).placeBet(PRICE_IDS.BTC, 5000000000000n, true, 3600, {
        value: ethers.parseEther("1")
      });
      
      await betting.connect(user2).placeBet(PRICE_IDS.ETH, 300000000000n, false, 3600, {
        value: ethers.parseEther("1")
      });
      
      expect(await betting.nextBetId()).to.equal(2);
    });
  });

  describe("Receive Function", function () {
    it("Should accept ETH", async function () {
      await expect(
        owner.sendTransaction({
          to: await betting.getAddress(),
          value: ethers.parseEther("1")
        })
      ).to.not.be.reverted;
    });
  });
});
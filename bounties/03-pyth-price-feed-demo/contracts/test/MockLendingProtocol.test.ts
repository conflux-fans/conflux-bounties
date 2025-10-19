import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployMockPyth, PRICE_IDS } from "./setup";

describe("MockLendingProtocol", function () {
  let lending: any;
  let mockPyth: any;
  let owner: any;
  let user1: any;
  let user2: any;
  let liquidator: any;

  beforeEach(async function () {
    [owner, user1, user2, liquidator] = await ethers.getSigners();
    
    mockPyth = await deployMockPyth();
    const mockPythAddress = await mockPyth.getAddress();
    
    const now = await time.latest();
    await mockPyth.setMockPrice(PRICE_IDS.ETH, 300000000000n, 5000000000n, -8, now);
    await mockPyth.setMockPrice(PRICE_IDS.BTC, 5000000000000n, 10000000000n, -8, now);
    
    const MockLendingProtocol = await ethers.getContractFactory("MockLendingProtocol");
    lending = await MockLendingProtocol.deploy(mockPythAddress);
    await lending.waitForDeployment();
    
    await owner.sendTransaction({
      to: await lending.getAddress(),
      value: ethers.parseEther("100")
    });
  });

  describe("Constructor", function () {
    it("Should set the Pyth contract address", async function () {
      expect(await lending.pyth()).to.equal(await mockPyth.getAddress());
    });

    it("Should revert with zero address", async function () {
      const MockLendingProtocol = await ethers.getContractFactory("MockLendingProtocol");
      await expect(
        MockLendingProtocol.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid Pyth address");
    });
  });

  describe("Open Position", function () {
    it("Should open a position successfully", async function () {
      const collateralAmount = ethers.parseEther("2");
      const borrowAmount = ethers.parseEther("1");

      await expect(
        lending.connect(user1).openPosition(
          PRICE_IDS.ETH,
          PRICE_IDS.ETH,
          borrowAmount,
          { value: collateralAmount }
        )
      ).to.emit(lending, "PositionOpened")
        .withArgs(1, user1.address, collateralAmount, borrowAmount);

      const position = await lending.positions(1);
      expect(position.borrower).to.equal(user1.address);
      expect(position.collateralAmount).to.equal(collateralAmount);
      expect(position.borrowAmount).to.equal(borrowAmount);
      expect(position.active).to.be.true;
    });

    it("Should track user positions", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      await lending.connect(user1).openPosition(
        PRICE_IDS.BTC,
        PRICE_IDS.BTC,
        ethers.parseEther("0.5"),
        { value: ethers.parseEther("1") }
      );

      const userPositions = await lending.getUserPositions(user1.address);
      expect(userPositions.length).to.equal(2);
      expect(userPositions[0]).to.equal(1);
      expect(userPositions[1]).to.equal(2);
    });

    it("Should revert with no collateral", async function () {
      await expect(
        lending.connect(user1).openPosition(
          PRICE_IDS.ETH,
          PRICE_IDS.ETH,
          ethers.parseEther("1"),
          { value: 0 }
        )
      ).to.be.revertedWith("No collateral provided");
    });

    it("Should revert with zero borrow amount", async function () {
      await expect(
        lending.connect(user1).openPosition(
          PRICE_IDS.ETH,
          PRICE_IDS.ETH,
          0,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWith("Invalid borrow amount");
    });

    it("Should revert with insufficient liquidity", async function () {
      await expect(
        lending.connect(user1).openPosition(
          PRICE_IDS.ETH,
          PRICE_IDS.ETH,
          ethers.parseEther("200"),
          { value: ethers.parseEther("10") }
        )
      ).to.be.revertedWith("Insufficient liquidity");
    });
  });

  describe("Health Ratio", function () {
    it("Should calculate health ratio correctly", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      const healthRatio = await lending.getHealthRatio(1);
      expect(healthRatio).to.equal(20000);
    });

    it("Should return high ratio for very small borrow", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("0.01"),
        { value: ethers.parseEther("10") }
      );

      const healthRatio = await lending.getHealthRatio(1);
      expect(healthRatio).to.be.gt(100000);
    });

    it("Should revert for inactive position", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      await lending.connect(user1).repayPosition(1, {
        value: ethers.parseEther("1")
      });

      await expect(
        lending.getHealthRatio(1)
      ).to.be.revertedWith("Position not active");
    });
  });

  describe("Get Position Details", function () {
    it("Should return correct position details", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      const details = await lending.getPositionDetails(1);
      
      expect(details.position.borrower).to.equal(user1.address);
      expect(details.position.collateralAmount).to.equal(ethers.parseEther("2"));
      expect(details.position.borrowAmount).to.equal(ethers.parseEther("1"));
      expect(details.healthRatio).to.equal(20000);
    });

    it("Should revert for inactive position", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      await lending.connect(user1).repayPosition(1, {
        value: ethers.parseEther("1")
      });

      await expect(
        lending.getPositionDetails(1)
      ).to.be.revertedWith("Position not active");
    });
  });

  describe("Liquidation", function () {
    it("Should liquidate unhealthy position", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1.45"),
        { value: ethers.parseEther("2") }
      );

      const healthRatio = await lending.getHealthRatio(1);
      expect(healthRatio).to.be.lt(15000);

      await expect(
        lending.connect(liquidator).liquidate(1)
      ).to.emit(lending, "PositionLiquidated")
        .withArgs(1, liquidator.address, user1.address);

      const position = await lending.positions(1);
      expect(position.active).to.be.false;
    });

    it("Should revert liquidating healthy position", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      await expect(
        lending.connect(liquidator).liquidate(1)
      ).to.be.revertedWith("Position is healthy");
    });

    it("Should pay liquidation bonus", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1.45"),
        { value: ethers.parseEther("2") }
      );

      const healthRatio = await lending.getHealthRatio(1);
      expect(healthRatio).to.be.lt(15000);

      const balanceBefore = await ethers.provider.getBalance(liquidator.address);
      
      const tx = await lending.connect(liquidator).liquidate(1);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(liquidator.address);

      const expectedReward = ethers.parseEther("2.1");
      expect(balanceAfter - balanceBefore + gasUsed).to.be.closeTo(expectedReward, ethers.parseEther("0.01"));
    });

    it("Should revert liquidating inactive position", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      await lending.connect(user1).repayPosition(1, {
        value: ethers.parseEther("1")
      });

      await expect(
        lending.connect(liquidator).liquidate(1)
      ).to.be.revertedWith("Position not active");
    });
  });

  describe("Repay Position", function () {
    it("Should repay position successfully", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      await expect(
        lending.connect(user1).repayPosition(1, {
          value: ethers.parseEther("1")
        })
      ).to.emit(lending, "PositionRepaid")
        .withArgs(1, user1.address);

      const position = await lending.positions(1);
      expect(position.active).to.be.false;
    });

    it("Should return collateral on repay", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      const tx = await lending.connect(user1).repayPosition(1, {
        value: ethers.parseEther("1")
      });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(user1.address);

      const netGain = balanceAfter - balanceBefore + gasUsed;
      expect(netGain).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.01"));
    });

    it("Should refund excess repayment", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      await expect(
        lending.connect(user1).repayPosition(1, {
          value: ethers.parseEther("1.5")
        })
      ).to.not.be.reverted;

      const position = await lending.positions(1);
      expect(position.active).to.be.false;
    });

    it("Should revert if not position owner", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      await expect(
        lending.connect(user2).repayPosition(1, {
          value: ethers.parseEther("1")
        })
      ).to.be.revertedWith("Not position owner");
    });

    it("Should revert with insufficient repayment", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      await expect(
        lending.connect(user1).repayPosition(1, {
          value: ethers.parseEther("0.5")
        })
      ).to.be.revertedWith("Insufficient repayment");
    });

    it("Should revert repaying inactive position", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      await lending.connect(user1).repayPosition(1, {
        value: ethers.parseEther("1")
      });

      await expect(
        lending.connect(user1).repayPosition(1, {
          value: ethers.parseEther("1")
        })
      ).to.be.revertedWith("Position not active");
    });
  });

  describe("Get All Active Positions", function () {
    it("Should return empty array when no positions", async function () {
      const activePositions = await lending.getAllActivePositions();
      expect(activePositions.length).to.equal(0);
    });

    it("Should return all active positions", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      await lending.connect(user2).openPosition(
        PRICE_IDS.BTC,
        PRICE_IDS.BTC,
        ethers.parseEther("0.5"),
        { value: ethers.parseEther("1") }
      );

      const activePositions = await lending.getAllActivePositions();
      expect(activePositions.length).to.equal(2);
      expect(activePositions[0]).to.equal(1);
      expect(activePositions[1]).to.equal(2);
    });

    it("Should exclude closed positions", async function () {
      await lending.connect(user1).openPosition(
        PRICE_IDS.ETH,
        PRICE_IDS.ETH,
        ethers.parseEther("1"),
        { value: ethers.parseEther("2") }
      );

      await lending.connect(user2).openPosition(
        PRICE_IDS.BTC,
        PRICE_IDS.BTC,
        ethers.parseEther("0.5"),
        { value: ethers.parseEther("1") }
      );

      await lending.connect(user1).repayPosition(1, {
        value: ethers.parseEther("1")
      });

      const activePositions = await lending.getAllActivePositions();
      expect(activePositions.length).to.equal(1);
      expect(activePositions[0]).to.equal(2);
    });
  });

  describe("Receive Function", function () {
    it("Should accept ETH", async function () {
      await expect(
        owner.sendTransaction({
          to: await lending.getAddress(),
          value: ethers.parseEther("1")
        })
      ).to.not.be.reverted;
    });
  });
});
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("JobManager", function () {
  let jobManager, priceOracle;
  let owner, executor, user1, user2;
  let tokenA, tokenB;

  beforeEach(async function () {
    [owner, executor, user1, user2] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    tokenA = await MockERC20.deploy("Token A", "TKNA", ethers.parseEther("1000000"));
    tokenB = await MockERC20.deploy("Token B", "TKNB", ethers.parseEther("1000000"));

    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    priceOracle = await PriceOracle.deploy();

    // Deploy JobManager
    const JobManager = await ethers.getContractFactory("JobManager");
    jobManager = await JobManager.deploy();

    // Add executor
    await jobManager.addExecutor(executor.address);

    // Distribute tokens
    await tokenA.transfer(user1.address, ethers.parseEther("10000"));
    await tokenB.transfer(user1.address, ethers.parseEther("10000"));
  });

  describe("Job Creation", function () {
    it("Should create a limit buy job", async function () {
      const amount = ethers.parseEther("100");
      const targetPrice = ethers.parseEther("1.5"); // $1.50
      const slippage = 100; // 1%

      const tx = await jobManager.connect(user1).createJob(
        0, // LIMIT_BUY
        tokenA.target,
        tokenB.target,
        amount,
        targetPrice,
        slippage,
        0, // No interval for limit orders
        1  // Single execution
      );

      await expect(tx)
        .to.emit(jobManager, "JobCreated")
        .withArgs(1, user1.address, 0, tokenA.target, tokenB.target, amount, targetPrice);

      const job = await jobManager.getJob(1);
      expect(job.owner).to.equal(user1.address);
      expect(job.jobType).to.equal(0); // LIMIT_BUY
      expect(job.status).to.equal(0); // ACTIVE
    });

    it("Should create a DCA job with interval", async function () {
      const amount = ethers.parseEther("50");
      const interval = 86400; // 1 day
      const maxExecutions = 10;

      const tx = await jobManager.connect(user1).createJob(
        2, // DCA_BUY
        tokenA.target,
        tokenB.target,
        amount,
        0, // No target price for DCA
        200, // 2% slippage
        interval,
        maxExecutions
      );

      await expect(tx).to.emit(jobManager, "JobCreated");

      const job = await jobManager.getJob(1);
      expect(job.interval).to.equal(interval);
      expect(job.maxExecutions).to.equal(maxExecutions);
    });

    it("Should reject invalid parameters", async function () {
      await expect(
        jobManager.connect(user1).createJob(
          0,
          ethers.ZeroAddress,
          tokenB.target,
          ethers.parseEther("100"),
          ethers.parseEther("1.5"),
          100,
          0,
          1
        )
      ).to.be.revertedWith("Invalid token addresses");

      await expect(
        jobManager.connect(user1).createJob(
          0,
          tokenA.target,
          tokenB.target,
          0, // Zero amount
          ethers.parseEther("1.5"),
          100,
          0,
          1
        )
      ).to.be.revertedWith("Amount must be greater than 0");

      await expect(
        jobManager.connect(user1).createJob(
          0,
          tokenA.target,
          tokenB.target,
          ethers.parseEther("100"),
          ethers.parseEther("1.5"),
          5001, // > 50% slippage
          0,
          1
        )
      ).to.be.revertedWith("Slippage too high");
    });
  });

  describe("Job Execution", function () {
    beforeEach(async function () {
      // Create a job
      await jobManager.connect(user1).createJob(
        0, // LIMIT_BUY
        tokenA.target,
        tokenB.target,
        ethers.parseEther("100"),
        ethers.parseEther("1.5"),
        100,
        0,
        1
      );

      // Approve tokens
      await tokenA.connect(user1).approve(jobManager.target, ethers.parseEther("100"));
    });

    it("Should execute a limit order when price target is met", async function () {
      const currentPrice = ethers.parseEther("1.49"); // Below target
      const amountOut = ethers.parseEther("66");

      await expect(
        jobManager.connect(executor).executeJob(1, amountOut, currentPrice)
      )
        .to.emit(jobManager, "JobExecuted")
        .withArgs(1, user1.address, ethers.parseEther("100"), amountOut, anyValue);

      const job = await jobManager.getJob(1);
      expect(job.executions).to.equal(1);
      expect(job.status).to.equal(3); // COMPLETED
    });

    it("Should reject execution if price target not met", async function () {
      const currentPrice = ethers.parseEther("1.6"); // Above target + slippage
      const amountOut = ethers.parseEther("62");

      await expect(
        jobManager.connect(executor).executeJob(1, amountOut, currentPrice)
      ).to.be.revertedWith("Price target not met");
    });

    it("Should reject execution from non-executor", async function () {
      const currentPrice = ethers.parseEther("1.49");
      const amountOut = ethers.parseEther("66");

      await expect(
        jobManager.connect(user2).executeJob(1, amountOut, currentPrice)
      ).to.be.revertedWith("Not authorized executor");
    });
  });

  describe("Job Management", function () {
    beforeEach(async function () {
      await jobManager.connect(user1).createJob(
        2, // DCA_BUY
        tokenA.target,
        tokenB.target,
        ethers.parseEther("50"),
        0,
        200,
        86400,
        10
      );
    });

    it("Should allow owner to pause job", async function () {
      await expect(jobManager.connect(user1).pauseJob(1))
        .to.emit(jobManager, "JobPaused")
        .withArgs(1, user1.address);

      const job = await jobManager.getJob(1);
      expect(job.status).to.equal(1); // PAUSED
    });

    it("Should allow owner to resume paused job", async function () {
      await jobManager.connect(user1).pauseJob(1);
      
      await expect(jobManager.connect(user1).resumeJob(1))
        .to.emit(jobManager, "JobResumed")
        .withArgs(1, user1.address);

      const job = await jobManager.getJob(1);
      expect(job.status).to.equal(0); // ACTIVE
    });

    it("Should allow owner to cancel job", async function () {
      await expect(jobManager.connect(user1).cancelJob(1))
        .to.emit(jobManager, "JobCancelled")
        .withArgs(1, user1.address);

      const job = await jobManager.getJob(1);
      expect(job.status).to.equal(2); // CANCELLED
    });

    it("Should reject non-owner from managing job", async function () {
      await expect(
        jobManager.connect(user2).pauseJob(1)
      ).to.be.revertedWith("Not job owner");
    });
  });

  describe("Global Pause", function () {
    it("Should pause all operations when paused", async function () {
      await jobManager.pause();

      await expect(
        jobManager.connect(user1).createJob(
          0,
          tokenA.target,
          tokenB.target,
          ethers.parseEther("100"),
          ethers.parseEther("1.5"),
          100,
          0,
          1
        )
      ).to.be.reverted; // Pausable will revert
    });

    it("Should resume operations when unpaused", async function () {
      await jobManager.pause();
      await jobManager.unpause();

      await expect(
        jobManager.connect(user1).createJob(
          0,
          tokenA.target,
          tokenB.target,
          ethers.parseEther("100"),
          ethers.parseEther("1.5"),
          100,
          0,
          1
        )
      ).to.emit(jobManager, "JobCreated");
    });
  });

  describe("User Jobs", function () {
    it("Should track user jobs", async function () {
      await jobManager.connect(user1).createJob(
        0, tokenA.target, tokenB.target,
        ethers.parseEther("100"), ethers.parseEther("1.5"),
        100, 0, 1
      );

      await jobManager.connect(user1).createJob(
        2, tokenA.target, tokenB.target,
        ethers.parseEther("50"), 0,
        200, 86400, 10
      );

      const userJobs = await jobManager.getUserJobs(user1.address);
      expect(userJobs.length).to.equal(2);
      expect(userJobs[0]).to.equal(1);
      expect(userJobs[1]).to.equal(2);
    });
  });
});

// Helper for anyValue
function anyValue() {
  return true;
}

import { expect } from 'chai';
import { ethers } from 'hardhat';
import { AutomationManager, SwappiPriceAdapter, PermitHandler } from '../typechain-types';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { ContractTransactionResponse } from 'ethers';

// ─── Mock ERC-20 ────────────────────────────────────────────────────────────────────

// We deploy a minimal ERC-20 mock using Hardhat's inline Solidity capability.
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
  'function transferFrom(address, address, uint256) returns (bool)',
  'function approve(address, uint256) returns (bool)',
  'function allowance(address, address) view returns (uint256)',
  'function mint(address, uint256)',
];

describe('AutomationManager', () => {
  let owner: HardhatEthersSigner;
  let keeper: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  let automationManager: AutomationManager;
  let priceAdapter: SwappiPriceAdapter;
  let tokenIn: Awaited<ReturnType<typeof ethers.deployContract>>;
  let tokenOut: Awaited<ReturnType<typeof ethers.deployContract>>;

  before(async () => {
    [owner, keeper, user, stranger] = await ethers.getSigners();
  });

  beforeEach(async () => {
    // Deploy a stub MockPriceAdapter that always returns a fixed price
    const MockPriceAdapterFactory = await ethers.getContractFactory('MockPriceAdapter');
    const mockAdapter = await MockPriceAdapterFactory.deploy();
    await mockAdapter.waitForDeployment();

    // Deploy AutomationManager
    const AMFactory = await ethers.getContractFactory('AutomationManager');
    automationManager = (await AMFactory.deploy(
      await mockAdapter.getAddress(),
      owner.address,
    )) as AutomationManager;
    await automationManager.waitForDeployment();

    // Register additional keeper
    await automationManager.connect(owner).setKeeper(keeper.address, true);

    // Deploy mock ERC-20 tokens
    const MockERC20Factory = await ethers.getContractFactory('MockERC20');
    tokenIn = await MockERC20Factory.deploy('TokenIn', 'TIN');
    await tokenIn.waitForDeployment();
    tokenOut = await MockERC20Factory.deploy('TokenOut', 'TOUT');
    await tokenOut.waitForDeployment();

    // Mint and approve
    await tokenIn.mint(user.address, ethers.parseEther('10000'));
    await tokenIn.connect(user).approve(await automationManager.getAddress(), ethers.MaxUint256);
  });

  // ─── createLimitOrder ─────────────────────────────────────────────────────

  describe('createLimitOrder', () => {
    it('emits JobCreated and returns a bytes32 jobId', async () => {
      const tx: ContractTransactionResponse = await automationManager.connect(user).createLimitOrder(
        {
          tokenIn: await tokenIn.getAddress(),
          tokenOut: await tokenOut.getAddress(),
          amountIn: ethers.parseEther('100'),
          minAmountOut: ethers.parseEther('95'),
          targetPrice: ethers.parseEther('1'),
          triggerAbove: true,
        },
        200, // 2% slippage
        0,
      );
      await expect(tx).to.emit(automationManager, 'JobCreated');
    });

    it('reverts when slippage exceeds maxSlippageBps', async () => {
      await expect(
        automationManager.connect(user).createLimitOrder(
          {
            tokenIn: await tokenIn.getAddress(),
            tokenOut: await tokenOut.getAddress(),
            amountIn: ethers.parseEther('100'),
            minAmountOut: ethers.parseEther('50'),
            targetPrice: ethers.parseEther('1'),
            triggerAbove: true,
          },
          1000, // 10% — over default 5% cap
          0,
        ),
      ).to.be.revertedWithCustomError(automationManager, 'SlippageTooHigh');
    });

    it('reverts when amountIn is zero', async () => {
      await expect(
        automationManager.connect(user).createLimitOrder(
          {
            tokenIn: await tokenIn.getAddress(),
            tokenOut: await tokenOut.getAddress(),
            amountIn: 0n,
            minAmountOut: ethers.parseEther('95'),
            targetPrice: ethers.parseEther('1'),
            triggerAbove: true,
          },
          200,
          0,
        ),
      ).to.be.revertedWithCustomError(automationManager, 'InvalidParams');
    });
  });

  // ─── createDCAJob ─────────────────────────────────────────────────────────

  describe('createDCAJob', () => {
    it('emits JobCreated with type DCA', async () => {
      const tx = await automationManager.connect(user).createDCAJob(
        {
          tokenIn: await tokenIn.getAddress(),
          tokenOut: await tokenOut.getAddress(),
          amountPerSwap: ethers.parseEther('10'),
          intervalSeconds: 3600,
          totalSwaps: 5,
          swapsCompleted: 0,
          nextExecution: 0,
        },
        200,
        0,
      );
      await expect(tx).to.emit(automationManager, 'JobCreated');
    });

    it('reverts when interval is too short', async () => {
      await expect(
        automationManager.connect(user).createDCAJob(
          {
            tokenIn: await tokenIn.getAddress(),
            tokenOut: await tokenOut.getAddress(),
            amountPerSwap: ethers.parseEther('10'),
            intervalSeconds: 10,  // < 60 seconds
            totalSwaps: 5,
            swapsCompleted: 0,
            nextExecution: 0,
          },
          200,
          0,
        ),
      ).to.be.revertedWithCustomError(automationManager, 'InvalidParams');
    });
  });

  // ─── cancelJob ───────────────────────────────────────────────────────────

  describe('cancelJob', () => {
    let jobId: string;

    beforeEach(async () => {
      const tx = await automationManager.connect(user).createLimitOrder(
        {
          tokenIn: await tokenIn.getAddress(),
          tokenOut: await tokenOut.getAddress(),
          amountIn: ethers.parseEther('100'),
          minAmountOut: ethers.parseEther('95'),
          targetPrice: ethers.parseEther('1'),
          triggerAbove: true,
        },
        200,
        0,
      );
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map(log => { try { return automationManager.interface.parseLog(log); } catch { return null; } })
        .find(e => e?.name === 'JobCreated');
      jobId = event?.args.jobId;
    });

    it('allows owner to cancel their job', async () => {
      await expect(automationManager.connect(user).cancelJob(jobId))
        .to.emit(automationManager, 'JobCancelled')
        .withArgs(jobId, user.address);
    });

    it('allows contract owner to cancel any job', async () => {
      await expect(automationManager.connect(owner).cancelJob(jobId))
        .to.emit(automationManager, 'JobCancelled');
    });

    it('reverts when stranger tries to cancel', async () => {
      await expect(automationManager.connect(stranger).cancelJob(jobId))
        .to.be.revertedWithCustomError(automationManager, 'Unauthorized');
    });
  });

  // ─── Admin ───────────────────────────────────────────────────────────────

  describe('Admin controls', () => {
    it('owner can pause and unpause', async () => {
      await automationManager.connect(owner).pause();
      await expect(
        automationManager.connect(user).createLimitOrder(
          {
            tokenIn: await tokenIn.getAddress(),
            tokenOut: await tokenOut.getAddress(),
            amountIn: ethers.parseEther('1'),
            minAmountOut: ethers.parseEther('1'),
            targetPrice: ethers.parseEther('1'),
            triggerAbove: true,
          },
          200,
          0,
        ),
      ).to.be.revertedWithCustomError(automationManager, 'EnforcedPause');

      await automationManager.connect(owner).unpause();
    });

    it('non-owner cannot pause', async () => {
      await expect(automationManager.connect(stranger).pause()).to.be.reverted;
    });

    it('owner can set keeper', async () => {
      await automationManager.connect(owner).setKeeper(stranger.address, true);
      expect(await automationManager.keepers(stranger.address)).to.equal(true);
    });
  });

  // ─── executeLimitOrder ───────────────────────────────────────────────────

  describe('executeLimitOrder', () => {
    let jobId: string;
    let mockRouter: Awaited<ReturnType<typeof ethers.deployContract>>;
    let swapCalldata: string;
    const amountIn = ethers.parseEther('100');
    const minAmountOut = ethers.parseEther('95');

    beforeEach(async () => {
      // Deploy mock router and seed it with tokenOut
      const MockRouterFactory = await ethers.getContractFactory('MockRouter');
      mockRouter = await MockRouterFactory.deploy();
      await mockRouter.waitForDeployment();
      await tokenOut.mint(await mockRouter.getAddress(), ethers.parseEther('100000'));

      // Build swap calldata (1:1 → returns exactly amountIn as tokenOut)
      swapCalldata = mockRouter.interface.encodeFunctionData('swap', [
        await tokenIn.getAddress(),
        await tokenOut.getAddress(),
        amountIn,
        user.address,
        amountIn, // amountOut = amountIn (1:1)
      ]);

      // Create the limit order
      const tx = await automationManager.connect(user).createLimitOrder(
        {
          tokenIn: await tokenIn.getAddress(),
          tokenOut: await tokenOut.getAddress(),
          amountIn,
          minAmountOut,
          targetPrice: ethers.parseEther('1'),
          triggerAbove: true,
        },
        200,
        0,
      );
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => { try { return automationManager.interface.parseLog(log); } catch { return null; } })
        .find((e) => e?.name === 'JobCreated');
      jobId = event?.args.jobId;
    });

    it('executes limit order and emits JobExecuted', async () => {
      // Price adapter returns 1e18 ≥ targetPrice 1e18 → condition met
      await expect(
        automationManager.connect(keeper).executeLimitOrder(jobId, await mockRouter.getAddress(), swapCalldata),
      ).to.emit(automationManager, 'JobExecuted').withArgs(jobId, keeper.address, amountIn);
    });

    it('delivers tokenOut to the job owner', async () => {
      const balBefore = await tokenOut.balanceOf(user.address);
      await automationManager.connect(keeper).executeLimitOrder(jobId, await mockRouter.getAddress(), swapCalldata);
      const balAfter = await tokenOut.balanceOf(user.address);
      expect(balAfter - balBefore).to.equal(amountIn);
    });

    it('decrements activeJobCount after execution', async () => {
      expect(await automationManager.activeJobCount(user.address)).to.equal(1n);
      await automationManager.connect(keeper).executeLimitOrder(jobId, await mockRouter.getAddress(), swapCalldata);
      expect(await automationManager.activeJobCount(user.address)).to.equal(0n);
    });

    it('reverts when called by non-keeper', async () => {
      await expect(
        automationManager.connect(stranger).executeLimitOrder(jobId, await mockRouter.getAddress(), swapCalldata),
      ).to.be.revertedWithCustomError(automationManager, 'Unauthorized');
    });

    it('reverts when price condition not met (price below target)', async () => {
      const MockPriceAdapterFactory = await ethers.getContractFactory('MockPriceAdapter');
      const lowPriceAdapter = await MockPriceAdapterFactory.deploy();
      await lowPriceAdapter.waitForDeployment();
      await (lowPriceAdapter as { setPrice: (p: bigint) => Promise<void> }).setPrice(ethers.parseEther('0.5'));
      await automationManager.connect(owner).setPriceAdapter(await lowPriceAdapter.getAddress());

      await expect(
        automationManager.connect(keeper).executeLimitOrder(jobId, await mockRouter.getAddress(), swapCalldata),
      ).to.be.revertedWithCustomError(automationManager, 'PriceConditionNotMet');
    });

    it('reverts when slippage exceeded (router delivers less than minAmountOut)', async () => {
      const lowOut = ethers.parseEther('80'); // below minAmountOut of 95
      const slippageCalldata = mockRouter.interface.encodeFunctionData('swap', [
        await tokenIn.getAddress(),
        await tokenOut.getAddress(),
        amountIn,
        user.address,
        lowOut,
      ]);
      await expect(
        automationManager.connect(keeper).executeLimitOrder(jobId, await mockRouter.getAddress(), slippageCalldata),
      ).to.be.revertedWithCustomError(automationManager, 'InvalidParams');
    });

    it('reverts when job is already executed', async () => {
      await automationManager.connect(keeper).executeLimitOrder(jobId, await mockRouter.getAddress(), swapCalldata);
      await expect(
        automationManager.connect(keeper).executeLimitOrder(jobId, await mockRouter.getAddress(), swapCalldata),
      ).to.be.revertedWithCustomError(automationManager, 'JobNotActive');
    });
  });

  // ─── executeDCATick ───────────────────────────────────────────────────────

  describe('executeDCATick', () => {
    let jobId: string;
    let mockRouter: Awaited<ReturnType<typeof ethers.deployContract>>;
    const amountPerSwap = ethers.parseEther('10');

    function buildSwapCalldata(
      router: Awaited<ReturnType<typeof ethers.deployContract>>,
      tokenInAddr: string,
      tokenOutAddr: string,
      amountIn: bigint,
      recipient: string,
      amountOut: bigint,
    ): string {
      return router.interface.encodeFunctionData('swap', [
        tokenInAddr,
        tokenOutAddr,
        amountIn,
        recipient,
        amountOut,
      ]);
    }

    beforeEach(async () => {
      const MockRouterFactory = await ethers.getContractFactory('MockRouter');
      mockRouter = await MockRouterFactory.deploy();
      await mockRouter.waitForDeployment();
      await tokenOut.mint(await mockRouter.getAddress(), ethers.parseEther('100000'));

      const tx = await automationManager.connect(user).createDCAJob(
        {
          tokenIn: await tokenIn.getAddress(),
          tokenOut: await tokenOut.getAddress(),
          amountPerSwap,
          intervalSeconds: 3600,
          totalSwaps: 3,
          swapsCompleted: 0,
          nextExecution: 0, // eligible immediately
        },
        200,
        0,
      );
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => { try { return automationManager.interface.parseLog(log); } catch { return null; } })
        .find((e) => e?.name === 'JobCreated');
      jobId = event?.args.jobId;
    });

    it('emits JobExecuted on first tick', async () => {
      const calldata = buildSwapCalldata(
        mockRouter,
        await tokenIn.getAddress(),
        await tokenOut.getAddress(),
        amountPerSwap,
        user.address,
        amountPerSwap,
      );
      await expect(
        automationManager.connect(keeper).executeDCATick(jobId, await mockRouter.getAddress(), calldata),
      ).to.emit(automationManager, 'JobExecuted');
    });

    it('does NOT decrement activeJobCount mid-series (ticks remaining)', async () => {
      const calldata = buildSwapCalldata(
        mockRouter,
        await tokenIn.getAddress(),
        await tokenOut.getAddress(),
        amountPerSwap,
        user.address,
        amountPerSwap,
      );
      await automationManager.connect(keeper).executeDCATick(jobId, await mockRouter.getAddress(), calldata);
      // totalSwaps = 3, swapsCompleted = 1 → still active
      expect(await automationManager.activeJobCount(user.address)).to.equal(1n);
    });

    it('decrements activeJobCount on final tick', async () => {
      // Create a single-tick DCA job
      const tx = await automationManager.connect(user).createDCAJob(
        {
          tokenIn: await tokenIn.getAddress(),
          tokenOut: await tokenOut.getAddress(),
          amountPerSwap,
          intervalSeconds: 3600,
          totalSwaps: 1,
          swapsCompleted: 0,
          nextExecution: 0,
        },
        200,
        0,
      );
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => { try { return automationManager.interface.parseLog(log); } catch { return null; } })
        .find((e) => e?.name === 'JobCreated');
      const singleTickJobId: string = event?.args.jobId;

      const calldata = buildSwapCalldata(
        mockRouter,
        await tokenIn.getAddress(),
        await tokenOut.getAddress(),
        amountPerSwap,
        user.address,
        amountPerSwap,
      );
      await automationManager.connect(keeper).executeDCATick(singleTickJobId, await mockRouter.getAddress(), calldata);
      // The 3-tick job is still active; the single-tick job just completed
      // activeJobCount = 1 (the 3-tick job remains in beforeEach) + 0 (single-tick done)
      // We created 2 jobs total: the beforeEach one + single-tick → expect both counted
      // After single-tick completes: beforeEach job (count 1) + single-tick done (count 0) = 1
      expect(await automationManager.activeJobCount(user.address)).to.equal(1n);
    });

    it('reverts when interval not reached', async () => {
      // First tick sets nextExecution = now + 3600
      const calldata = buildSwapCalldata(
        mockRouter,
        await tokenIn.getAddress(),
        await tokenOut.getAddress(),
        amountPerSwap,
        user.address,
        amountPerSwap,
      );
      await automationManager.connect(keeper).executeDCATick(jobId, await mockRouter.getAddress(), calldata);

      // Second immediate tick should revert — interval not reached
      await expect(
        automationManager.connect(keeper).executeDCATick(jobId, await mockRouter.getAddress(), calldata),
      ).to.be.revertedWithCustomError(automationManager, 'DCAIntervalNotReached');
    });
  });

  // ─── activeJobCount and TooManyJobs ──────────────────────────────────────

  describe('activeJobCount and TooManyJobs', () => {
    it('increments activeJobCount on job creation', async () => {
      expect(await automationManager.activeJobCount(user.address)).to.equal(0n);
      await automationManager.connect(user).createLimitOrder(
        { tokenIn: await tokenIn.getAddress(), tokenOut: await tokenOut.getAddress(),
          amountIn: ethers.parseEther('1'), minAmountOut: ethers.parseEther('1'),
          targetPrice: ethers.parseEther('1'), triggerAbove: true },
        200, 0,
      );
      expect(await automationManager.activeJobCount(user.address)).to.equal(1n);
    });

    it('decrements activeJobCount on cancelJob', async () => {
      const tx = await automationManager.connect(user).createLimitOrder(
        { tokenIn: await tokenIn.getAddress(), tokenOut: await tokenOut.getAddress(),
          amountIn: ethers.parseEther('1'), minAmountOut: ethers.parseEther('1'),
          targetPrice: ethers.parseEther('1'), triggerAbove: true },
        200, 0,
      );
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => { try { return automationManager.interface.parseLog(log); } catch { return null; } })
        .find((e) => e?.name === 'JobCreated');
      const jobId: string = event?.args.jobId;

      await automationManager.connect(user).cancelJob(jobId);
      expect(await automationManager.activeJobCount(user.address)).to.equal(0n);
    });

    it('reverts with TooManyJobs when user hits the per-user cap', async () => {
      // Lower the cap to 1 for isolation
      await automationManager.connect(owner).setMaxJobsPerUser(1);

      await automationManager.connect(user).createLimitOrder(
        { tokenIn: await tokenIn.getAddress(), tokenOut: await tokenOut.getAddress(),
          amountIn: ethers.parseEther('1'), minAmountOut: ethers.parseEther('1'),
          targetPrice: ethers.parseEther('1'), triggerAbove: true },
        200, 0,
      );
      await expect(
        automationManager.connect(user).createLimitOrder(
          { tokenIn: await tokenIn.getAddress(), tokenOut: await tokenOut.getAddress(),
            amountIn: ethers.parseEther('1'), minAmountOut: ethers.parseEther('1'),
            targetPrice: ethers.parseEther('1'), triggerAbove: true },
          200, 0,
        ),
      ).to.be.revertedWithCustomError(automationManager, 'TooManyJobs');
    });
  });

  // ─── expireJob ────────────────────────────────────────────────────────────

  describe('expireJob', () => {
    let expiringJobId: string;

    beforeEach(async () => {
      // Create a job with an expiry a few seconds in the future
      const expiresAt = (await ethers.provider.getBlock('latest'))!.timestamp + 30;
      const tx = await automationManager.connect(user).createLimitOrder(
        { tokenIn: await tokenIn.getAddress(), tokenOut: await tokenOut.getAddress(),
          amountIn: ethers.parseEther('1'), minAmountOut: ethers.parseEther('1'),
          targetPrice: ethers.parseEther('1'), triggerAbove: true },
        200, expiresAt,
      );
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => { try { return automationManager.interface.parseLog(log); } catch { return null; } })
        .find((e) => e?.name === 'JobCreated');
      expiringJobId = event?.args.jobId;
    });

    it('anyone can expire a job once expiresAt has passed', async () => {
      // Advance time past expiry
      await ethers.provider.send('evm_increaseTime', [35]);
      await ethers.provider.send('evm_mine', []);

      await expect(automationManager.connect(stranger).expireJob(expiringJobId))
        .to.emit(automationManager, 'JobExpired')
        .withArgs(expiringJobId);
    });

    it('decrements activeJobCount on expiry', async () => {
      expect(await automationManager.activeJobCount(user.address)).to.equal(1n);

      await ethers.provider.send('evm_increaseTime', [35]);
      await ethers.provider.send('evm_mine', []);

      await automationManager.connect(stranger).expireJob(expiringJobId);
      expect(await automationManager.activeJobCount(user.address)).to.equal(0n);
    });

    it('reverts when job expiry has not yet passed', async () => {
      // expiresAt is only 1 second in the future, but we have NOT advanced time
      // Re-create with a much longer expiry so the test is reliable
      const farExpiry = (await ethers.provider.getBlock('latest'))!.timestamp + 9999;
      const tx = await automationManager.connect(user).createLimitOrder(
        { tokenIn: await tokenIn.getAddress(), tokenOut: await tokenOut.getAddress(),
          amountIn: ethers.parseEther('1'), minAmountOut: ethers.parseEther('1'),
          targetPrice: ethers.parseEther('1'), triggerAbove: true },
        200, farExpiry,
      );
      const receipt = await tx.wait();
      const event = receipt?.logs
        .map((log) => { try { return automationManager.interface.parseLog(log); } catch { return null; } })
        .find((e) => e?.name === 'JobCreated');
      const futureJobId: string = event?.args.jobId;

      await expect(automationManager.connect(stranger).expireJob(futureJobId))
        .to.be.revertedWithCustomError(automationManager, 'InvalidParams');
    });
  });
});

describe('PermitHandler', () => {
  it('deploys successfully', async () => {
    const PermitHandlerFactory = await ethers.getContractFactory('PermitHandler');
    const permitHandler = (await PermitHandlerFactory.deploy()) as PermitHandler;
    await permitHandler.waitForDeployment();
    expect(await permitHandler.getAddress()).to.be.properAddress;
  });
});

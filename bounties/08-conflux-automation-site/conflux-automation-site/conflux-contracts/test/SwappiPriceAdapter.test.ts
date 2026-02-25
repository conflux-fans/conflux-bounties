import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { SwappiPriceAdapter } from '../typechain-types';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('SwappiPriceAdapter', () => {
  let owner: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  let adapter: SwappiPriceAdapter;
  let mockRouter: Awaited<ReturnType<typeof ethers.deployContract>>;
  let mockFactory: Awaited<ReturnType<typeof ethers.deployContract>>;

  // Dummy token addresses — only used for getPair / path, not real ERC-20s
  const TOKEN_A = '0x1111111111111111111111111111111111111111';
  const TOKEN_B = '0x2222222222222222222222222222222222222222';
  const FAKE_PAIR = '0x3333333333333333333333333333333333333333';

  before(async () => {
    [owner, stranger] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const RF = await ethers.getContractFactory('MockSwappiRouter');
    mockRouter = await RF.deploy();
    await mockRouter.waitForDeployment();

    const FF = await ethers.getContractFactory('MockSwappiFactory');
    mockFactory = await FF.deploy();
    await mockFactory.waitForDeployment();

    const AF = await ethers.getContractFactory('SwappiPriceAdapter');
    adapter = (await AF.deploy(
      await mockRouter.getAddress(),
      await mockFactory.getAddress(),
      owner.address,
    )) as unknown as SwappiPriceAdapter;
    await adapter.waitForDeployment();
  });

  // ─── constructor ─────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('reverts when router is address(0)', async () => {
      const AF = await ethers.getContractFactory('SwappiPriceAdapter');
      await expect(
        AF.deploy(ethers.ZeroAddress, await mockFactory.getAddress(), owner.address),
      ).to.be.revertedWith('ZeroAddress');
    });

    it('reverts when factory is address(0)', async () => {
      const AF = await ethers.getContractFactory('SwappiPriceAdapter');
      await expect(
        AF.deploy(await mockRouter.getAddress(), ethers.ZeroAddress, owner.address),
      ).to.be.revertedWith('ZeroAddress');
    });

    it('stores router, factory, and defaults quoteAmount to 1e18', async () => {
      expect(await adapter.router()).to.equal(await mockRouter.getAddress());
      expect(await adapter.factory()).to.equal(await mockFactory.getAddress());
      expect(await adapter.quoteAmount()).to.equal(ethers.parseEther('1'));
    });
  });

  // ─── getPrice ────────────────────────────────────────────────────────────

  describe('getPrice', () => {
    it('returns 0 when the pair does not exist (factory returns address(0))', async () => {
      // factory.pairAddress defaults to address(0)
      expect(await adapter.getPrice(TOKEN_A, TOKEN_B)).to.equal(0n);
    });

    it('returns the router price when pair exists', async () => {
      await mockFactory.setPair(FAKE_PAIR);
      await mockRouter.setPrice(ethers.parseEther('2'));
      expect(await adapter.getPrice(TOKEN_A, TOKEN_B)).to.equal(ethers.parseEther('2'));
    });

    it('returns 0 when the router reverts on getAmountsOut (catch branch)', async () => {
      await mockFactory.setPair(FAKE_PAIR);
      await mockRouter.setShouldRevert(true);
      expect(await adapter.getPrice(TOKEN_A, TOKEN_B)).to.equal(0n);
    });
  });

  // ─── setRouter ───────────────────────────────────────────────────────────

  describe('setRouter', () => {
    it('reverts when called by non-owner', async () => {
      await expect(
        adapter.connect(stranger).setRouter(await mockRouter.getAddress()),
      ).to.be.revertedWithCustomError(adapter, 'OwnableUnauthorizedAccount');
    });

    it('reverts when new router is address(0)', async () => {
      await expect(
        adapter.connect(owner).setRouter(ethers.ZeroAddress),
      ).to.be.revertedWith('ZeroAddress');
    });

    it('updates router and emits RouterUpdated', async () => {
      const newRouter = await (await ethers.getContractFactory('MockSwappiRouter')).deploy();
      await newRouter.waitForDeployment();
      const tx = await adapter.connect(owner).setRouter(await newRouter.getAddress());
      await expect(tx).to.emit(adapter, 'RouterUpdated').withArgs(await newRouter.getAddress());
      expect(await adapter.router()).to.equal(await newRouter.getAddress());
    });
  });

  // ─── setFactory ──────────────────────────────────────────────────────────

  describe('setFactory', () => {
    it('reverts when called by non-owner', async () => {
      await expect(
        adapter.connect(stranger).setFactory(await mockFactory.getAddress()),
      ).to.be.revertedWithCustomError(adapter, 'OwnableUnauthorizedAccount');
    });

    it('reverts when new factory is address(0)', async () => {
      await expect(
        adapter.connect(owner).setFactory(ethers.ZeroAddress),
      ).to.be.revertedWith('ZeroAddress');
    });

    it('updates factory and emits FactoryUpdated', async () => {
      const newFactory = await (await ethers.getContractFactory('MockSwappiFactory')).deploy();
      await newFactory.waitForDeployment();
      const tx = await adapter.connect(owner).setFactory(await newFactory.getAddress());
      await expect(tx).to.emit(adapter, 'FactoryUpdated').withArgs(await newFactory.getAddress());
      expect(await adapter.factory()).to.equal(await newFactory.getAddress());
    });
  });

  // ─── setQuoteAmount ───────────────────────────────────────────────────────

  describe('setQuoteAmount', () => {
    it('reverts when called by non-owner', async () => {
      await expect(
        adapter.connect(stranger).setQuoteAmount(ethers.parseEther('2')),
      ).to.be.revertedWithCustomError(adapter, 'OwnableUnauthorizedAccount');
    });

    it('reverts when new amount is 0', async () => {
      await expect(
        adapter.connect(owner).setQuoteAmount(0n),
      ).to.be.revertedWith('QuoteAmount must be > 0');
    });

    it('updates quoteAmount and emits QuoteAmountUpdated', async () => {
      const newAmount = ethers.parseEther('0.5');
      const tx = await adapter.connect(owner).setQuoteAmount(newAmount);
      await expect(tx).to.emit(adapter, 'QuoteAmountUpdated').withArgs(newAmount);
      expect(await adapter.quoteAmount()).to.equal(newAmount);
    });
  });
});

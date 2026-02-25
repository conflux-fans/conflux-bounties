import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { PermitHandler } from '../typechain-types';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

// ─── Helpers ────────────────────────────────────────────────────────────────

interface PermitTokenLike {
  getAddress(): Promise<string>;
  name(): Promise<string>;
  nonces(address: string): Promise<bigint>;
}

async function signPermit(
  token: PermitTokenLike,
  signer: HardhatEthersSigner,
  spenderAddress: string,
  value: bigint,
  deadline: bigint,
): Promise<{ v: number; r: string; s: string }> {
  const domain = {
    name: await token.name(),
    version: '1',
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: await token.getAddress(),
  };
  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };
  const nonce = await token.nonces(signer.address);
  const sig = await signer.signTypedData(domain, types, {
    owner: signer.address,
    spender: spenderAddress,
    value,
    nonce,
    deadline,
  });
  const { v, r, s } = ethers.Signature.from(sig);
  return { v, r, s };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PermitHandler', () => {
  let permitHandler: PermitHandler;
  let user: HardhatEthersSigner;
  let spender: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  let token: Awaited<ReturnType<typeof ethers.deployContract>>;
  let revertToken: Awaited<ReturnType<typeof ethers.deployContract>>;
  let panicToken: Awaited<ReturnType<typeof ethers.deployContract>>;
  let callTarget: Awaited<ReturnType<typeof ethers.deployContract>>;

  const VALUE = ethers.parseEther('100');
  const DEADLINE = BigInt(Math.floor(Date.now() / 1000) + 3600);

  before(async () => {
    [, user, spender, stranger] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const PHFactory = await ethers.getContractFactory('PermitHandler');
    permitHandler = (await PHFactory.deploy()) as unknown as PermitHandler;
    await permitHandler.waitForDeployment();

    // ERC-20 with real EIP-2612 permit
    const TF = await ethers.getContractFactory('MockERC20Permit');
    token = await TF.deploy('TestToken', 'TTK');
    await token.waitForDeployment();
    await token.mint(user.address, ethers.parseEther('1000'));

    // Token whose permit() reverts with a string
    const RF = await ethers.getContractFactory('MockRevertPermitToken');
    revertToken = await RF.deploy();
    await revertToken.waitForDeployment();

    // Token whose permit() reverts with a custom error (no string)
    const PF = await ethers.getContractFactory('MockPanicPermitToken');
    panicToken = await PF.deploy();
    await panicToken.waitForDeployment();

    // Generic downstream call target
    const CF = await ethers.getContractFactory('MockCallTarget');
    callTarget = await CF.deploy();
    await callTarget.waitForDeployment();
  });

  // ─── permitAndApprove ─────────────────────────────────────────────────────

  describe('permitAndApprove', () => {
    it('reverts ZeroAddress when token is address(0)', async () => {
      const { v, r, s } = await signPermit(token as unknown as PermitTokenLike, user, spender.address, VALUE, DEADLINE);
      await expect(
        permitHandler.connect(user).permitAndApprove(
          ethers.ZeroAddress, user.address, spender.address, VALUE, DEADLINE, v, r, s,
        ),
      ).to.be.revertedWithCustomError(permitHandler, 'ZeroAddress');
    });

    it('reverts ZeroAddress when spender is address(0)', async () => {
      const { v, r, s } = await signPermit(token as unknown as PermitTokenLike, user, spender.address, VALUE, DEADLINE);
      await expect(
        permitHandler.connect(user).permitAndApprove(
          await token.getAddress(), user.address, ethers.ZeroAddress, VALUE, DEADLINE, v, r, s,
        ),
      ).to.be.revertedWithCustomError(permitHandler, 'ZeroAddress');
    });

    it('reverts ZeroAmount when value is 0', async () => {
      const { v, r, s } = await signPermit(token as unknown as PermitTokenLike, user, spender.address, VALUE, DEADLINE);
      await expect(
        permitHandler.connect(user).permitAndApprove(
          await token.getAddress(), user.address, spender.address, 0n, DEADLINE, v, r, s,
        ),
      ).to.be.revertedWithCustomError(permitHandler, 'ZeroAmount');
    });

    it('reverts PermitFailed when owner != msg.sender', async () => {
      const { v, r, s } = await signPermit(token as unknown as PermitTokenLike, user, spender.address, VALUE, DEADLINE);
      await expect(
        permitHandler.connect(stranger).permitAndApprove(
          await token.getAddress(), user.address, spender.address, VALUE, DEADLINE, v, r, s,
        ),
      ).to.be.revertedWithCustomError(permitHandler, 'PermitFailed');
    });

    it('succeeds with valid permit: emits PermitApplied and sets allowance on token', async () => {
      const { v, r, s } = await signPermit(token as unknown as PermitTokenLike, user, spender.address, VALUE, DEADLINE);
      const tx = await permitHandler.connect(user).permitAndApprove(
        await token.getAddress(), user.address, spender.address, VALUE, DEADLINE, v, r, s,
      );
      await expect(tx)
        .to.emit(permitHandler, 'PermitApplied')
        .withArgs(await token.getAddress(), user.address, spender.address, VALUE, DEADLINE);
      // ERC20Permit.permit() sets the allowance on the token itself
      expect(await token.allowance(user.address, spender.address)).to.equal(VALUE);
    });

    it('reverts PermitFailed with reason when permit reverts with a string', async () => {
      await expect(
        permitHandler.connect(user).permitAndApprove(
          await revertToken.getAddress(), user.address, spender.address, VALUE, DEADLINE,
          28, ethers.ZeroHash, ethers.ZeroHash,
        ),
      ).to.be.revertedWithCustomError(permitHandler, 'PermitFailed');
    });

    it('reverts PermitFailed("unknown") when permit reverts with a custom error', async () => {
      await expect(
        permitHandler.connect(user).permitAndApprove(
          await panicToken.getAddress(), user.address, spender.address, VALUE, DEADLINE,
          28, ethers.ZeroHash, ethers.ZeroHash,
        ),
      ).to.be.revertedWithCustomError(permitHandler, 'PermitFailed');
    });
  });

  // ─── permitApproveAndCall ─────────────────────────────────────────────────

  describe('permitApproveAndCall', () => {
    it('reverts ZeroAddress when token is address(0)', async () => {
      await expect(
        permitHandler.connect(user).permitApproveAndCall(
          ethers.ZeroAddress, user.address, await callTarget.getAddress(),
          VALUE, DEADLINE, 28, ethers.ZeroHash, ethers.ZeroHash, '0x',
        ),
      ).to.be.revertedWithCustomError(permitHandler, 'ZeroAddress');
    });

    it('reverts ZeroAddress when spender is address(0)', async () => {
      await expect(
        permitHandler.connect(user).permitApproveAndCall(
          await token.getAddress(), user.address, ethers.ZeroAddress,
          VALUE, DEADLINE, 28, ethers.ZeroHash, ethers.ZeroHash, '0x',
        ),
      ).to.be.revertedWithCustomError(permitHandler, 'ZeroAddress');
    });

    it('reverts PermitFailed when owner != msg.sender', async () => {
      await expect(
        permitHandler.connect(stranger).permitApproveAndCall(
          await token.getAddress(), user.address, await callTarget.getAddress(),
          VALUE, DEADLINE, 28, ethers.ZeroHash, ethers.ZeroHash, '0x',
        ),
      ).to.be.revertedWithCustomError(permitHandler, 'PermitFailed');
    });

    it('succeeds: valid permit + downstream call, emits PermitApplied', async () => {
      const { v, r, s } = await signPermit(
        token as unknown as PermitTokenLike, user, await callTarget.getAddress(), VALUE, DEADLINE,
      );
      const tx = await permitHandler.connect(user).permitApproveAndCall(
        await token.getAddress(), user.address, await callTarget.getAddress(),
        VALUE, DEADLINE, v, r, s, '0x1234',
      );
      await expect(tx).to.emit(permitHandler, 'PermitApplied');
    });

    it('silently swallows permit failure and still forwards the downstream call', async () => {
      // panicToken permit reverts with custom error — catch {} swallows it
      await expect(
        permitHandler.connect(user).permitApproveAndCall(
          await panicToken.getAddress(), user.address, await callTarget.getAddress(),
          VALUE, DEADLINE, 28, ethers.ZeroHash, ethers.ZeroHash, '0xdeadbeef',
        ),
      ).to.not.be.reverted;
    });

    it('reverts "AutomationManager call failed" when downstream call fails', async () => {
      await callTarget.setShouldFail(true);
      const { v, r, s } = await signPermit(
        token as unknown as PermitTokenLike, user, await callTarget.getAddress(), VALUE, DEADLINE,
      );
      await expect(
        permitHandler.connect(user).permitApproveAndCall(
          await token.getAddress(), user.address, await callTarget.getAddress(),
          VALUE, DEADLINE, v, r, s,
          '0xdeadbeef', // non-empty → routes to fallback(), not receive()
        ),
      ).to.be.revertedWith('AutomationManager call failed');
    });
  });
});

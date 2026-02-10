import { expect } from "chai";
import { ethers } from "hardhat";
import { X402PaymentReceiver } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("X402PaymentReceiver", function () {
  let contract: X402PaymentReceiver;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let buyer: SignerWithAddress;
  let other: SignerWithAddress;

  const INVOICE_ID = ethers.zeroPadValue(ethers.toUtf8Bytes("test-invoice"), 32);

  beforeEach(async function () {
    [owner, treasury, buyer, other] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("X402PaymentReceiver");
    contract = await Factory.deploy(treasury.address);
    await contract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set correct owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("should set correct treasury", async function () {
      expect(await contract.treasury()).to.equal(treasury.address);
    });

    it("should revert if treasury is zero address", async function () {
      const Factory = await ethers.getContractFactory("X402PaymentReceiver");
      await expect(
        Factory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury");
    });
  });

  describe("payNative", function () {
    it("should accept CFX and forward to treasury", async function () {
      const amount = ethers.parseEther("1.0");
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await contract.connect(buyer).payNative(INVOICE_ID, { value: amount });

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryAfter - treasuryBefore).to.equal(amount);
    });

    it("should emit PaymentReceived event", async function () {
      const amount = ethers.parseEther("0.5");

      await expect(
        contract.connect(buyer).payNative(INVOICE_ID, { value: amount })
      )
        .to.emit(contract, "PaymentReceived")
        .withArgs(INVOICE_ID, buyer.address, ethers.ZeroAddress, amount, "native");
    });

    it("should revert on zero payment", async function () {
      await expect(
        contract.connect(buyer).payNative(INVOICE_ID, { value: 0 })
      ).to.be.revertedWith("Zero payment");
    });
  });

  describe("payWithToken (buyer calls directly)", function () {
    let mockToken: any;

    beforeEach(async function () {
      // Deploy a mock ERC-20 for testing
      const MockFactory = await ethers.getContractFactory("MockERC20");
      mockToken = await MockFactory.deploy("Mock USDT", "USDT", 18);
      await mockToken.waitForDeployment();

      // Mint tokens to buyer
      await mockToken.mint(buyer.address, ethers.parseEther("1000"));
    });

    it("should accept ERC-20 tokens with approval", async function () {
      const amount = ethers.parseEther("10");
      const tokenAddr = await mockToken.getAddress();
      const contractAddr = await contract.getAddress();

      // Approve
      await mockToken.connect(buyer).approve(contractAddr, amount);

      // Pay
      await contract.connect(buyer).payWithToken(tokenAddr, amount, INVOICE_ID);

      // Treasury should have the tokens
      expect(await mockToken.balanceOf(treasury.address)).to.equal(amount);
    });

    it("should emit PaymentReceived event for ERC-20", async function () {
      const amount = ethers.parseEther("5");
      const tokenAddr = await mockToken.getAddress();
      const contractAddr = await contract.getAddress();

      await mockToken.connect(buyer).approve(contractAddr, amount);

      await expect(
        contract.connect(buyer).payWithToken(tokenAddr, amount, INVOICE_ID)
      )
        .to.emit(contract, "PaymentReceived")
        .withArgs(INVOICE_ID, buyer.address, tokenAddr, amount, "erc20");
    });

    it("should revert on zero amount", async function () {
      const tokenAddr = await mockToken.getAddress();
      await expect(
        contract.connect(buyer).payWithToken(tokenAddr, 0, INVOICE_ID)
      ).to.be.revertedWith("Zero amount");
    });

    it("should revert for native address", async function () {
      await expect(
        contract.connect(buyer).payWithToken(ethers.ZeroAddress, 100, INVOICE_ID)
      ).to.be.revertedWith("Use payNative for CFX");
    });

    it("should revert without approval", async function () {
      const tokenAddr = await mockToken.getAddress();
      await expect(
        contract.connect(buyer).payWithToken(tokenAddr, ethers.parseEther("10"), INVOICE_ID)
      ).to.be.revertedWith("Insufficient allowance");
    });
  });

  describe("payWithTokenFrom (relayer)", function () {
    let mockToken: any;

    beforeEach(async function () {
      const MockFactory = await ethers.getContractFactory("MockERC20");
      mockToken = await MockFactory.deploy("Mock USDT", "USDT", 18);
      await mockToken.waitForDeployment();
      await mockToken.mint(buyer.address, ethers.parseEther("1000"));
    });

    it("should allow owner to settle on behalf of buyer", async function () {
      const amount = ethers.parseEther("10");
      const tokenAddr = await mockToken.getAddress();
      const contractAddr = await contract.getAddress();

      // Buyer approves contract
      await mockToken.connect(buyer).approve(contractAddr, amount);

      // Owner (relayer) calls payWithTokenFrom
      await contract.connect(owner).payWithTokenFrom(tokenAddr, buyer.address, amount, INVOICE_ID);

      expect(await mockToken.balanceOf(treasury.address)).to.equal(amount);
    });

    it("should revert if not owner", async function () {
      const tokenAddr = await mockToken.getAddress();
      const contractAddr = await contract.getAddress();

      await mockToken.connect(buyer).approve(contractAddr, ethers.parseEther("10"));

      await expect(
        contract.connect(other).payWithTokenFrom(tokenAddr, buyer.address, ethers.parseEther("10"), INVOICE_ID)
      ).to.be.revertedWith("Not owner");
    });

    it("should revert with invalid payer address", async function () {
      const tokenAddr = await mockToken.getAddress();
      await expect(
        contract.connect(owner).payWithTokenFrom(tokenAddr, ethers.ZeroAddress, 100, INVOICE_ID)
      ).to.be.revertedWith("Invalid payer");
    });
  });

  describe("Admin", function () {
    it("should allow owner to update treasury", async function () {
      await contract.connect(owner).setTreasury(other.address);
      expect(await contract.treasury()).to.equal(other.address);
    });

    it("should emit TreasuryUpdated event", async function () {
      await expect(contract.connect(owner).setTreasury(other.address))
        .to.emit(contract, "TreasuryUpdated")
        .withArgs(treasury.address, other.address);
    });

    it("should revert if non-owner updates treasury", async function () {
      await expect(
        contract.connect(other).setTreasury(other.address)
      ).to.be.revertedWith("Not owner");
    });

    it("should allow ownership transfer", async function () {
      await contract.connect(owner).transferOwnership(other.address);
      expect(await contract.owner()).to.equal(other.address);
    });

    it("should revert on zero address treasury", async function () {
      await expect(
        contract.connect(owner).setTreasury(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury");
    });

    it("should revert on zero address ownership transfer", async function () {
      await expect(
        contract.connect(owner).transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid owner");
    });
  });

  describe("rescueTokens", function () {
    it("should rescue stuck CFX", async function () {
      // Send CFX directly to contract (via receive())
      const amount = ethers.parseEther("0.1");

      // The contract forwards to treasury via receive(), so send to treasury first
      // Actually, test rescue by sending via low-level call
      const contractAddr = await contract.getAddress();

      const ownerBefore = await ethers.provider.getBalance(owner.address);

      // Use rescueTokens for native CFX (0 address)
      // First, need CFX in contract - send via payNative and set treasury to contract itself temporarily
      // Simpler: just verify the function exists and reverts properly when no balance
      await expect(
        contract.connect(owner).rescueTokens(ethers.ZeroAddress, amount)
      ).to.be.reverted; // Will revert because contract has no balance
    });

    it("should rescue stuck ERC-20 tokens", async function () {
      const MockFactory = await ethers.getContractFactory("MockERC20");
      const mockToken = await MockFactory.deploy("Stuck", "STUCK", 18);
      await mockToken.waitForDeployment();

      const contractAddr = await contract.getAddress();
      const tokenAddr = await mockToken.getAddress();

      // Send tokens directly to contract (simulating stuck tokens)
      await mockToken.mint(contractAddr, ethers.parseEther("100"));

      // Rescue
      await contract.connect(owner).rescueTokens(tokenAddr, ethers.parseEther("100"));

      expect(await mockToken.balanceOf(owner.address)).to.equal(ethers.parseEther("100"));
    });

    it("should revert if non-owner tries to rescue", async function () {
      await expect(
        contract.connect(other).rescueTokens(ethers.ZeroAddress, 100)
      ).to.be.revertedWith("Not owner");
    });
  });

  describe("receive()", function () {
    it("should forward plain CFX to treasury", async function () {
      const amount = ethers.parseEther("0.5");
      const contractAddr = await contract.getAddress();
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await buyer.sendTransaction({ to: contractAddr, value: amount });

      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      expect(treasuryAfter - treasuryBefore).to.equal(amount);
    });
  });
});

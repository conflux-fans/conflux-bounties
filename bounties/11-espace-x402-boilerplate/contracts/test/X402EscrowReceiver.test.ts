import { expect } from "chai";
import { ethers } from "hardhat";
import { X402EscrowReceiver } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("X402EscrowReceiver", function () {
  let contract: X402EscrowReceiver;
  let owner: SignerWithAddress;
  let treasury: SignerWithAddress;
  let buyer: SignerWithAddress;
  let other: SignerWithAddress;

  const INVOICE_1 = ethers.zeroPadValue(ethers.toUtf8Bytes("invoice-001"), 32);
  const INVOICE_2 = ethers.zeroPadValue(ethers.toUtf8Bytes("invoice-002"), 32);

  beforeEach(async function () {
    [owner, treasury, buyer, other] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("X402EscrowReceiver");
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
      const Factory = await ethers.getContractFactory("X402EscrowReceiver");
      await expect(
        Factory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury");
    });
  });

  describe("holdNative", function () {
    it("should hold CFX in escrow", async function () {
      const amount = ethers.parseEther("1.0");
      const contractAddr = await contract.getAddress();

      await contract.connect(buyer).holdNative(INVOICE_1, { value: amount });

      // Funds should be in contract, NOT in treasury
      const contractBalance = await ethers.provider.getBalance(contractAddr);
      expect(contractBalance).to.equal(amount);
    });

    it("should emit PaymentHeld event", async function () {
      const amount = ethers.parseEther("0.5");

      await expect(
        contract.connect(buyer).holdNative(INVOICE_1, { value: amount })
      )
        .to.emit(contract, "PaymentHeld")
        .withArgs(INVOICE_1, buyer.address, ethers.ZeroAddress, amount);
    });

    it("should revert on zero payment", async function () {
      await expect(
        contract.connect(buyer).holdNative(INVOICE_1, { value: 0 })
      ).to.be.revertedWith("Zero payment");
    });

    it("should revert on duplicate invoiceId", async function () {
      const amount = ethers.parseEther("1.0");
      await contract.connect(buyer).holdNative(INVOICE_1, { value: amount });

      await expect(
        contract.connect(buyer).holdNative(INVOICE_1, { value: amount })
      ).to.be.revertedWith("Invoice exists");
    });
  });

  describe("holdToken", function () {
    let mockToken: any;

    beforeEach(async function () {
      const MockFactory = await ethers.getContractFactory("MockERC20");
      mockToken = await MockFactory.deploy("Mock USDT", "USDT", 18);
      await mockToken.waitForDeployment();
      await mockToken.mint(buyer.address, ethers.parseEther("1000"));
    });

    it("should hold ERC-20 in escrow", async function () {
      const amount = ethers.parseEther("50");
      const tokenAddr = await mockToken.getAddress();
      const contractAddr = await contract.getAddress();

      await mockToken.connect(buyer).approve(contractAddr, amount);
      await contract.connect(buyer).holdToken(tokenAddr, amount, INVOICE_1);

      // Tokens should be in contract
      expect(await mockToken.balanceOf(contractAddr)).to.equal(amount);
    });

    it("should emit PaymentHeld event for ERC-20", async function () {
      const amount = ethers.parseEther("10");
      const tokenAddr = await mockToken.getAddress();
      const contractAddr = await contract.getAddress();

      await mockToken.connect(buyer).approve(contractAddr, amount);

      await expect(
        contract.connect(buyer).holdToken(tokenAddr, amount, INVOICE_1)
      )
        .to.emit(contract, "PaymentHeld")
        .withArgs(INVOICE_1, buyer.address, tokenAddr, amount);
    });

    it("should revert on zero amount", async function () {
      const tokenAddr = await mockToken.getAddress();
      await expect(
        contract.connect(buyer).holdToken(tokenAddr, 0, INVOICE_1)
      ).to.be.revertedWith("Zero amount");
    });

    it("should revert on duplicate invoiceId", async function () {
      const amount = ethers.parseEther("10");
      const tokenAddr = await mockToken.getAddress();
      const contractAddr = await contract.getAddress();

      await mockToken.connect(buyer).approve(contractAddr, ethers.parseEther("100"));
      await contract.connect(buyer).holdToken(tokenAddr, amount, INVOICE_1);

      await expect(
        contract.connect(buyer).holdToken(tokenAddr, amount, INVOICE_1)
      ).to.be.revertedWith("Invoice exists");
    });
  });

  describe("releasePayment", function () {
    it("should release CFX to treasury", async function () {
      const amount = ethers.parseEther("2.0");
      await contract.connect(buyer).holdNative(INVOICE_1, { value: amount });

      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      await contract.connect(owner).releasePayment(INVOICE_1);
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);

      expect(treasuryAfter - treasuryBefore).to.equal(amount);
    });

    it("should release ERC-20 to treasury", async function () {
      const MockFactory = await ethers.getContractFactory("MockERC20");
      const mockToken = await MockFactory.deploy("Mock USDT", "USDT", 18);
      await mockToken.waitForDeployment();
      await mockToken.mint(buyer.address, ethers.parseEther("1000"));

      const amount = ethers.parseEther("25");
      const tokenAddr = await mockToken.getAddress();
      const contractAddr = await contract.getAddress();

      await mockToken.connect(buyer).approve(contractAddr, amount);
      await contract.connect(buyer).holdToken(tokenAddr, amount, INVOICE_1);

      await contract.connect(owner).releasePayment(INVOICE_1);

      expect(await mockToken.balanceOf(treasury.address)).to.equal(amount);
    });

    it("should emit PaymentReleased event", async function () {
      const amount = ethers.parseEther("1.0");
      await contract.connect(buyer).holdNative(INVOICE_1, { value: amount });

      await expect(contract.connect(owner).releasePayment(INVOICE_1))
        .to.emit(contract, "PaymentReleased")
        .withArgs(INVOICE_1, buyer.address, amount);
    });

    it("should revert if not in escrow", async function () {
      await expect(
        contract.connect(owner).releasePayment(INVOICE_1)
      ).to.be.revertedWith("Not in escrow");
    });

    it("should revert if not owner", async function () {
      const amount = ethers.parseEther("1.0");
      await contract.connect(buyer).holdNative(INVOICE_1, { value: amount });

      await expect(
        contract.connect(other).releasePayment(INVOICE_1)
      ).to.be.revertedWith("Not owner");
    });
  });

  describe("refundPayment", function () {
    it("should refund CFX to payer", async function () {
      const amount = ethers.parseEther("3.0");
      await contract.connect(buyer).holdNative(INVOICE_1, { value: amount });

      const buyerBefore = await ethers.provider.getBalance(buyer.address);
      await contract.connect(owner).refundPayment(INVOICE_1);
      const buyerAfter = await ethers.provider.getBalance(buyer.address);

      // Buyer receives the refund (exact amount since owner pays gas)
      expect(buyerAfter - buyerBefore).to.equal(amount);
    });

    it("should refund ERC-20 to payer", async function () {
      const MockFactory = await ethers.getContractFactory("MockERC20");
      const mockToken = await MockFactory.deploy("Mock USDT", "USDT", 18);
      await mockToken.waitForDeployment();
      await mockToken.mint(buyer.address, ethers.parseEther("1000"));

      const amount = ethers.parseEther("50");
      const tokenAddr = await mockToken.getAddress();
      const contractAddr = await contract.getAddress();

      await mockToken.connect(buyer).approve(contractAddr, amount);
      await contract.connect(buyer).holdToken(tokenAddr, amount, INVOICE_1);

      // Buyer had 1000, escrowed 50, should now have 950
      expect(await mockToken.balanceOf(buyer.address)).to.equal(ethers.parseEther("950"));

      await contract.connect(owner).refundPayment(INVOICE_1);

      // Buyer should have 1000 back
      expect(await mockToken.balanceOf(buyer.address)).to.equal(ethers.parseEther("1000"));
    });

    it("should emit PaymentRefunded event", async function () {
      const amount = ethers.parseEther("1.0");
      await contract.connect(buyer).holdNative(INVOICE_1, { value: amount });

      await expect(contract.connect(owner).refundPayment(INVOICE_1))
        .to.emit(contract, "PaymentRefunded")
        .withArgs(INVOICE_1, buyer.address, amount);
    });

    it("should revert if not in escrow", async function () {
      await expect(
        contract.connect(owner).refundPayment(INVOICE_1)
      ).to.be.revertedWith("Not in escrow");
    });

    it("should revert if not owner", async function () {
      const amount = ethers.parseEther("1.0");
      await contract.connect(buyer).holdNative(INVOICE_1, { value: amount });

      await expect(
        contract.connect(other).refundPayment(INVOICE_1)
      ).to.be.revertedWith("Not owner");
    });

    it("should revert if already released", async function () {
      const amount = ethers.parseEther("1.0");
      await contract.connect(buyer).holdNative(INVOICE_1, { value: amount });
      await contract.connect(owner).releasePayment(INVOICE_1);

      await expect(
        contract.connect(owner).refundPayment(INVOICE_1)
      ).to.be.revertedWith("Not in escrow");
    });

    it("should revert if already refunded", async function () {
      const amount = ethers.parseEther("1.0");
      await contract.connect(buyer).holdNative(INVOICE_1, { value: amount });
      await contract.connect(owner).refundPayment(INVOICE_1);

      await expect(
        contract.connect(owner).refundPayment(INVOICE_1)
      ).to.be.revertedWith("Not in escrow");
    });
  });

  describe("getEscrow", function () {
    it("should return correct escrow data", async function () {
      const amount = ethers.parseEther("5.0");
      await contract.connect(buyer).holdNative(INVOICE_1, { value: amount });

      const [payer, token, amt, status] = await contract.getEscrow(INVOICE_1);
      expect(payer).to.equal(buyer.address);
      expect(token).to.equal(ethers.ZeroAddress);
      expect(amt).to.equal(amount);
      expect(status).to.equal(1); // Held
    });

    it("should return None status for unknown invoice", async function () {
      const [, , , status] = await contract.getEscrow(INVOICE_1);
      expect(status).to.equal(0); // None
    });
  });

  describe("Admin", function () {
    it("should allow owner to update treasury", async function () {
      await contract.connect(owner).setTreasury(other.address);
      expect(await contract.treasury()).to.equal(other.address);
    });

    it("should allow ownership transfer", async function () {
      await contract.connect(owner).transferOwnership(other.address);
      expect(await contract.owner()).to.equal(other.address);
    });
  });
});

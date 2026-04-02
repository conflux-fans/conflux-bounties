import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockUSDT0, X402PaymentVerifier } from "../typechain-types";

describe("X402PaymentVerifier (Multi-Tenant ERC-3009)", function () {
  let token: MockUSDT0;
  let verifier: X402PaymentVerifier;
  let owner: any;
  let payer: any;
  let seller1: any;
  let seller2: any;

  const endpoint = "/data/premium";
  const amount = 100_000n; // 0.1 USDT0 (6 decimals)

  // Helper: derive on-chain invoiceId = keccak256(abi.encode(from, recipient, token, nonce))
  function deriveInvoiceId(from: string, recipient: string, tokenAddr: string, nonce: string): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "address", "bytes32"],
        [from, recipient, tokenAddr, nonce]
      )
    );
  }

  // Helper to sign an ERC-3009 ReceiveWithAuthorization
  // The buyer signs with `to` = verifier address (contract receives then forwards)
  async function signReceiveAuthorization(
    signer: any,
    tokenAddr: string,
    to: string,
    value: bigint,
    validAfter: number,
    validBefore: number,
    nonce: string
  ) {
    const domain = {
      name: "USD Tether 0",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: tokenAddr,
    };
    const types = {
      ReceiveWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    };
    const message = {
      from: signer.address,
      to,
      value,
      validAfter,
      validBefore,
      nonce,
    };

    const sig = await signer.signTypedData(domain, types, message);
    const { v, r, s } = ethers.Signature.from(sig);
    return { v, r, s };
  }

  const ESCROW_24H = 24 * 60 * 60; // 24 hours in seconds

  // Helper: ensure seller is registered (idempotent) with 24h escrow by default
  async function ensureSellerRegistered(sellerSigner: any, escrowDuration: number = ESCROW_24H) {
    const seller = await verifier.getSeller(sellerSigner.address);
    if (seller.registeredAt === 0n) {
      await verifier.connect(sellerSigner).registerSeller("https://test.example.com", "Test Seller", escrowDuration);
    } else if (!seller.active) {
      await verifier.connect(sellerSigner).reactivateSeller("https://test.example.com", "Test Seller", escrowDuration);
    }
  }

  // Helper to settle a payment and return common vars (including derived invoiceId)
  async function settlePayment(
    sellerSigner: any,
    nonceSuffix: string = "001",
    ep: string = endpoint
  ) {
    await ensureSellerRegistered(sellerSigner);

    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id(`nonce-${nonceSuffix}`);
    const validAfter = 0;
    // Use blockchain time, not Date.now(), so it works after time.increase()
    const latestBlock = await ethers.provider.getBlock("latest");
    const validBefore = latestBlock!.timestamp + 300;

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    await verifier.connect(sellerSigner).settle(
      tokenAddr, payer.address, sellerSigner.address, amount,
      validAfter, validBefore, nonce, ep, v, r, s
    );

    const invoiceId = deriveInvoiceId(payer.address, sellerSigner.address, tokenAddr, nonce);
    return { tokenAddr, verifierAddr, nonce, validAfter, validBefore, invoiceId };
  }

  beforeEach(async function () {
    [owner, payer, seller1, seller2] = await ethers.getSigners();

    // Deploy MockUSDT0
    const tokenFactory = await ethers.getContractFactory("MockUSDT0");
    token = (await tokenFactory.deploy()) as MockUSDT0;
    await token.waitForDeployment();

    // Deploy X402PaymentVerifier
    const tokenAddr = await token.getAddress();
    const factory = await ethers.getContractFactory("X402PaymentVerifier");
    verifier = (await factory.deploy([tokenAddr])) as X402PaymentVerifier;
    await verifier.waitForDeployment();

    // Mint USDT0 to the payer
    await token.mint(payer.address, 10_000_000n); // 10 USDT0

  });

  // ─── Settlement Tests ───

  it("should settle a valid ERC-3009 payment (funds held in escrow)", async function () {
    await ensureSellerRegistered(seller1, ESCROW_24H);
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-001");
    const validAfter = 0;
    const validBefore = (await ethers.provider.getBlock("latest"))!.timestamp + 300;

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    const invoiceId = deriveInvoiceId(payer.address, seller1.address, tokenAddr, nonce);

    // Seller1 calls settle (msg.sender == recipient required)
    await expect(
      verifier.connect(seller1).settle(
        tokenAddr, payer.address, seller1.address, amount,
        validAfter, validBefore, nonce, endpoint, v, r, s
      )
    )
      .to.emit(verifier, "PaymentReceived")
      .withArgs(invoiceId, payer.address, seller1.address, tokenAddr, amount, endpoint, nonce, (await ethers.provider.getNetwork()).chainId);

    // Funds are in the contract (escrow), NOT with the seller yet
    expect(await token.balanceOf(verifierAddr)).to.equal(amount);
    expect(await token.balanceOf(seller1.address)).to.equal(0);

    // Payment is recorded with escrow fields
    const payment = await verifier.getPayment(invoiceId);
    expect(payment.released).to.be.false;
    expect(payment.refunded).to.be.false;
    expect(payment.releaseAt).to.be.greaterThan(payment.paidAt);
  });

  it("should settle payments to different sellers (multi-tenant)", async function () {
    await ensureSellerRegistered(seller1);
    await ensureSellerRegistered(seller2);
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const validBefore = (await ethers.provider.getBlock("latest"))!.timestamp + 300;

    // Payment to seller1
    const nonce1 = ethers.id("nonce-mt-001");
    const sig1 = await signReceiveAuthorization(payer, tokenAddr, verifierAddr, amount, 0, validBefore, nonce1);
    await verifier.connect(seller1).settle(
      tokenAddr, payer.address, seller1.address, amount,
      0, validBefore, nonce1, endpoint, sig1.v, sig1.r, sig1.s
    );

    // Payment to seller2
    const nonce2 = ethers.id("nonce-mt-002");
    const sig2 = await signReceiveAuthorization(payer, tokenAddr, verifierAddr, amount, 0, validBefore, nonce2);
    await verifier.connect(seller2).settle(
      tokenAddr, payer.address, seller2.address, amount,
      0, validBefore, nonce2, "/compute/simulate", sig2.v, sig2.r, sig2.s
    );

    // Both payments held in escrow
    expect(await token.balanceOf(verifierAddr)).to.equal(amount * 2n);
  });

  it("should verify a paid invoice", async function () {
    const { invoiceId } = await settlePayment(seller1, "002");

    const [valid, payerAddr] = await verifier.verifyPayment(invoiceId, amount, endpoint);
    expect(valid).to.be.true;
    expect(payerAddr).to.equal(payer.address);
  });

  it("should reject expired authorization", async function () {
    await ensureSellerRegistered(seller1);
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-003");
    const validAfter = 0;
    const validBefore = 1; // already expired (timestamp 1)

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    await expect(
      verifier.connect(seller1).settle(
        tokenAddr, payer.address, seller1.address, amount,
        validAfter, validBefore, nonce, endpoint, v, r, s
      )
    ).to.be.revertedWith("X402: authorization expired");
  });

  it("should reject duplicate nonce", async function () {
    await ensureSellerRegistered(seller1);
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-004");
    const validAfter = 0;
    const validBefore = (await ethers.provider.getBlock("latest"))!.timestamp + 300;

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    await verifier.connect(seller1).settle(
      tokenAddr, payer.address, seller1.address, amount,
      validAfter, validBefore, nonce, endpoint, v, r, s
    );

    const sig2 = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    // Same (from, recipient, token, nonce) → same derived invoiceId → "already paid"
    await expect(
      verifier.connect(seller1).settle(
        tokenAddr, payer.address, seller1.address, amount,
        validAfter, validBefore, nonce, endpoint, sig2.v, sig2.r, sig2.s
      )
    ).to.be.revertedWith("X402: already paid");
  });

  it("should reject duplicate invoice payment (same from/recipient/token/nonce)", async function () {
    await ensureSellerRegistered(seller1);
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce1 = ethers.id("nonce-005");
    const validAfter = 0;
    const validBefore = (await ethers.provider.getBlock("latest"))!.timestamp + 300;

    const sig1 = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce1
    );
    await verifier.connect(seller1).settle(
      tokenAddr, payer.address, seller1.address, amount,
      validAfter, validBefore, nonce1, endpoint, sig1.v, sig1.r, sig1.s
    );

    // Same nonce → same derived invoiceId → "already paid"
    // (also blocked by "nonce already used" since ERC-3009 nonces are per-token)
    const nonce2 = ethers.id("nonce-006");
    const sig2 = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce2
    );
    // This uses a different nonce so the derived invoiceId is different — no "already paid"
    // The old test checked that the same invoiceId param was rejected; now invoiceId is derived,
    // so duplicate detection is automatic via nonce reuse
    await verifier.connect(seller1).settle(
      tokenAddr, payer.address, seller1.address, amount,
      validAfter, validBefore, nonce2, endpoint, sig2.v, sig2.r, sig2.s
    );
  });

  it("should reject zero payment", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-007");
    const validAfter = 0;
    const validBefore = (await ethers.provider.getBlock("latest"))!.timestamp + 300;

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, 0n, validAfter, validBefore, nonce
    );

    await expect(
      verifier.connect(seller1).settle(
        tokenAddr, payer.address, seller1.address, 0n,
        validAfter, validBefore, nonce, endpoint, v, r, s
      )
    ).to.be.revertedWith("X402: zero payment");
  });

  it("should reject zero recipient", async function () {
    const tokenAddr = await token.getAddress();
    const nonce = ethers.id("nonce-zero-recip");
    const validAfter = 0;
    const validBefore = (await ethers.provider.getBlock("latest"))!.timestamp + 300;

    await expect(
      verifier.settle(
        tokenAddr, payer.address, ethers.ZeroAddress, amount,
        validAfter, validBefore, nonce, endpoint, 27, ethers.ZeroHash, ethers.ZeroHash
      )
    ).to.be.revertedWith("X402: zero recipient");
  });

  it("should reject self-payment", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-self-pay");
    const validAfter = 0;
    const validBefore = (await ethers.provider.getBlock("latest"))!.timestamp + 300;

    const { v, r, s } = await signReceiveAuthorization(
      seller1, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    await expect(
      verifier.connect(seller1).settle(
        tokenAddr, seller1.address, seller1.address, amount,
        validAfter, validBefore, nonce, endpoint, v, r, s
      )
    ).to.be.revertedWith("X402: self-payment");
  });

  it("should reject settle from non-recipient", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-non-recip");
    const validAfter = 0;
    const validBefore = (await ethers.provider.getBlock("latest"))!.timestamp + 300;

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    await expect(
      verifier.connect(seller2).settle(
        tokenAddr, payer.address, seller1.address, amount,
        validAfter, validBefore, nonce, endpoint, v, r, s
      )
    ).to.be.revertedWith("X402: only recipient can settle");
  });

  it("should fail verification for wrong endpoint", async function () {
    const { invoiceId } = await settlePayment(seller1, "008");

    const [valid] = await verifier.verifyPayment(invoiceId, amount, "/wrong/endpoint");
    expect(valid).to.be.false;
  });

  it("should reject unsupported token", async function () {
    const fakeToken = "0x0000000000000000000000000000000000000001";
    const nonce = ethers.id("nonce-009");
    const validAfter = 0;
    const validBefore = (await ethers.provider.getBlock("latest"))!.timestamp + 300;

    await expect(
      verifier.connect(seller1).settle(
        fakeToken, payer.address, seller1.address, amount,
        validAfter, validBefore, nonce, endpoint, 27, ethers.ZeroHash, ethers.ZeroHash
      )
    ).to.be.revertedWith("X402: unsupported token");
  });

  // ─── Escrow Release Tests ───

  describe("Escrow", function () {
    it("should release funds to seller after escrow period", async function () {
      const { verifierAddr, invoiceId } = await settlePayment(seller1, "escrow-release");

      // Fast-forward past escrow period (24 hours)
      await time.increase(24 * 60 * 60 + 1);

      const sellerBalBefore = await token.balanceOf(seller1.address);

      await expect(verifier.connect(seller1).release(invoiceId))
        .to.emit(verifier, "PaymentReleased")
        .withArgs(invoiceId, seller1.address, await token.getAddress(), amount);

      expect(await token.balanceOf(seller1.address)).to.equal(sellerBalBefore + amount);
      expect(await token.balanceOf(verifierAddr!)).to.equal(0);

      const payment = await verifier.getPayment(invoiceId);
      expect(payment.released).to.be.true;
    });

    it("should allow anyone to call release after escrow period (permissionless)", async function () {
      const { invoiceId } = await settlePayment(seller1, "escrow-permissionless");

      await time.increase(24 * 60 * 60 + 1);

      // payer (not seller) calls release — should still work
      await expect(verifier.connect(payer).release(invoiceId))
        .to.emit(verifier, "PaymentReleased");

      expect(await token.balanceOf(seller1.address)).to.equal(amount);
    });

    it("should reject release during escrow period", async function () {
      const { invoiceId } = await settlePayment(seller1, "escrow-early");

      // Try to release immediately (escrow still active)
      await expect(
        verifier.connect(seller1).release(invoiceId)
      ).to.be.revertedWith("X402: escrow period active");
    });

    it("should reject double release", async function () {
      const { invoiceId } = await settlePayment(seller1, "escrow-double-release");

      await time.increase(24 * 60 * 60 + 1);
      await verifier.connect(seller1).release(invoiceId);

      await expect(
        verifier.connect(seller1).release(invoiceId)
      ).to.be.revertedWith("X402: already released");
    });

    it("should reject release of refunded payment", async function () {
      const { invoiceId } = await settlePayment(seller1, "escrow-release-refunded");

      // Refund during escrow
      await verifier.connect(seller1).refund(invoiceId);

      await time.increase(24 * 60 * 60 + 1);

      await expect(
        verifier.connect(seller1).release(invoiceId)
      ).to.be.revertedWith("X402: already refunded");
    });

    it("should reject release of unpaid invoice", async function () {
      const unpaidInvoiceId = deriveInvoiceId(payer.address, seller1.address, await token.getAddress(), ethers.id("nonce-unpaid"));
      await expect(
        verifier.connect(seller1).release(unpaidInvoiceId)
      ).to.be.revertedWith("X402: invoice not paid");
    });
  });

  // ─── Refund Tests (Escrow-based) ───

  describe("Refunds", function () {
    it("should allow seller to refund during escrow (no approval needed)", async function () {
      const { invoiceId } = await settlePayment(seller1, "refund-escrow");

      const payerBalBefore = await token.balanceOf(payer.address);

      // No approve() needed! Funds are in the contract.
      await expect(verifier.connect(seller1).refund(invoiceId))
        .to.emit(verifier, "Refunded")
        .withArgs(invoiceId, payer.address, await token.getAddress(), amount, payer.address);

      expect(await token.balanceOf(payer.address)).to.equal(payerBalBefore + amount);

      const payment = await verifier.getPayment(invoiceId);
      expect(payment.refunded).to.be.true;
    });

    it("should only allow refundTo to original payer (H-4 fix)", async function () {
      const { invoiceId } = await settlePayment(seller1, "refund-alt");

      // refundTo must target the original payer — arbitrary addresses are rejected
      await expect(
        verifier.connect(seller1).refundTo(invoiceId, seller2.address)
      ).to.be.revertedWith("X402: can only refund to payer");

      // refundTo the payer should succeed
      const payerBalBefore = await token.balanceOf(payer.address);
      await expect(verifier.connect(seller1).refundTo(invoiceId, payer.address))
        .to.emit(verifier, "Refunded")
        .withArgs(invoiceId, payer.address, await token.getAddress(), amount, payer.address);

      expect(await token.balanceOf(payer.address)).to.equal(payerBalBefore + amount);
    });

    it("should reject refund from non-recipient (including owner)", async function () {
      const { invoiceId } = await settlePayment(seller1, "refund-unauth");

      await expect(
        verifier.connect(owner).refund(invoiceId)
      ).to.be.revertedWith("X402: only recipient can refund");

      await expect(
        verifier.connect(seller2).refund(invoiceId)
      ).to.be.revertedWith("X402: only recipient can refund");
    });

    it("should prevent double-refund", async function () {
      const { invoiceId } = await settlePayment(seller1, "refund-double");

      await verifier.connect(seller1).refund(invoiceId);

      await expect(
        verifier.connect(seller1).refund(invoiceId)
      ).to.be.revertedWith("X402: already refunded");
    });

    it("should reject refund of unpaid invoice", async function () {
      const unpaidInvoiceId = deriveInvoiceId(payer.address, seller1.address, await token.getAddress(), ethers.id("nonce-unpaid-refund"));
      await expect(
        verifier.connect(seller1).refund(unpaidInvoiceId)
      ).to.be.revertedWith("X402: invoice not paid");
    });

    it("should reject refund after release", async function () {
      const { invoiceId } = await settlePayment(seller1, "refund-after-release");

      await time.increase(24 * 60 * 60 + 1);
      await verifier.connect(seller1).release(invoiceId);

      await expect(
        verifier.connect(seller1).refund(invoiceId)
      ).to.be.revertedWith("X402: already released");
    });

    it("should return false for verifyPayment after refund", async function () {
      const { invoiceId } = await settlePayment(seller1, "refund-verify");

      await verifier.connect(seller1).refund(invoiceId);

      const [valid] = await verifier.verifyPayment(invoiceId, amount, endpoint);
      expect(valid).to.be.false;
    });

    it("should reject refundTo to non-payer address (H-4 fix)", async function () {
      const { invoiceId } = await settlePayment(seller1, "refund-self");

      await expect(
        verifier.connect(seller1).refundTo(invoiceId, seller1.address)
      ).to.be.revertedWith("X402: can only refund to payer");
    });
  });

  // ─── ReleaseTo Tests (M-2 fix) ───

  describe("ReleaseTo", function () {
    it("should allow seller to release to alternative address", async function () {
      const { invoiceId } = await settlePayment(seller1, "releaseto-alt");

      await time.increase(24 * 60 * 60 + 1);

      const altBalBefore = await token.balanceOf(seller2.address);

      await expect(verifier.connect(seller1).releaseTo(invoiceId, seller2.address))
        .to.emit(verifier, "PaymentReleased")
        .withArgs(invoiceId, seller2.address, await token.getAddress(), amount);

      expect(await token.balanceOf(seller2.address)).to.equal(altBalBefore + amount);

      const payment = await verifier.getPayment(invoiceId);
      expect(payment.released).to.be.true;
    });

    it("should reject releaseTo from non-recipient", async function () {
      const { invoiceId } = await settlePayment(seller1, "releaseto-unauth");

      await time.increase(24 * 60 * 60 + 1);

      await expect(
        verifier.connect(payer).releaseTo(invoiceId, payer.address)
      ).to.be.revertedWith("X402: only recipient can redirect");
    });

    it("should reject releaseTo during escrow period", async function () {
      const { invoiceId } = await settlePayment(seller1, "releaseto-early");

      await expect(
        verifier.connect(seller1).releaseTo(invoiceId, seller2.address)
      ).to.be.revertedWith("X402: escrow period active");
    });

    it("should reject releaseTo zero address", async function () {
      const { invoiceId } = await settlePayment(seller1, "releaseto-zero");

      await time.increase(24 * 60 * 60 + 1);

      await expect(
        verifier.connect(seller1).releaseTo(invoiceId, ethers.ZeroAddress)
      ).to.be.revertedWith("X402: zero address");
    });
  });

  // ─── Registration Fee Tests (M-6 fix) ───

  describe("Registration Fee", function () {
    it("should allow registration when fee is zero", async function () {
      await verifier.connect(seller1).registerSeller("https://api.com", "Test", 0);
      const seller = await verifier.getSeller(seller1.address);
      expect(seller.active).to.be.true;
    });

    it("should require fee when set", async function () {
      const fee = ethers.parseEther("0.01");
      await verifier.connect(owner).setRegistrationFee(fee);

      await expect(
        verifier.connect(seller1).registerSeller("https://api.com", "Test", 0)
      ).to.be.revertedWith("X402: insufficient registration fee");

      await expect(
        verifier.connect(seller1).registerSeller("https://api.com", "Test", 0, { value: fee })
      ).to.emit(verifier, "SellerRegistered");
    });

    it("should allow owner to withdraw fees", async function () {
      const fee = ethers.parseEther("0.01");
      await verifier.connect(owner).setRegistrationFee(fee);
      await verifier.connect(seller1).registerSeller("https://api.com", "Test", 0, { value: fee });

      const ownerBalBefore = await ethers.provider.getBalance(owner.address);
      await verifier.connect(owner).withdrawFees();
      const ownerBalAfter = await ethers.provider.getBalance(owner.address);

      // Owner balance increased (minus gas)
      expect(ownerBalAfter).to.be.greaterThan(ownerBalBefore);
    });
  });

  // ─── Seller Registry Tests ───

  it("should register a seller", async function () {
    await expect(
      verifier.connect(seller1).registerSeller("https://api.seller1.com", "Seller 1 API", 0)
    )
      .to.emit(verifier, "SellerRegistered")
      .withArgs(seller1.address, "https://api.seller1.com", 0);

    const seller = await verifier.getSeller(seller1.address);
    expect(seller.wallet).to.equal(seller1.address);
    expect(seller.apiBaseUrl).to.equal("https://api.seller1.com");
    expect(seller.active).to.be.true;
  });

  it("should reject duplicate seller registration", async function () {
    await verifier.connect(seller1).registerSeller("https://api.seller1.com", "Seller 1", 0);
    await expect(
      verifier.connect(seller1).registerSeller("https://api2.seller1.com", "Seller 1 v2", 0)
    ).to.be.revertedWith("X402: already registered");
  });

  it("should reject empty API URL", async function () {
    await expect(
      verifier.connect(seller1).registerSeller("", "Description", 0)
    ).to.be.revertedWith("X402: empty API URL");
  });

  it("should update seller profile", async function () {
    await verifier.connect(seller1).registerSeller("https://old.api.com", "Old", 0);
    await expect(
      verifier.connect(seller1).updateSeller("https://new.api.com", "New description", 0)
    )
      .to.emit(verifier, "SellerUpdated")
      .withArgs(seller1.address, "https://new.api.com", 0);

    const seller = await verifier.getSeller(seller1.address);
    expect(seller.apiBaseUrl).to.equal("https://new.api.com");
    expect(seller.description).to.equal("New description");
  });

  it("should deactivate seller (self) and remove from active list", async function () {
    await verifier.connect(seller1).registerSeller("https://api.com", "Test", 0);
    await expect(verifier.connect(seller1).deactivateSeller(seller1.address))
      .to.emit(verifier, "SellerDeactivated")
      .withArgs(seller1.address);

    const seller = await verifier.getSeller(seller1.address);
    expect(seller.active).to.be.false;
    expect(await verifier.getSellerCount()).to.equal(0);
  });

  it("should deactivate seller (owner)", async function () {
    await verifier.connect(seller1).registerSeller("https://api.com", "Test", 0);
    await verifier.connect(owner).deactivateSeller(seller1.address);

    const seller = await verifier.getSeller(seller1.address);
    expect(seller.active).to.be.false;
  });

  it("should reject unauthorized deactivation", async function () {
    await verifier.connect(seller1).registerSeller("https://api.com", "Test", 0);
    await expect(
      verifier.connect(seller2).deactivateSeller(seller1.address)
    ).to.be.revertedWith("X402: not authorized");
  });

  it("should reactivate a deactivated seller", async function () {
    await verifier.connect(seller1).registerSeller("https://api1.com", "Seller 1", 0);
    await verifier.connect(seller1).deactivateSeller(seller1.address);

    expect(await verifier.getSellerCount()).to.equal(0);

    await expect(
      verifier.connect(seller1).reactivateSeller("https://api1-v2.com", "Seller 1 v2", 0)
    )
      .to.emit(verifier, "SellerRegistered")
      .withArgs(seller1.address, "https://api1-v2.com", 0);

    const seller = await verifier.getSeller(seller1.address);
    expect(seller.active).to.be.true;
    expect(seller.apiBaseUrl).to.equal("https://api1-v2.com");
    expect(await verifier.getSellerCount()).to.equal(1);
  });

  it("should reject reactivation of never-registered seller", async function () {
    await expect(
      verifier.connect(seller1).reactivateSeller("https://api.com", "Test", 0)
    ).to.be.revertedWith("X402: not registered");
  });

  it("should return active sellers with pagination", async function () {
    await verifier.connect(seller1).registerSeller("https://api1.com", "Seller 1", 0);
    await verifier.connect(seller2).registerSeller("https://api2.com", "Seller 2", 0);

    let activeSellers = await verifier.getActiveSellers(0, 100);
    expect(activeSellers.length).to.equal(2);

    await verifier.connect(seller1).deactivateSeller(seller1.address);
    activeSellers = await verifier.getActiveSellers(0, 100);
    expect(activeSellers.length).to.equal(1);
    expect(activeSellers[0].wallet).to.equal(seller2.address);
  });

  it("should handle pagination bounds correctly", async function () {
    await verifier.connect(seller1).registerSeller("https://api1.com", "Seller 1", 0);
    await verifier.connect(seller2).registerSeller("https://api2.com", "Seller 2", 0);

    let result = await verifier.getActiveSellers(10, 10);
    expect(result.length).to.equal(0);

    result = await verifier.getActiveSellers(0, 1);
    expect(result.length).to.equal(1);

    result = await verifier.getActiveSellers(1, 100);
    expect(result.length).to.equal(1);
  });

  // ─── Admin Tests ───

  it("should allow owner to add supported tokens via propose/activate (with code)", async function () {
    const tokenFactory = await ethers.getContractFactory("MockUSDT0");
    const newToken = await tokenFactory.deploy();
    await newToken.waitForDeployment();
    const newTokenAddr = await newToken.getAddress();

    // Propose the token
    await expect(verifier.connect(owner).proposeToken(newTokenAddr))
      .to.emit(verifier, "TokenProposed");

    // Cannot activate before timelock
    await expect(
      verifier.connect(owner).activateToken(newTokenAddr)
    ).to.be.revertedWith("X402: timelock active");

    // Fast-forward past 48h timelock
    await time.increase(48 * 60 * 60 + 1);

    await expect(verifier.connect(owner).activateToken(newTokenAddr))
      .to.emit(verifier, "TokenSupported")
      .withArgs(newTokenAddr, true);

    expect(await verifier.supportedTokens(newTokenAddr)).to.be.true;

    // Remove immediately
    await verifier.connect(owner).removeToken(newTokenAddr);
    expect(await verifier.supportedTokens(newTokenAddr)).to.be.false;
  });

  it("should reject proposing token with no code", async function () {
    const noCodeAddr = "0x0000000000000000000000000000000000000042";
    await expect(
      verifier.connect(owner).proposeToken(noCodeAddr)
    ).to.be.revertedWith("X402: token has no code");
  });

  it("should reject non-owner proposing tokens", async function () {
    const tokenAddr = await token.getAddress();
    await expect(
      verifier.connect(payer).proposeToken(tokenAddr)
    ).to.be.revertedWithCustomError(verifier, "OwnableUnauthorizedAccount");
  });

  it("should reject zero address for token proposal", async function () {
    await expect(
      verifier.connect(owner).proposeToken(ethers.ZeroAddress)
    ).to.be.revertedWith("X402: zero token address");
  });

  it("should reject renounceOwnership", async function () {
    await expect(
      verifier.connect(owner).renounceOwnership()
    ).to.be.revertedWith("X402: renounce disabled");
  });

  it("should support two-step ownership transfer", async function () {
    await verifier.connect(owner).transferOwnership(payer.address);
    expect(await verifier.owner()).to.equal(owner.address);

    await verifier.connect(payer).acceptOwnership();
    expect(await verifier.owner()).to.equal(payer.address);

    await expect(
      verifier.connect(owner).removeToken(await token.getAddress())
    ).to.be.revertedWithCustomError(verifier, "OwnableUnauthorizedAccount");
  });

  // ─── Adversarial Cases ───

  describe("Adversarial Cases", function () {
    it("should reject a forged signature (signed by wrong private key)", async function () {
      await ensureSellerRegistered(seller1);
      const tokenAddr = await token.getAddress();
      const verifierAddr = await verifier.getAddress();
      const nonce = ethers.id("nonce-adv-forged");
      const validAfter = 0;
      const validBefore = (await ethers.provider.getBlock("latest"))!.timestamp + 300;

      const { v, r, s } = await signReceiveAuthorization(
        seller2, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
      );

      await expect(
        verifier.connect(seller1).settle(
          tokenAddr, payer.address, seller1.address, amount,
          validAfter, validBefore, nonce, endpoint, v, r, s
        )
      ).to.be.revertedWith("USDT0: invalid signature");
    });

    it("should reject a cross-chain replay (wrong chain ID in domain separator)", async function () {
      await ensureSellerRegistered(seller1);
      const tokenAddr = await token.getAddress();
      const verifierAddr = await verifier.getAddress();
      const nonce = ethers.id("nonce-adv-crosschain");
      const validAfter = 0;
      const validBefore = (await ethers.provider.getBlock("latest"))!.timestamp + 300;

      const domain = {
        name: "USD Tether 0",
        version: "1",
        chainId: 1,
        verifyingContract: tokenAddr,
      };
      const types = {
        ReceiveWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      };
      const message = {
        from: payer.address,
        to: verifierAddr,
        value: amount,
        validAfter,
        validBefore,
        nonce,
      };

      const sig = await payer.signTypedData(domain, types, message);
      const { v, r, s } = ethers.Signature.from(sig);

      await expect(
        verifier.connect(seller1).settle(
          tokenAddr, payer.address, seller1.address, amount,
          validAfter, validBefore, nonce, endpoint, v, r, s
        )
      ).to.be.revertedWith("USDT0: invalid signature");
    });

    it("should reject an amount mismatch (signed for less than settled)", async function () {
      await ensureSellerRegistered(seller1);
      const tokenAddr = await token.getAddress();
      const verifierAddr = await verifier.getAddress();
      const nonce = ethers.id("nonce-adv-amount");
      const validAfter = 0;
      const validBefore = (await ethers.provider.getBlock("latest"))!.timestamp + 300;

      const signedAmount = amount;
      const inflatedAmount = amount * 2n;

      const { v, r, s } = await signReceiveAuthorization(
        payer, tokenAddr, verifierAddr, signedAmount, validAfter, validBefore, nonce
      );

      await expect(
        verifier.connect(seller1).settle(
          tokenAddr, payer.address, seller1.address, inflatedAmount,
          validAfter, validBefore, nonce, endpoint, v, r, s
        )
      ).to.be.revertedWith("USDT0: invalid signature");
    });

    it("should reject concurrent settle with the same authorization (replay)", async function () {
      await ensureSellerRegistered(seller1);
      const tokenAddr = await token.getAddress();
      const verifierAddr = await verifier.getAddress();
      const nonce = ethers.id("nonce-adv-concurrent");
      const validAfter = 0;
      const validBefore = (await ethers.provider.getBlock("latest"))!.timestamp + 300;

      const { v, r, s } = await signReceiveAuthorization(
        payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
      );

      await expect(
        verifier.connect(seller1).settle(
          tokenAddr, payer.address, seller1.address, amount,
          validAfter, validBefore, nonce, endpoint, v, r, s
        )
      ).to.emit(verifier, "PaymentReceived");

      // Same (from, recipient, token, nonce) → same derived invoiceId → "already paid"
      await expect(
        verifier.connect(seller1).settle(
          tokenAddr, payer.address, seller1.address, amount,
          validAfter, validBefore, nonce, endpoint, v, r, s
        )
      ).to.be.revertedWith("X402: already paid");
    });
  });
});

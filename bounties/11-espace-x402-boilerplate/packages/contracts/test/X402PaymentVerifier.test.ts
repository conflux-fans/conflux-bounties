import { expect } from "chai";
import { ethers } from "hardhat";
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
  const invoiceId = ethers.id("invoice-001");

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

  it("should settle a valid ERC-3009 payment to any recipient", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-001");
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    // Buyer signs authorization with to = verifier address
    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    const balanceBefore = await token.balanceOf(seller1.address);

    // Seller1 calls settle (msg.sender == recipient required)
    await expect(
      verifier.connect(seller1).settle(
        invoiceId, tokenAddr, payer.address, seller1.address, amount,
        validAfter, validBefore, nonce, endpoint, v, r, s
      )
    )
      .to.emit(verifier, "PaymentReceived")
      .withArgs(invoiceId, payer.address, seller1.address, tokenAddr, amount, endpoint, nonce);

    const balanceAfter = await token.balanceOf(seller1.address);
    expect(balanceAfter - balanceBefore).to.equal(amount);
  });

  it("should settle payments to different sellers (multi-tenant)", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    // Payment to seller1
    const nonce1 = ethers.id("nonce-mt-001");
    const sig1 = await signReceiveAuthorization(payer, tokenAddr, verifierAddr, amount, 0, validBefore, nonce1);
    await verifier.connect(seller1).settle(
      invoiceId, tokenAddr, payer.address, seller1.address, amount,
      0, validBefore, nonce1, endpoint, sig1.v, sig1.r, sig1.s
    );

    // Payment to seller2
    const invoice2 = ethers.id("invoice-002");
    const nonce2 = ethers.id("nonce-mt-002");
    const sig2 = await signReceiveAuthorization(payer, tokenAddr, verifierAddr, amount, 0, validBefore, nonce2);
    await verifier.connect(seller2).settle(
      invoice2, tokenAddr, payer.address, seller2.address, amount,
      0, validBefore, nonce2, "/compute/simulate", sig2.v, sig2.r, sig2.s
    );

    // Verify both payments
    expect(await token.balanceOf(seller1.address)).to.equal(amount);
    expect(await token.balanceOf(seller2.address)).to.equal(amount);
  });

  it("should verify a paid invoice", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-002");
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    await verifier.connect(seller1).settle(
      invoiceId, tokenAddr, payer.address, seller1.address, amount,
      validAfter, validBefore, nonce, endpoint, v, r, s
    );

    const [valid, payerAddr] = await verifier.verifyPayment(invoiceId, amount, endpoint);
    expect(valid).to.be.true;
    expect(payerAddr).to.equal(payer.address);
  });

  it("should reject expired authorization", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-003");
    const validAfter = 0;
    const validBefore = 1; // already expired (timestamp 1)

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    // Verifier now checks expiry itself before calling the token
    await expect(
      verifier.connect(seller1).settle(
        invoiceId, tokenAddr, payer.address, seller1.address, amount,
        validAfter, validBefore, nonce, endpoint, v, r, s
      )
    ).to.be.revertedWith("X402: authorization expired");
  });

  it("should reject duplicate nonce", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-004");
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    await verifier.connect(seller1).settle(
      invoiceId, tokenAddr, payer.address, seller1.address, amount,
      validAfter, validBefore, nonce, endpoint, v, r, s
    );

    const invoiceId2 = ethers.id("invoice-002");
    const sig2 = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    await expect(
      verifier.connect(seller1).settle(
        invoiceId2, tokenAddr, payer.address, seller1.address, amount,
        validAfter, validBefore, nonce, endpoint, sig2.v, sig2.r, sig2.s
      )
    ).to.be.revertedWith("X402: nonce already used");
  });

  it("should reject duplicate invoice payment", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce1 = ethers.id("nonce-005");
    const nonce2 = ethers.id("nonce-006");
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    const sig1 = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce1
    );
    await verifier.connect(seller1).settle(
      invoiceId, tokenAddr, payer.address, seller1.address, amount,
      validAfter, validBefore, nonce1, endpoint, sig1.v, sig1.r, sig1.s
    );

    const sig2 = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce2
    );
    await expect(
      verifier.connect(seller1).settle(
        invoiceId, tokenAddr, payer.address, seller1.address, amount,
        validAfter, validBefore, nonce2, endpoint, sig2.v, sig2.r, sig2.s
      )
    ).to.be.revertedWith("X402: already paid");
  });

  it("should reject zero payment", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-007");
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, 0n, validAfter, validBefore, nonce
    );

    await expect(
      verifier.connect(seller1).settle(
        invoiceId, tokenAddr, payer.address, seller1.address, 0n,
        validAfter, validBefore, nonce, endpoint, v, r, s
      )
    ).to.be.revertedWith("X402: zero payment");
  });

  it("should reject zero recipient", async function () {
    const tokenAddr = await token.getAddress();
    const nonce = ethers.id("nonce-zero-recip");
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    await expect(
      verifier.settle(
        invoiceId, tokenAddr, payer.address, ethers.ZeroAddress, amount,
        validAfter, validBefore, nonce, endpoint, 27, ethers.ZeroHash, ethers.ZeroHash
      )
    ).to.be.revertedWith("X402: zero recipient");
  });

  it("should reject self-payment", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-self-pay");
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    const { v, r, s } = await signReceiveAuthorization(
      seller1, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    await expect(
      verifier.connect(seller1).settle(
        invoiceId, tokenAddr, seller1.address, seller1.address, amount,
        validAfter, validBefore, nonce, endpoint, v, r, s
      )
    ).to.be.revertedWith("X402: self-payment");
  });

  it("should reject settle from non-recipient", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-non-recip");
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    // seller2 tries to settle a payment intended for seller1
    await expect(
      verifier.connect(seller2).settle(
        invoiceId, tokenAddr, payer.address, seller1.address, amount,
        validAfter, validBefore, nonce, endpoint, v, r, s
      )
    ).to.be.revertedWith("X402: only recipient can settle");
  });

  it("should fail verification for wrong endpoint", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-008");
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    await verifier.connect(seller1).settle(
      invoiceId, tokenAddr, payer.address, seller1.address, amount,
      validAfter, validBefore, nonce, endpoint, v, r, s
    );

    const [valid] = await verifier.verifyPayment(invoiceId, amount, "/wrong/endpoint");
    expect(valid).to.be.false;
  });

  it("should reject unsupported token", async function () {
    const fakeToken = "0x0000000000000000000000000000000000000001";
    const nonce = ethers.id("nonce-009");
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    await expect(
      verifier.connect(seller1).settle(
        invoiceId, fakeToken, payer.address, seller1.address, amount,
        validAfter, validBefore, nonce, endpoint, 27, ethers.ZeroHash, ethers.ZeroHash
      )
    ).to.be.revertedWith("X402: unsupported token");
  });

  // ─── Seller Registry Tests ───

  it("should register a seller", async function () {
    await expect(
      verifier.connect(seller1).registerSeller("https://api.seller1.com", "Seller 1 API")
    )
      .to.emit(verifier, "SellerRegistered")
      .withArgs(seller1.address, "https://api.seller1.com");

    const seller = await verifier.getSeller(seller1.address);
    expect(seller.wallet).to.equal(seller1.address);
    expect(seller.apiBaseUrl).to.equal("https://api.seller1.com");
    expect(seller.active).to.be.true;
  });

  it("should reject duplicate seller registration", async function () {
    await verifier.connect(seller1).registerSeller("https://api.seller1.com", "Seller 1");
    await expect(
      verifier.connect(seller1).registerSeller("https://api2.seller1.com", "Seller 1 v2")
    ).to.be.revertedWith("X402: already registered");
  });

  it("should reject empty API URL", async function () {
    await expect(
      verifier.connect(seller1).registerSeller("", "Description")
    ).to.be.revertedWith("X402: empty API URL");
  });

  it("should update seller profile", async function () {
    await verifier.connect(seller1).registerSeller("https://old.api.com", "Old");
    await expect(
      verifier.connect(seller1).updateSeller("https://new.api.com", "New description")
    )
      .to.emit(verifier, "SellerUpdated")
      .withArgs(seller1.address, "https://new.api.com");

    const seller = await verifier.getSeller(seller1.address);
    expect(seller.apiBaseUrl).to.equal("https://new.api.com");
    expect(seller.description).to.equal("New description");
  });

  it("should deactivate seller (self) and remove from active list", async function () {
    await verifier.connect(seller1).registerSeller("https://api.com", "Test");
    await expect(verifier.connect(seller1).deactivateSeller(seller1.address))
      .to.emit(verifier, "SellerDeactivated")
      .withArgs(seller1.address);

    const seller = await verifier.getSeller(seller1.address);
    expect(seller.active).to.be.false;

    // Seller is removed from sellerList
    expect(await verifier.getSellerCount()).to.equal(0);
  });

  it("should deactivate seller (owner)", async function () {
    await verifier.connect(seller1).registerSeller("https://api.com", "Test");
    await verifier.connect(owner).deactivateSeller(seller1.address);

    const seller = await verifier.getSeller(seller1.address);
    expect(seller.active).to.be.false;
  });

  it("should reject unauthorized deactivation", async function () {
    await verifier.connect(seller1).registerSeller("https://api.com", "Test");
    await expect(
      verifier.connect(seller2).deactivateSeller(seller1.address)
    ).to.be.revertedWith("X402: not authorized");
  });

  it("should reactivate a deactivated seller", async function () {
    await verifier.connect(seller1).registerSeller("https://api1.com", "Seller 1");
    await verifier.connect(seller1).deactivateSeller(seller1.address);

    expect(await verifier.getSellerCount()).to.equal(0);

    await expect(
      verifier.connect(seller1).reactivateSeller("https://api1-v2.com", "Seller 1 v2")
    )
      .to.emit(verifier, "SellerRegistered")
      .withArgs(seller1.address, "https://api1-v2.com");

    const seller = await verifier.getSeller(seller1.address);
    expect(seller.active).to.be.true;
    expect(seller.apiBaseUrl).to.equal("https://api1-v2.com");
    expect(await verifier.getSellerCount()).to.equal(1);
  });

  it("should reject reactivation of never-registered seller", async function () {
    await expect(
      verifier.connect(seller1).reactivateSeller("https://api.com", "Test")
    ).to.be.revertedWith("X402: not registered");
  });

  it("should return active sellers with pagination", async function () {
    await verifier.connect(seller1).registerSeller("https://api1.com", "Seller 1");
    await verifier.connect(seller2).registerSeller("https://api2.com", "Seller 2");

    let activeSellers = await verifier.getActiveSellers(0, 100);
    expect(activeSellers.length).to.equal(2);

    // Deactivate seller1 — removed from list via swap-and-pop
    await verifier.connect(seller1).deactivateSeller(seller1.address);
    activeSellers = await verifier.getActiveSellers(0, 100);
    expect(activeSellers.length).to.equal(1);
    expect(activeSellers[0].wallet).to.equal(seller2.address);
  });

  it("should handle pagination bounds correctly", async function () {
    await verifier.connect(seller1).registerSeller("https://api1.com", "Seller 1");
    await verifier.connect(seller2).registerSeller("https://api2.com", "Seller 2");

    // Offset beyond length returns empty
    let result = await verifier.getActiveSellers(10, 10);
    expect(result.length).to.equal(0);

    // Limit exceeding length is clamped
    result = await verifier.getActiveSellers(0, 1);
    expect(result.length).to.equal(1);

    result = await verifier.getActiveSellers(1, 100);
    expect(result.length).to.equal(1);
  });

  // ─── Refund Tests ───

  it("should allow recipient (seller) to refund", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-refund-001");
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    await verifier.connect(seller1).settle(
      invoiceId, tokenAddr, payer.address, seller1.address, amount,
      validAfter, validBefore, nonce, endpoint, v, r, s
    );

    // Seller1 approves verifier to pull tokens for refund
    await token.connect(seller1).approve(verifierAddr, amount);

    const payerBalanceBefore = await token.balanceOf(payer.address);

    await expect(verifier.connect(seller1).refund(invoiceId))
      .to.emit(verifier, "Refunded")
      .withArgs(invoiceId, payer.address, tokenAddr, amount);

    const payerBalanceAfter = await token.balanceOf(payer.address);
    expect(payerBalanceAfter - payerBalanceBefore).to.equal(amount);
  });

  it("should allow refund to alternative address via refundTo", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-refund-alt");
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    await verifier.connect(seller1).settle(
      invoiceId, tokenAddr, payer.address, seller1.address, amount,
      validAfter, validBefore, nonce, endpoint, v, r, s
    );

    await token.connect(seller1).approve(verifierAddr, amount);

    // Refund to seller2's address instead of payer (e.g., if payer is blocklisted)
    const altBalanceBefore = await token.balanceOf(seller2.address);

    await expect(verifier.connect(seller1).refundTo(invoiceId, seller2.address))
      .to.emit(verifier, "Refunded")
      .withArgs(invoiceId, seller2.address, tokenAddr, amount);

    const altBalanceAfter = await token.balanceOf(seller2.address);
    expect(altBalanceAfter - altBalanceBefore).to.equal(amount);
  });

  it("should reject refund from non-recipient (including owner)", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-refund-unauth");
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    await verifier.connect(seller1).settle(
      invoiceId, tokenAddr, payer.address, seller1.address, amount,
      validAfter, validBefore, nonce, endpoint, v, r, s
    );

    // Owner cannot refund (removed owner override)
    await expect(
      verifier.connect(owner).refund(invoiceId)
    ).to.be.revertedWith("X402: only recipient can refund");

    // Random party cannot refund
    await expect(
      verifier.connect(seller2).refund(invoiceId)
    ).to.be.revertedWith("X402: only recipient can refund");
  });

  it("should prevent double-refund", async function () {
    const tokenAddr = await token.getAddress();
    const verifierAddr = await verifier.getAddress();
    const nonce = ethers.id("nonce-refund-double");
    const validAfter = 0;
    const validBefore = Math.floor(Date.now() / 1000) + 300;

    const { v, r, s } = await signReceiveAuthorization(
      payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
    );

    await verifier.connect(seller1).settle(
      invoiceId, tokenAddr, payer.address, seller1.address, amount,
      validAfter, validBefore, nonce, endpoint, v, r, s
    );

    await token.connect(seller1).approve(verifierAddr, amount * 2n);
    await verifier.connect(seller1).refund(invoiceId);

    await expect(
      verifier.connect(seller1).refund(invoiceId)
    ).to.be.revertedWith("X402: already refunded");
  });

  it("should reject refund of unpaid invoice", async function () {
    await expect(
      verifier.connect(seller1).refund(invoiceId)
    ).to.be.revertedWith("X402: invoice not paid");
  });

  // ─── Admin Tests ───

  it("should allow owner to add supported tokens (with code)", async function () {
    // Deploy another token to get a valid address with code
    const tokenFactory = await ethers.getContractFactory("MockUSDT0");
    const newToken = await tokenFactory.deploy();
    await newToken.waitForDeployment();
    const newTokenAddr = await newToken.getAddress();

    await expect(verifier.connect(owner).setSupportedToken(newTokenAddr, true))
      .to.emit(verifier, "TokenSupported")
      .withArgs(newTokenAddr, true);

    expect(await verifier.supportedTokens(newTokenAddr)).to.be.true;

    // Can remove (no code check on removal)
    await verifier.connect(owner).setSupportedToken(newTokenAddr, false);
    expect(await verifier.supportedTokens(newTokenAddr)).to.be.false;
  });

  it("should reject adding token with no code", async function () {
    const noCodeAddr = "0x0000000000000000000000000000000000000042";
    await expect(
      verifier.connect(owner).setSupportedToken(noCodeAddr, true)
    ).to.be.revertedWith("X402: token has no code");
  });

  it("should reject non-owner setting supported tokens", async function () {
    const tokenAddr = await token.getAddress();
    await expect(
      verifier.connect(payer).setSupportedToken(tokenAddr, true)
    ).to.be.revertedWithCustomError(verifier, "OwnableUnauthorizedAccount");
  });

  it("should reject zero address for token support", async function () {
    await expect(
      verifier.connect(owner).setSupportedToken(ethers.ZeroAddress, true)
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

    const tokenAddr = await token.getAddress();
    await expect(
      verifier.connect(owner).setSupportedToken(tokenAddr, true)
    ).to.be.revertedWithCustomError(verifier, "OwnableUnauthorizedAccount");
  });

  // ─── Adversarial Cases ───

  describe("Adversarial Cases", function () {
    it("should reject a forged signature (signed by wrong private key)", async function () {
      const tokenAddr = await token.getAddress();
      const verifierAddr = await verifier.getAddress();
      const nonce = ethers.id("nonce-adv-forged");
      const validAfter = 0;
      const validBefore = Math.floor(Date.now() / 1000) + 300;

      // A random signer (seller2) signs the authorization, but we claim the `from` is payer
      const { v, r, s } = await signReceiveAuthorization(
        seller2, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
      );

      // Settle claims from=payer but signature was made by seller2
      await expect(
        verifier.connect(seller1).settle(
          invoiceId, tokenAddr, payer.address, seller1.address, amount,
          validAfter, validBefore, nonce, endpoint, v, r, s
        )
      ).to.be.revertedWith("USDT0: invalid signature");
    });

    it("should reject a cross-chain replay (wrong chain ID in domain separator)", async function () {
      const tokenAddr = await token.getAddress();
      const verifierAddr = await verifier.getAddress();
      const nonce = ethers.id("nonce-adv-crosschain");
      const validAfter = 0;
      const validBefore = Math.floor(Date.now() / 1000) + 300;

      // Sign with chain ID 1 (mainnet) instead of the test chain's 31337
      const domain = {
        name: "USD Tether 0",
        version: "1",
        chainId: 1, // mainnet chain ID — wrong for Hardhat's 31337
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
          invoiceId, tokenAddr, payer.address, seller1.address, amount,
          validAfter, validBefore, nonce, endpoint, v, r, s
        )
      ).to.be.revertedWith("USDT0: invalid signature");
    });

    it("should reject an amount mismatch (signed for less than settled)", async function () {
      const tokenAddr = await token.getAddress();
      const verifierAddr = await verifier.getAddress();
      const nonce = ethers.id("nonce-adv-amount");
      const validAfter = 0;
      const validBefore = Math.floor(Date.now() / 1000) + 300;

      const signedAmount = amount; // 100_000
      const inflatedAmount = amount * 2n; // 200_000

      // Buyer signs authorization for the original (smaller) amount
      const { v, r, s } = await signReceiveAuthorization(
        payer, tokenAddr, verifierAddr, signedAmount, validAfter, validBefore, nonce
      );

      // Seller tries to settle with a higher amount than what was signed
      await expect(
        verifier.connect(seller1).settle(
          invoiceId, tokenAddr, payer.address, seller1.address, inflatedAmount,
          validAfter, validBefore, nonce, endpoint, v, r, s
        )
      ).to.be.revertedWith("USDT0: invalid signature");
    });

    it("should reject concurrent settle with the same authorization (replay)", async function () {
      const tokenAddr = await token.getAddress();
      const verifierAddr = await verifier.getAddress();
      const nonce = ethers.id("nonce-adv-concurrent");
      const validAfter = 0;
      const validBefore = Math.floor(Date.now() / 1000) + 300;

      const { v, r, s } = await signReceiveAuthorization(
        payer, tokenAddr, verifierAddr, amount, validAfter, validBefore, nonce
      );

      // First settle succeeds
      await expect(
        verifier.connect(seller1).settle(
          invoiceId, tokenAddr, payer.address, seller1.address, amount,
          validAfter, validBefore, nonce, endpoint, v, r, s
        )
      ).to.emit(verifier, "PaymentReceived");

      // Second settle with same nonce but different invoice must revert
      const invoiceId2 = ethers.id("invoice-adv-concurrent-2");
      await expect(
        verifier.connect(seller1).settle(
          invoiceId2, tokenAddr, payer.address, seller1.address, amount,
          validAfter, validBefore, nonce, endpoint, v, r, s
        )
      ).to.be.revertedWith("X402: nonce already used");
    });
  });
});

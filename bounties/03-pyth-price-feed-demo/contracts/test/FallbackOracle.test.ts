import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMockPyth, setupMockPrices, PRICE_IDS } from "./setup";

describe("FallbackOracle", function () {
  let fallbackOracle: any;
  let mockPyth: any;
  let owner: any;
  let updater: any;
  let other: any;

  beforeEach(async function () {
    [owner, updater, other] = await ethers.getSigners();
    mockPyth = await deployMockPyth();
    const mockPythAddress = await mockPyth.getAddress();
    await setupMockPrices(mockPyth);

    const FallbackOracle = await ethers.getContractFactory("FallbackOracle");
    fallbackOracle = await FallbackOracle.deploy(mockPythAddress);
    await fallbackOracle.waitForDeployment();

    await fallbackOracle.addTrustedUpdater(updater.address);
  });

  it("Should return primary oracle price if not in fallback mode", async function () {
    const price = await fallbackOracle.getPrice(PRICE_IDS.BTC);
    expect(price).to.equal(BigInt(5000000000000));
  });

  it("Should enter and exit fallback mode", async function () {
    await expect(fallbackOracle.enterFallbackMode(PRICE_IDS.BTC))
      .to.emit(fallbackOracle, "FallbackModeEntered");
    expect(await fallbackOracle.isInFallbackMode(PRICE_IDS.BTC)).to.be.true;

    await expect(fallbackOracle.exitFallbackMode(PRICE_IDS.BTC))
      .to.emit(fallbackOracle, "FallbackModeExited");
    expect(await fallbackOracle.isInFallbackMode(PRICE_IDS.BTC)).to.be.false;
  });

  it("Should update fallback price by trusted updater when in fallback mode", async function () {
    await fallbackOracle.enterFallbackMode(PRICE_IDS.BTC);

    await expect(
      fallbackOracle.connect(updater).updateFallbackPrice(PRICE_IDS.BTC, BigInt(5100000000000))
    ).to.emit(fallbackOracle, "FallbackPriceUpdated");

    const price = await fallbackOracle.getPrice(PRICE_IDS.BTC);
    expect(price).to.equal(BigInt(5100000000000));
  });

  it("Should revert updating fallback price when not in fallback mode", async function () {
    await expect(
      fallbackOracle.connect(updater).updateFallbackPrice(PRICE_IDS.BTC, BigInt(5100000000000))
    ).to.be.revertedWith("Not in fallback mode");
  });

  it("Should revert getting fallback price if not set", async function () {
    await fallbackOracle.enterFallbackMode(PRICE_IDS.BTC);
    await expect(fallbackOracle.getPrice(PRICE_IDS.BTC)).to.be.revertedWith("Fallback price not set");
  });

  it("Should revert on untrusted updater", async function () {
    await fallbackOracle.enterFallbackMode(PRICE_IDS.BTC);
    await expect(
      fallbackOracle.connect(other).updateFallbackPrice(PRICE_IDS.BTC, BigInt(5100000000000))
    ).to.be.revertedWith("Not a trusted updater");
  });

  it("Should remove trusted updater", async function () {
    await fallbackOracle.removeTrustedUpdater(updater.address);

    await fallbackOracle.enterFallbackMode(PRICE_IDS.BTC);
    await expect(
      fallbackOracle.connect(updater).updateFallbackPrice(PRICE_IDS.BTC, BigInt(5100000000000))
    ).to.be.revertedWith("Not a trusted updater");
  });

  it("Should revert on invalid updater address", async function () {
    await expect(
      fallbackOracle.addTrustedUpdater(ethers.ZeroAddress)
    ).to.be.revertedWith("Invalid updater");
  });

  it("Should revert adding/removing trusted updater by non-owner", async function () {
    await expect(fallbackOracle.connect(other).addTrustedUpdater(other.address))
      .to.be.reverted;
    await expect(fallbackOracle.connect(other).removeTrustedUpdater(updater.address))
      .to.be.reverted;
  });

  it("Fallback mode events fire again when re-entering/exiting", async function () {
    await fallbackOracle.enterFallbackMode(PRICE_IDS.BTC);
    await expect(fallbackOracle.enterFallbackMode(PRICE_IDS.BTC))
      .to.emit(fallbackOracle, "FallbackModeEntered");
    
    await fallbackOracle.exitFallbackMode(PRICE_IDS.BTC);
    await expect(fallbackOracle.exitFallbackMode(PRICE_IDS.BTC))
      .to.emit(fallbackOracle, "FallbackModeExited");
  });

  it("Trusted updater events fire", async function () {
    const newUpdater = other.address;
    await expect(fallbackOracle.addTrustedUpdater(newUpdater))
      .to.emit(fallbackOracle, "TrustedUpdaterAdded").withArgs(newUpdater);

    await expect(fallbackOracle.removeTrustedUpdater(newUpdater))
      .to.emit(fallbackOracle, "TrustedUpdaterRemoved").withArgs(newUpdater);
  });
});
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ContractMetadataRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ContractMetadataRegistry", function () {
  const CID = "QmTestCid1234567890abcdef";
  const CID2 = "QmUpdatedCid9876543210fedcba";
  const HASH = ethers.keccak256(ethers.toUtf8Bytes("metadata-v1"));
  const HASH2 = ethers.keccak256(ethers.toUtf8Bytes("metadata-v2"));
  const MODERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MODERATOR_ROLE"));

  async function deployFixture() {
    const [owner, moderator, submitter, delegate, other] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("ContractMetadataRegistry");
    const proxy = (await upgrades.deployProxy(Factory, [owner.address, moderator.address], {
      initializer: "initialize",
      kind: "uups",
    })) as unknown as ContractMetadataRegistry;

    await proxy.waitForDeployment();

    // Use a random address as the "target contract" being registered
    const targetContract = ethers.Wallet.createRandom().address;

    return { proxy, owner, moderator, submitter, delegate, other, targetContract };
  }

  /** Deployment & Initialization */

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      const { proxy, owner } = await loadFixture(deployFixture);
      expect(await proxy.owner()).to.equal(owner.address);
    });

    it("should grant MODERATOR_ROLE to the moderator", async function () {
      const { proxy, moderator } = await loadFixture(deployFixture);
      expect(await proxy.hasRole(MODERATOR_ROLE, moderator.address)).to.be.true;
    });

    it("should grant DEFAULT_ADMIN_ROLE to the owner", async function () {
      const { proxy, owner } = await loadFixture(deployFixture);
      const DEFAULT_ADMIN = ethers.ZeroHash;
      expect(await proxy.hasRole(DEFAULT_ADMIN, owner.address)).to.be.true;
    });

    it("should not allow re-initialization", async function () {
      const { proxy, owner, moderator } = await loadFixture(deployFixture);
      await expect(proxy.initialize(owner.address, moderator.address)).to.be.reverted;
    });

    it("should revert initialize with zero owner", async function () {
      const Factory = await ethers.getContractFactory("ContractMetadataRegistry");
      await expect(
        upgrades.deployProxy(Factory, [ethers.ZeroAddress, ethers.Wallet.createRandom().address], {
          initializer: "initialize",
          kind: "uups",
        })
      ).to.be.revertedWith("ZeroOwner");
    });

    it("should revert initialize with zero moderator", async function () {
      const [signer] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("ContractMetadataRegistry");
      await expect(
        upgrades.deployProxy(Factory, [signer.address, ethers.ZeroAddress], {
          initializer: "initialize",
          kind: "uups",
        })
      ).to.be.revertedWith("ZeroModerator");
    });
  });

  /** Metadata Submission */

  describe("submitMetadata", function () {
    it("should allow first submission and set caller as owner", async function () {
      const { proxy, submitter, targetContract } = await loadFixture(deployFixture);

      await expect(proxy.connect(submitter).submitMetadata(targetContract, CID, HASH))
        .to.emit(proxy, "MetadataSubmitted")
        .withArgs(targetContract, submitter.address, CID, HASH, 1);

      const record = await proxy.getRecord(targetContract);
      expect(record.owner).to.equal(submitter.address);
      expect(record.metadataCid).to.equal(CID);
      expect(record.contentHash).to.equal(HASH);
      expect(record.version).to.equal(1);
      expect(record.status).to.equal(1); // Pending
    });

    it("should allow owner to update metadata (increments version)", async function () {
      const { proxy, submitter, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);
      await proxy.connect(submitter).submitMetadata(targetContract, CID2, HASH2);

      const record = await proxy.getRecord(targetContract);
      expect(record.metadataCid).to.equal(CID2);
      expect(record.contentHash).to.equal(HASH2);
      expect(record.version).to.equal(2);
      expect(record.status).to.equal(1); // Reset to Pending
    });

    it("should revert if non-owner/non-delegate tries to update", async function () {
      const { proxy, submitter, other, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);

      await expect(
        proxy.connect(other).submitMetadata(targetContract, CID2, HASH2)
      ).to.be.revertedWith("NotOwnerOrDelegate");
    });

    it("should revert with zero contract address", async function () {
      const { proxy, submitter } = await loadFixture(deployFixture);
      await expect(
        proxy.connect(submitter).submitMetadata(ethers.ZeroAddress, CID, HASH)
      ).to.be.revertedWith("ZeroAddress");
    });

    it("should revert with empty CID", async function () {
      const { proxy, submitter, targetContract } = await loadFixture(deployFixture);
      await expect(
        proxy.connect(submitter).submitMetadata(targetContract, "", HASH)
      ).to.be.revertedWith("EmptyCid");
    });

    it("should revert with zero content hash", async function () {
      const { proxy, submitter, targetContract } = await loadFixture(deployFixture);
      await expect(
        proxy.connect(submitter).submitMetadata(targetContract, CID, ethers.ZeroHash)
      ).to.be.revertedWith("EmptyHash");
    });

    it("should reset status to Pending on re-submission after approval", async function () {
      const { proxy, submitter, moderator, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);
      await proxy.connect(moderator).approve(targetContract);

      const approved = await proxy.getRecord(targetContract);
      expect(approved.status).to.equal(2); // Approved

      await proxy.connect(submitter).submitMetadata(targetContract, CID2, HASH2);
      const resubmitted = await proxy.getRecord(targetContract);
      expect(resubmitted.status).to.equal(1); // Pending
      expect(resubmitted.version).to.equal(2);
    });
  });

  /** Moderation */

  describe("approve", function () {
    it("should approve a pending submission", async function () {
      const { proxy, submitter, moderator, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);

      await expect(proxy.connect(moderator).approve(targetContract))
        .to.emit(proxy, "MetadataApproved")
        .withArgs(targetContract, moderator.address);

      const record = await proxy.getRecord(targetContract);
      expect(record.status).to.equal(2); // Approved
    });

    it("should revert if not Pending", async function () {
      const { proxy, submitter, moderator, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);
      await proxy.connect(moderator).approve(targetContract);

      await expect(proxy.connect(moderator).approve(targetContract)).to.be.revertedWith(
        "NotPending"
      );
    });

    it("should revert if caller lacks MODERATOR_ROLE", async function () {
      const { proxy, submitter, other, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);

      await expect(proxy.connect(other).approve(targetContract)).to.be.reverted;
    });
  });

  describe("reject", function () {
    it("should reject a pending submission with a reason", async function () {
      const { proxy, submitter, moderator, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);

      await expect(proxy.connect(moderator).reject(targetContract, "Invalid ABI"))
        .to.emit(proxy, "MetadataRejected")
        .withArgs(targetContract, moderator.address, "Invalid ABI");

      const record = await proxy.getRecord(targetContract);
      expect(record.status).to.equal(3); // Rejected
    });

    it("should revert if not Pending", async function () {
      const { proxy, submitter, moderator, targetContract } = await loadFixture(deployFixture);

      // No submission yet — status is None
      await expect(
        proxy.connect(moderator).reject(targetContract, "reason")
      ).to.be.revertedWith("NotPending");
    });

    it("should revert with empty reason", async function () {
      const { proxy, submitter, moderator, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);

      await expect(proxy.connect(moderator).reject(targetContract, "")).to.be.revertedWith(
        "EmptyReason"
      );
    });

    it("should revert if caller lacks MODERATOR_ROLE", async function () {
      const { proxy, submitter, other, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);

      await expect(proxy.connect(other).reject(targetContract, "reason")).to.be.reverted;
    });
  });

  /** Ownership Transfer */

  describe("transferRecordOwnership", function () {
    it("should transfer record ownership", async function () {
      const { proxy, submitter, other, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);

      await expect(
        proxy.connect(submitter).transferRecordOwnership(targetContract, other.address)
      )
        .to.emit(proxy, "RecordOwnershipTransferred")
        .withArgs(targetContract, submitter.address, other.address);

      const record = await proxy.getRecord(targetContract);
      expect(record.owner).to.equal(other.address);
    });

    it("should revert if caller is not the record owner", async function () {
      const { proxy, submitter, other, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);

      await expect(
        proxy.connect(other).transferRecordOwnership(targetContract, other.address)
      ).to.be.revertedWith("NotRecordOwner");
    });

    it("should revert transfer to zero address", async function () {
      const { proxy, submitter, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);

      await expect(
        proxy.connect(submitter).transferRecordOwnership(targetContract, ethers.ZeroAddress)
      ).to.be.revertedWith("ZeroNewOwner");
    });

    it("new owner can submit metadata after transfer", async function () {
      const { proxy, submitter, other, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);
      await proxy.connect(submitter).transferRecordOwnership(targetContract, other.address);

      await expect(proxy.connect(other).submitMetadata(targetContract, CID2, HASH2))
        .to.emit(proxy, "MetadataSubmitted")
        .withArgs(targetContract, other.address, CID2, HASH2, 2);
    });

    it("previous owner cannot submit after transfer", async function () {
      const { proxy, submitter, other, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);
      await proxy.connect(submitter).transferRecordOwnership(targetContract, other.address);

      await expect(
        proxy.connect(submitter).submitMetadata(targetContract, CID2, HASH2)
      ).to.be.revertedWith("NotOwnerOrDelegate");
    });
  });

  /** Delegates */

  describe("setDelegate", function () {
    it("should grant delegate permission", async function () {
      const { proxy, submitter, delegate, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);

      await expect(
        proxy.connect(submitter).setDelegate(targetContract, delegate.address, true)
      )
        .to.emit(proxy, "DelegateSet")
        .withArgs(targetContract, delegate.address, true);

      expect(await proxy.isDelegate(targetContract, delegate.address)).to.be.true;
    });

    it("delegate can submit metadata on behalf of owner", async function () {
      const { proxy, submitter, delegate, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);
      await proxy.connect(submitter).setDelegate(targetContract, delegate.address, true);

      await expect(proxy.connect(delegate).submitMetadata(targetContract, CID2, HASH2))
        .to.emit(proxy, "MetadataSubmitted");

      const record = await proxy.getRecord(targetContract);
      expect(record.metadataCid).to.equal(CID2);
      expect(record.version).to.equal(2);
    });

    it("should revoke delegate permission", async function () {
      const { proxy, submitter, delegate, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);
      await proxy.connect(submitter).setDelegate(targetContract, delegate.address, true);
      await proxy.connect(submitter).setDelegate(targetContract, delegate.address, false);

      expect(await proxy.isDelegate(targetContract, delegate.address)).to.be.false;

      await expect(
        proxy.connect(delegate).submitMetadata(targetContract, CID2, HASH2)
      ).to.be.revertedWith("NotOwnerOrDelegate");
    });

    it("should revert if non-owner tries to set delegate", async function () {
      const { proxy, submitter, delegate, other, targetContract } =
        await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);

      await expect(
        proxy.connect(other).setDelegate(targetContract, delegate.address, true)
      ).to.be.revertedWith("NotRecordOwner");
    });

    it("should revert setting zero address as delegate", async function () {
      const { proxy, submitter, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);

      await expect(
        proxy.connect(submitter).setDelegate(targetContract, ethers.ZeroAddress, true)
      ).to.be.revertedWith("ZeroDelegate");
    });
  });

  /** Resolver */

  describe("setResolver", function () {
    it("owner can set a resolver", async function () {
      const { proxy, submitter, targetContract } = await loadFixture(deployFixture);
      const resolverAddr = ethers.Wallet.createRandom().address;

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);

      await expect(proxy.connect(submitter).setResolver(targetContract, resolverAddr))
        .to.emit(proxy, "ResolverSet")
        .withArgs(targetContract, resolverAddr);

      expect(await proxy.getResolver(targetContract)).to.equal(resolverAddr);
    });

    it("delegate can set a resolver", async function () {
      const { proxy, submitter, delegate, targetContract } = await loadFixture(deployFixture);
      const resolverAddr = ethers.Wallet.createRandom().address;

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);
      await proxy.connect(submitter).setDelegate(targetContract, delegate.address, true);

      await proxy.connect(delegate).setResolver(targetContract, resolverAddr);
      expect(await proxy.getResolver(targetContract)).to.equal(resolverAddr);
    });

    it("non-owner/non-delegate cannot set resolver", async function () {
      const { proxy, submitter, other, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);

      await expect(
        proxy.connect(other).setResolver(targetContract, ethers.Wallet.createRandom().address)
      ).to.be.revertedWith("NotOwnerOrDelegate");
    });

    it("can unset resolver with zero address", async function () {
      const { proxy, submitter, targetContract } = await loadFixture(deployFixture);

      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);
      await proxy.connect(submitter).setResolver(targetContract, ethers.Wallet.createRandom().address);
      await proxy.connect(submitter).setResolver(targetContract, ethers.ZeroAddress);

      expect(await proxy.getResolver(targetContract)).to.equal(ethers.ZeroAddress);
    });
  });

  /** Read Functions */

  describe("getRecord", function () {
    it("should return empty record for unknown address", async function () {
      const { proxy } = await loadFixture(deployFixture);
      const unknown = ethers.Wallet.createRandom().address;

      const record = await proxy.getRecord(unknown);
      expect(record.owner).to.equal(ethers.ZeroAddress);
      expect(record.metadataCid).to.equal("");
      expect(record.version).to.equal(0);
      expect(record.status).to.equal(0); // None
    });
  });

  /** UUPS Upgrade */

  describe("Upgradability", function () {
    it("owner can upgrade the implementation", async function () {
      const { proxy, owner } = await loadFixture(deployFixture);

      const FactoryV2 = await ethers.getContractFactory("ContractMetadataRegistry", owner);
      const upgraded = await upgrades.upgradeProxy(await proxy.getAddress(), FactoryV2, {
        kind: "uups",
      });

      // Proxy address stays the same
      expect(await upgraded.getAddress()).to.equal(await proxy.getAddress());
    });

    it("non-owner cannot upgrade", async function () {
      const { proxy, other } = await loadFixture(deployFixture);

      const FactoryV2 = await ethers.getContractFactory("ContractMetadataRegistry", other);
      await expect(
        upgrades.upgradeProxy(await proxy.getAddress(), FactoryV2, { kind: "uups" })
      ).to.be.reverted;
    });

    it("state is preserved after upgrade", async function () {
      const { proxy, owner, submitter, moderator, targetContract } =
        await loadFixture(deployFixture);

      // Submit and approve before upgrade
      await proxy.connect(submitter).submitMetadata(targetContract, CID, HASH);
      await proxy.connect(moderator).approve(targetContract);

      // Upgrade
      const FactoryV2 = await ethers.getContractFactory("ContractMetadataRegistry", owner);
      const upgraded = (await upgrades.upgradeProxy(await proxy.getAddress(), FactoryV2, {
        kind: "uups",
      })) as unknown as ContractMetadataRegistry;

      // Verify state preserved
      const record = await upgraded.getRecord(targetContract);
      expect(record.owner).to.equal(submitter.address);
      expect(record.metadataCid).to.equal(CID);
      expect(record.status).to.equal(2); // Approved
      expect(record.version).to.equal(1);
    });
  });

  /** Access Control Admin */

  describe("Role management", function () {
    it("owner can grant MODERATOR_ROLE to another address", async function () {
      const { proxy, owner, other } = await loadFixture(deployFixture);

      await proxy.connect(owner).grantRole(MODERATOR_ROLE, other.address);
      expect(await proxy.hasRole(MODERATOR_ROLE, other.address)).to.be.true;
    });

    it("owner can revoke MODERATOR_ROLE", async function () {
      const { proxy, owner, moderator } = await loadFixture(deployFixture);

      await proxy.connect(owner).revokeRole(MODERATOR_ROLE, moderator.address);
      expect(await proxy.hasRole(MODERATOR_ROLE, moderator.address)).to.be.false;
    });

    it("non-admin cannot grant MODERATOR_ROLE", async function () {
      const { proxy, other } = await loadFixture(deployFixture);
      const random = ethers.Wallet.createRandom().address;

      await expect(proxy.connect(other).grantRole(MODERATOR_ROLE, random)).to.be.reverted;
    });
  });
});

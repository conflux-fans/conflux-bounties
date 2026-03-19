import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { TypedDataDomain, TypedDataField } from "ethers";
import type { MetadataRegistry } from "../typechain-types";
import type { MockOwnable } from "../typechain-types";

const EIP712_DOMAIN_NAME = "ConfluxMetadataRegistry";
const EIP712_VERSION = "1";

describe("MetadataRegistry", function () {
    let registry: MetadataRegistry;
    let mockOwnable: MockOwnable;
    let admin: SignerWithAddress;
    let moderator: SignerWithAddress;
    let owner: SignerWithAddress;
    let delegate: SignerWithAddress;
    let other: SignerWithAddress;

    async function deployFixture() {
        [admin, moderator, owner, delegate, other] = await ethers.getSigners();

        const MetadataRegistryFactory = await ethers.getContractFactory(
            "MetadataRegistry"
        );
        registry = (await upgrades.deployProxy(
            MetadataRegistryFactory,
            [admin.address, moderator.address],
            {
                initializer: "initialize",
                kind: "uups",
                unsafeAllow: ["constructor"],
            }
        )) as unknown as MetadataRegistry;

        const MockOwnableFactory = await ethers.getContractFactory("MockOwnable");
        mockOwnable = (await MockOwnableFactory.deploy(
            owner.address
        )) as unknown as MockOwnable;

        return { registry, mockOwnable, admin, moderator, owner, delegate, other };
    }

    async function buildOwnershipProof(
        contractAddress: string,
        metadataCid: string,
        checksum: string,
        nonce: bigint,
        deadline: bigint,
        signer: SignerWithAddress
    ) {
        const domain: TypedDataDomain = {
            name: EIP712_DOMAIN_NAME,
            version: EIP712_VERSION,
            chainId: (await ethers.provider.getNetwork()).chainId,
            verifyingContract: await registry.getAddress(),
        };

        const types: Record<string, TypedDataField[]> = {
            Submission: [
                { name: "contractAddress", type: "address" },
                { name: "metadataCid", type: "string" },
                { name: "checksum", type: "bytes32" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" },
            ],
        };

        const value = {
            contractAddress,
            metadataCid,
            checksum,
            nonce,
            deadline,
        };

        const signature = await signer.signTypedData(domain, types, value);
        const sig = ethers.Signature.from(signature);

        return {
            v: sig.v,
            r: sig.r,
            s: sig.s,
            nonce,
            deadline,
        };
    }

    beforeEach(async function () {
        ({ registry, mockOwnable, admin, moderator, owner, delegate, other } =
            await loadFixture(deployFixture));
    });

    describe("initialize", function () {
        it("should set admin and moderator roles", async function () {
            expect(await registry.hasRole(await registry.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
            expect(await registry.hasRole(await registry.UPGRADER_ROLE(), admin.address)).to.be.true;
            expect(await registry.hasRole(await registry.MODERATOR_ROLE(), moderator.address)).to.be.true;
        });

        it("should reject re-initialization", async function () {
            const MetadataRegistryFactory = await ethers.getContractFactory("MetadataRegistry");
            const impl = await MetadataRegistryFactory.deploy();
            await expect(
                impl.initialize(admin.address, moderator.address)
            ).to.be.reverted;
        });
    });

    describe("submitMetadata", function () {
        it("should revert when contractAddress is zero", async function () {
            const block = await ethers.provider.getBlock("latest");
            const proof = await buildOwnershipProof(
                ethers.ZeroAddress,
                "QmCid",
                ethers.keccak256(ethers.toUtf8Bytes("checksum")),
                1n,
                BigInt(block!.timestamp) + 3600n,
                owner
            );
            await expect(
                registry.submitMetadata(
                    ethers.ZeroAddress,
                    "QmCid",
                    ethers.keccak256(ethers.toUtf8Bytes("checksum")),
                    proof
                )
            ).to.be.revertedWithCustomError(registry, "InvalidContractAddress");
        });

        it("should allow owner to submit metadata directly", async function () {
            const metadataCid = "QmMetadata123";
            const checksum = ethers.keccak256(ethers.toUtf8Bytes("checksum"));

            await expect(
                registry
                    .connect(owner)
                    .submitMetadata(
                        await mockOwnable.getAddress(),
                        metadataCid,
                        checksum,
                        { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                    )
            )
                .to.emit(registry, "MetadataSubmitted")
                .withArgs(
                    await mockOwnable.getAddress(),
                    1n,
                    owner.address,
                    metadataCid,
                    checksum
                );

            const record = await registry.getRecord(await mockOwnable.getAddress());
            expect(record.metadataCid).to.equal(metadataCid);
            expect(record.checksum).to.equal(checksum);
            expect(record.version).to.equal(1n);
            expect(record.status).to.equal(1); // Pending
        });

        it("should allow submission with valid ownership proof", async function () {
            const metadataCid = "QmSignedCid";
            const checksum = ethers.keccak256(ethers.toUtf8Bytes("signed"));
            const deadline =
                BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 3600n;

            const proof = await buildOwnershipProof(
                await mockOwnable.getAddress(),
                metadataCid,
                checksum,
                1n,
                deadline,
                owner
            );

            await expect(
                registry
                    .connect(other)
                    .submitMetadata(
                        await mockOwnable.getAddress(),
                        metadataCid,
                        checksum,
                        proof
                    )
            )
                .to.emit(registry, "MetadataSubmitted")
                .to.emit(registry, "NonceUsed");

            const record = await registry.getRecord(await mockOwnable.getAddress());
            expect(record.metadataCid).to.equal(metadataCid);
        });

        it("should revert when signature is expired", async function () {
            const metadataCid = "QmExpired";
            const checksum = ethers.keccak256(ethers.toUtf8Bytes("expired"));
            const deadline =
                BigInt((await ethers.provider.getBlock("latest"))!.timestamp) - 3600n;

            const proof = await buildOwnershipProof(
                await mockOwnable.getAddress(),
                metadataCid,
                checksum,
                1n,
                deadline,
                owner
            );

            await expect(
                registry
                    .connect(other)
                    .submitMetadata(
                        await mockOwnable.getAddress(),
                        metadataCid,
                        checksum,
                        proof
                    )
            ).to.be.revertedWithCustomError(registry, "SignatureExpired");
        });

        it("should revert on signature replay", async function () {
            const metadataCid = "QmReplay";
            const checksum = ethers.keccak256(ethers.toUtf8Bytes("replay"));
            const deadline =
                BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 3600n;

            const proof = await buildOwnershipProof(
                await mockOwnable.getAddress(),
                metadataCid,
                checksum,
                99n,
                deadline,
                owner
            );

            await registry
                .connect(other)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    metadataCid,
                    checksum,
                    proof
                );

            await expect(
                registry
                    .connect(other)
                    .submitMetadata(
                        await mockOwnable.getAddress(),
                        metadataCid,
                        checksum,
                        proof
                    )
            ).to.be.revertedWithCustomError(registry, "SignatureReplay");
        });

        it("should revert when signer is not owner or delegate", async function () {
            const metadataCid = "QmWrongSigner";
            const checksum = ethers.keccak256(ethers.toUtf8Bytes("wrong"));
            const deadline =
                BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 3600n;

            const proof = await buildOwnershipProof(
                await mockOwnable.getAddress(),
                metadataCid,
                checksum,
                1n,
                deadline,
                other
            );

            await expect(
                registry
                    .connect(other)
                    .submitMetadata(
                        await mockOwnable.getAddress(),
                        metadataCid,
                        checksum,
                        proof
                    )
            ).to.be.revertedWithCustomError(registry, "InvalidSignature");
        });
    });

    describe("approve", function () {
        beforeEach(async function () {
            await registry
                .connect(owner)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmPending",
                    ethers.keccak256(ethers.toUtf8Bytes("pending")),
                    { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                );
        });

        it("should approve pending metadata", async function () {
            await expect(
                registry.connect(moderator).approve(await mockOwnable.getAddress(), 1n)
            )
                .to.emit(registry, "MetadataApproved")
                .withArgs(await mockOwnable.getAddress(), 1n, moderator.address)
                .to.emit(registry, "MetadataUpdated");

            const record = await registry.getRecord(await mockOwnable.getAddress());
            expect(record.status).to.equal(2); // Approved
        });

        it("should revert when not moderator", async function () {
            await expect(
                registry.connect(other).approve(await mockOwnable.getAddress(), 1n)
            ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
        });

        it("should revert when record not found", async function () {
            await expect(
                registry.connect(moderator).approve(await mockOwnable.getAddress(), 99n)
            ).to.be.revertedWithCustomError(registry, "RecordNotFound");
        });

        it("should revert when already approved", async function () {
            await registry.connect(moderator).approve(await mockOwnable.getAddress(), 1n);
            await expect(
                registry.connect(moderator).approve(await mockOwnable.getAddress(), 1n)
            ).to.be.revertedWithCustomError(registry, "AlreadyApproved");
        });
    });

    describe("reject", function () {
        beforeEach(async function () {
            await registry
                .connect(owner)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmReject",
                    ethers.keccak256(ethers.toUtf8Bytes("reject")),
                    { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                );
        });

        it("should reject metadata", async function () {
            const reasonCid = "QmReason";
            await expect(
                registry
                    .connect(moderator)
                    .reject(await mockOwnable.getAddress(), 1n, reasonCid)
            )
                .to.emit(registry, "MetadataRejected")
                .withArgs(
                    await mockOwnable.getAddress(),
                    1n,
                    moderator.address,
                    reasonCid
                );

            const record = await registry.getRecordByVersion(
                await mockOwnable.getAddress(),
                1n
            );
            expect(record.status).to.equal(3); // Rejected
        });

        it("should revert when not moderator", async function () {
            await expect(
                registry
                    .connect(other)
                    .reject(await mockOwnable.getAddress(), 1n, "QmReason")
            ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
        });

        it("should revert when record not found", async function () {
            await expect(
                registry
                    .connect(moderator)
                    .reject(await mockOwnable.getAddress(), 99n, "QmReason")
            ).to.be.revertedWithCustomError(registry, "RecordNotFound");
        });
    });

    describe("updateMetadata", function () {
        beforeEach(async function () {
            await registry
                .connect(owner)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmOriginal",
                    ethers.keccak256(ethers.toUtf8Bytes("original")),
                    { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                );
        });

        it("should allow owner to update metadata", async function () {
            const newCid = "QmUpdated";
            const newChecksum = ethers.keccak256(ethers.toUtf8Bytes("updated"));

            await expect(
                registry
                    .connect(owner)
                    .updateMetadata(
                        await mockOwnable.getAddress(),
                        newCid,
                        newChecksum,
                        { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                    )
            )
                .to.emit(registry, "MetadataSubmitted")
                .withArgs(await mockOwnable.getAddress(), 2n, owner.address, newCid, newChecksum);

            const record = await registry.getRecord(await mockOwnable.getAddress());
            expect(record.metadataCid).to.equal(newCid);
            expect(record.checksum).to.equal(newChecksum);
            expect(record.version).to.equal(2n);
        });

        it("should revert when contractAddress is zero", async function () {
            const block = await ethers.provider.getBlock("latest");
            const proof = await buildOwnershipProof(
                ethers.ZeroAddress,
                "QmNew",
                ethers.keccak256(ethers.toUtf8Bytes("new")),
                1n,
                BigInt(block!.timestamp) + 3600n,
                owner
            );
            await expect(
                registry.updateMetadata(
                    ethers.ZeroAddress,
                    "QmNew",
                    ethers.keccak256(ethers.toUtf8Bytes("new")),
                    proof
                )
            ).to.be.revertedWithCustomError(registry, "InvalidContractAddress");
        });
    });

    describe("transferOwnership", function () {
        beforeEach(async function () {
            await registry
                .connect(owner)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmOwn",
                    ethers.keccak256(ethers.toUtf8Bytes("own")),
                    { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                );
        });

        it("should transfer ownership", async function () {
            await expect(
                registry
                    .connect(owner)
                    .getFunction("transferOwnership(address,address)")
                    (await mockOwnable.getAddress(), other.address)
            )
                .to.emit(registry, "OwnershipTransferredForContract")
                .withArgs(await mockOwnable.getAddress(), owner.address, other.address);

            await mockOwnable.connect(owner).setOwner(other.address);

            await registry
                .connect(other)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmNewOwner",
                    ethers.keccak256(ethers.toUtf8Bytes("newowner")),
                    { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                );

            const record = await registry.getRecord(await mockOwnable.getAddress());
            expect(record.owner).to.equal(other.address);
        });

        it("should revert when newOwner is zero", async function () {
            await expect(
                registry
                    .connect(owner)
                    .getFunction("transferOwnership(address,address)")
                    (await mockOwnable.getAddress(), ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(registry, "ZeroAddress");
        });

        it("should revert when not contract owner", async function () {
            await expect(
                registry
                    .connect(other)
                    .getFunction("transferOwnership(address,address)")
                    (await mockOwnable.getAddress(), delegate.address)
            ).to.be.revertedWithCustomError(registry, "NotContractOwner");
        });

        it("should allow transfer when owner from on-chain", async function () {
            const freshMock = await (
                await ethers.getContractFactory("MockOwnable")
            ).deploy(other.address);

            await registry
                .connect(other)
                .submitMetadata(
                    await freshMock.getAddress(),
                    "QmFresh",
                    ethers.keccak256(ethers.toUtf8Bytes("fresh")),
                    { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                );

            await expect(
                registry
                    .connect(other)
                    .getFunction("transferOwnership(address,address)")
                    (await freshMock.getAddress(), owner.address)
            )
                .to.emit(registry, "OwnershipTransferredForContract")
                .withArgs(await freshMock.getAddress(), other.address, owner.address);
        });
    });

    describe("setResolver", function () {
        beforeEach(async function () {
            await registry
                .connect(owner)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmResolver",
                    ethers.keccak256(ethers.toUtf8Bytes("resolver")),
                    { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                );
        });

        it("should set resolver", async function () {
            await expect(
                registry
                    .connect(owner)
                    .setResolver(await mockOwnable.getAddress(), delegate.address)
            )
                .to.emit(registry, "ResolverSet")
                .withArgs(await mockOwnable.getAddress(), delegate.address);

            await registry
                .connect(owner)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmResolver2",
                    ethers.keccak256(ethers.toUtf8Bytes("resolver2")),
                    { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                );

            const record = await registry.getRecord(await mockOwnable.getAddress());
            expect(record.resolver).to.equal(delegate.address);
        });

        it("should revert when not owner", async function () {
            await expect(
                registry
                    .connect(other)
                    .setResolver(await mockOwnable.getAddress(), delegate.address)
            ).to.be.revertedWithCustomError(registry, "NotContractOwner");
        });
    });

    describe("addDelegate / removeDelegate", function () {
        beforeEach(async function () {
            await registry
                .connect(owner)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmDelegate",
                    ethers.keccak256(ethers.toUtf8Bytes("delegate")),
                    { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                );
        });

        it("should add delegate", async function () {
            const expiry = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 86400n;

            await expect(
                registry
                    .connect(owner)
                    .addDelegate(await mockOwnable.getAddress(), delegate.address, expiry)
            )
                .to.emit(registry, "DelegateAdded")
                .withArgs(await mockOwnable.getAddress(), delegate.address, expiry);

            const proof = await buildOwnershipProof(
                await mockOwnable.getAddress(),
                "QmDelegateSub",
                ethers.keccak256(ethers.toUtf8Bytes("delegatesub")),
                1n,
                expiry,
                delegate
            );

            await registry
                .connect(other)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmDelegateSub",
                    ethers.keccak256(ethers.toUtf8Bytes("delegatesub")),
                    proof
                );

            const record = await registry.getRecord(await mockOwnable.getAddress());
            expect(record.metadataCid).to.equal("QmDelegateSub");
        });

        it("should revert when delegate is zero", async function () {
            await expect(
                registry
                    .connect(owner)
                    .addDelegate(
                        await mockOwnable.getAddress(),
                        ethers.ZeroAddress,
                        0n
                    )
            ).to.be.revertedWithCustomError(registry, "ZeroAddress");
        });

        it("should revert when not owner adds delegate", async function () {
            await expect(
                registry
                    .connect(other)
                    .addDelegate(await mockOwnable.getAddress(), delegate.address, 0n)
            ).to.be.revertedWithCustomError(registry, "NotContractOwner");
        });

        it("should remove delegate", async function () {
            const expiry = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 86400n;

            await registry
                .connect(owner)
                .addDelegate(await mockOwnable.getAddress(), delegate.address, expiry);

            await expect(
                registry
                    .connect(owner)
                    .removeDelegate(await mockOwnable.getAddress(), delegate.address)
            )
                .to.emit(registry, "DelegateRemoved")
                .withArgs(await mockOwnable.getAddress(), delegate.address);

            const proof = await buildOwnershipProof(
                await mockOwnable.getAddress(),
                "QmShouldFail",
                ethers.keccak256(ethers.toUtf8Bytes("shouldfail")),
                2n,
                expiry,
                delegate
            );

            await expect(
                registry
                    .connect(other)
                    .submitMetadata(
                        await mockOwnable.getAddress(),
                        "QmShouldFail",
                        ethers.keccak256(ethers.toUtf8Bytes("shouldfail")),
                        proof
                    )
            ).to.be.revertedWithCustomError(registry, "InvalidSignature");
        });

        it("should revert when not owner removes delegate", async function () {
            const expiry = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 86400n;
            await registry
                .connect(owner)
                .addDelegate(await mockOwnable.getAddress(), delegate.address, expiry);

            await expect(
                registry
                    .connect(other)
                    .removeDelegate(await mockOwnable.getAddress(), delegate.address)
            ).to.be.revertedWithCustomError(registry, "NotContractOwner");
        });

        it("should allow delegate with zero expiry (no expiry check)", async function () {
            await registry
                .connect(owner)
                .addDelegate(await mockOwnable.getAddress(), delegate.address, 0n);

            const deadline = BigInt((await ethers.provider.getBlock("latest"))!.timestamp) + 3600n;
            const proof = await buildOwnershipProof(
                await mockOwnable.getAddress(),
                "QmNoExpiry",
                ethers.keccak256(ethers.toUtf8Bytes("noexpiry")),
                1n,
                deadline,
                delegate
            );

            await registry
                .connect(other)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmNoExpiry",
                    ethers.keccak256(ethers.toUtf8Bytes("noexpiry")),
                    proof
                );

            const record = await registry.getRecord(await mockOwnable.getAddress());
            expect(record.metadataCid).to.equal("QmNoExpiry");
        });
    });

    describe("getRecord / getRecordByVersion", function () {
        it("should return empty record when no submission", async function () {
            const record = await registry.getRecord(await mockOwnable.getAddress());
            expect(record.version).to.equal(0n);
            expect(record.contractAddress).to.equal(ethers.ZeroAddress);
        });

        it("should return record by version", async function () {
            await registry
                .connect(owner)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmV1",
                    ethers.keccak256(ethers.toUtf8Bytes("v1")),
                    { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                );

            await registry
                .connect(owner)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmV2",
                    ethers.keccak256(ethers.toUtf8Bytes("v2")),
                    { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                );

            const v1 = await registry.getRecordByVersion(
                await mockOwnable.getAddress(),
                1n
            );
            const v2 = await registry.getRecordByVersion(
                await mockOwnable.getAddress(),
                2n
            );

            expect(v1.metadataCid).to.equal("QmV1");
            expect(v2.metadataCid).to.equal("QmV2");
        });

        it("getRecord returns current version", async function () {
            await registry
                .connect(owner)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmCurrent",
                    ethers.keccak256(ethers.toUtf8Bytes("current")),
                    { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                );

            const record = await registry.getRecord(await mockOwnable.getAddress());
            expect(record.metadataCid).to.equal("QmCurrent");
        });
    });

    describe("UUPS upgrade", function () {
        it("should upgrade when called by upgrader", async function () {
            const MetadataRegistryV2 = await ethers.getContractFactory("MetadataRegistry");
            const upgraded = await upgrades.upgradeProxy(
                await registry.getAddress(),
                MetadataRegistryV2,
                { unsafeAllow: ["constructor"] }
            );

            expect(await upgraded.getAddress()).to.equal(await registry.getAddress());
        });

        it("should revert upgrade when not upgrader", async function () {
            const MetadataRegistryV2 = await ethers.getContractFactory(
                "MetadataRegistry",
                other
            );
            await expect(
                upgrades.upgradeProxy(await registry.getAddress(), MetadataRegistryV2, {
                    unsafeAllow: ["constructor"],
                })
            ).to.be.reverted;
        });
    });

    describe("edge cases", function () {
        it("should reject contract with no owner() or failing owner()", async function () {
            const NoOwnerContract = await ethers.getContractFactory("MockOwnable");
            const noOwner = await NoOwnerContract.deploy(ethers.ZeroAddress);

            await expect(
                registry
                    .connect(other)
                    .submitMetadata(
                        await noOwner.getAddress(),
                        "QmFail",
                        ethers.keccak256(ethers.toUtf8Bytes("fail")),
                        { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                    )
            ).to.be.revertedWithCustomError(registry, "NotContractOwner");
        });

        it("should store resolver in new record on submission", async function () {
            await registry
                .connect(owner)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmFirst",
                    ethers.keccak256(ethers.toUtf8Bytes("first")),
                    { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                );

            await registry
                .connect(owner)
                .setResolver(await mockOwnable.getAddress(), delegate.address);

            await registry
                .connect(owner)
                .submitMetadata(
                    await mockOwnable.getAddress(),
                    "QmSecond",
                    ethers.keccak256(ethers.toUtf8Bytes("second")),
                    { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                );

            const record = await registry.getRecord(await mockOwnable.getAddress());
            expect(record.resolver).to.equal(delegate.address);
        });

        it("submitMetadata increments version correctly", async function () {
            for (let i = 1; i <= 3; i++) {
                await registry
                    .connect(owner)
                    .submitMetadata(
                        await mockOwnable.getAddress(),
                        `QmVersion${i}`,
                        ethers.keccak256(ethers.toUtf8Bytes(`version${i}`)),
                        { v: 0, r: ethers.ZeroHash, s: ethers.ZeroHash, nonce: 0n, deadline: 0n }
                    );

                const record = await registry.getRecord(await mockOwnable.getAddress());
                expect(record.version).to.equal(BigInt(i));
            }
        });
    });
});

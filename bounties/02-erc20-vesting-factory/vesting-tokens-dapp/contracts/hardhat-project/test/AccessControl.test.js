const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Access Control Tests", function () {
  let factory;
  let tokenImplementation;
  let vestingImplementation;
  let owner;
  let attacker;

  beforeEach(async function () {
    [owner, attacker] = await ethers.getSigners();

    // Deploy factory (which deploys implementation contracts)
    const TokenVestingFactory = await ethers.getContractFactory("TokenVestingFactory");
    factory = await TokenVestingFactory.deploy();
    await factory.waitForDeployment();

    // Get implementation addresses
    const implementations = await factory.getImplementations();
    tokenImplementation = implementations[0];
    vestingImplementation = implementations[1];
  });

  describe("VestedToken Access Control", function () {
    it("Should prevent direct initialization by non-factory", async function () {
      const VestedToken = await ethers.getContractFactory("VestedToken");
      const tokenImpl = VestedToken.attach(tokenImplementation);

      // Try to initialize directly (should fail)
      await expect(
        tokenImpl.initialize("Test Token", "TEST", ethers.parseEther("1000000"), owner.address)
      ).to.be.revertedWith("Only factory can initialize");
    });

    it("Should allow factory to initialize through clone", async function () {
      // Deploy token through factory
      const tx = await factory.deployTokenWithVesting(
        {
          name: "Test Token",
          symbol: "TEST",
          totalSupply: ethers.parseEther("1000000"),
          owner: owner.address,
        },
        [
          {
            beneficiary: attacker.address,
            amount: ethers.parseEther("100000"),
            cliff: 0,
            duration: 365 * 24 * 60 * 60, // 1 year
            revocable: false,
          },
        ]
      );

      const receipt = await tx.wait();
      
      // Find TokenDeployed event
      const event = receipt.logs.find(
        (log) => {
          try {
            const parsed = factory.interface.parseLog(log);
            return parsed.name === "TokenDeployed";
          } catch {
            return false;
          }
        }
      );

      expect(event).to.not.be.undefined;
      const parsedEvent = factory.interface.parseLog(event);
      const tokenAddress = parsedEvent.args[0];

      // Verify token is initialized
      const VestedToken = await ethers.getContractFactory("VestedToken");
      const token = VestedToken.attach(tokenAddress);
      
      expect(await token.isInitialized()).to.be.true;
      expect(await token.name()).to.equal("Test Token");
      expect(await token.symbol()).to.equal("TEST");
    });
  });

  describe("TokenVesting Access Control", function () {
    it("Should prevent direct initialization by non-factory", async function () {
      const TokenVesting = await ethers.getContractFactory("TokenVesting");
      const vestingImpl = TokenVesting.attach(vestingImplementation);

      // Try to initialize directly (should fail)
      await expect(
        vestingImpl.initialize(
          ethers.ZeroAddress, // token
          attacker.address, // beneficiary
          ethers.parseEther("100000"), // amount
          0, // cliff
          365 * 24 * 60 * 60, // duration
          false, // revocable
          owner.address // owner
        )
      ).to.be.revertedWith("Only factory can initialize");
    });

    it("Should allow factory to initialize through clone", async function () {
      // Deploy token with vesting through factory
      const tx = await factory.deployTokenWithVesting(
        {
          name: "Test Token",
          symbol: "TEST",
          totalSupply: ethers.parseEther("1000000"),
          owner: owner.address,
        },
        [
          {
            beneficiary: attacker.address,
            amount: ethers.parseEther("100000"),
            cliff: 0,
            duration: 365 * 24 * 60 * 60, // 1 year
            revocable: false,
          },
        ]
      );

      const receipt = await tx.wait();
      
      // Find VestingDeployed event
      const event = receipt.logs.find(
        (log) => {
          try {
            const parsed = factory.interface.parseLog(log);
            return parsed.name === "VestingDeployed";
          } catch {
            return false;
          }
        }
      );

      expect(event).to.not.be.undefined;
      const parsedEvent = factory.interface.parseLog(event);
      const vestingAddress = parsedEvent.args[1];

      // Verify vesting contract is initialized
      const TokenVesting = await ethers.getContractFactory("TokenVesting");
      const vesting = TokenVesting.attach(vestingAddress);
      
      expect(await vesting.isInitialized()).to.be.true;
      expect(await vesting.beneficiary()).to.equal(attacker.address);
    });
  });

  describe("Factory Address Verification", function () {
    it("Should set factory address correctly in implementation contracts", async function () {
      const VestedToken = await ethers.getContractFactory("VestedToken");
      const TokenVesting = await ethers.getContractFactory("TokenVesting");
      
      const tokenImpl = VestedToken.attach(tokenImplementation);
      const vestingImpl = TokenVesting.attach(vestingImplementation);

      // Verify factory address is set to the factory contract address
      expect(await tokenImpl.factory()).to.equal(await factory.getAddress());
      expect(await vestingImpl.factory()).to.equal(await factory.getAddress());
    });
  });
});

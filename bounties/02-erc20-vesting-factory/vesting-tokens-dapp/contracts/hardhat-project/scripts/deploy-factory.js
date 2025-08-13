const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying TokenVestingFactory...");
  
  const TokenVestingFactory = await ethers.getContractFactory("TokenVestingFactory");
  const factory = await TokenVestingFactory.deploy();
  
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  console.log("TokenVestingFactory deployed to:", factoryAddress);
  
  // Get implementation addresses
  const tokenImpl = await factory.tokenImplementation();
  const vestingImpl = await factory.vestingImplementation();
  
  console.log("Token Implementation:", tokenImpl);
  console.log("Vesting Implementation:", vestingImpl);
  
  return factoryAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 
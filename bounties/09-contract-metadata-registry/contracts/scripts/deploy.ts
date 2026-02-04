import { ethers, upgrades } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const moderator = process.env.MODERATOR_ADDRESS || deployer.address;

  const Factory = await ethers.getContractFactory("ContractMetadataRegistry");
  const proxy = await upgrades.deployProxy(Factory, [deployer.address, moderator], {
    initializer: "initialize",
    kind: "uups",
  });

  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("Proxy deployed to:", proxyAddress);
  console.log("Implementation deployed to:", implAddress);
  console.log("Moderator:", moderator);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

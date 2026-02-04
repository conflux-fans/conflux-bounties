import { ethers, upgrades } from "hardhat";

async function main() {
  const proxyAddress = process.env.REGISTRY_PROXY_ADDRESS;
  if (!proxyAddress) {
    throw new Error("Set REGISTRY_PROXY_ADDRESS in environment");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);

  const Factory = await ethers.getContractFactory("ContractMetadataRegistry");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, Factory, { kind: "uups" });

  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log("Proxy at:", proxyAddress);
  console.log("New implementation deployed to:", newImpl);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

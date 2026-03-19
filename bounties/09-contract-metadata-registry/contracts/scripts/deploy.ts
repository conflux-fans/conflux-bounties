import * as fs from "fs";
import * as path from "path";
import { ethers, network, upgrades } from "hardhat";

const DEPLOYMENTS_DIR = path.join(__dirname, "../deployments");

function saveDeployment(
    networkName: string,
    proxyAddress: string,
    implementationAddress: string,
    deployerAddress: string
) {
    if (!fs.existsSync(DEPLOYMENTS_DIR)) {
        fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
    }
    const filePath = path.join(DEPLOYMENTS_DIR, `${networkName}.json`);
    const data = {
        network: networkName,
        proxyAddress,
        implementationAddress,
        deployerAddress,
        deployedAt: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Deployment info saved to ${filePath}`);
}

async function main() {
    if (!process.env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY is not set in .env");
    }

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "CFX");

    if (balance === 0n) {
        throw new Error("Deployer account has zero balance. Get testnet CFX from https://faucet.confluxnetwork.org/");
    }

    const MetadataRegistry = await ethers.getContractFactory("MetadataRegistry");
    const registry = await upgrades.deployProxy(MetadataRegistry, [deployer.address, deployer.address], {
        initializer: "initialize",
        kind: "uups",
        unsafeAllow: ["constructor"],
    });

    await registry.waitForDeployment();

    const proxyAddress = await registry.getAddress();
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

    console.log("\n=== Deployment Complete ===");
    console.log("MetadataRegistry (proxy) deployed to:", proxyAddress);
    console.log("Implementation address:", implementationAddress);
    console.log("\nVerify on ConfluxScan:");
    console.log(`  npx hardhat run scripts/verify.ts --network ${network.name} ${proxyAddress}`);
    console.log("  Or: npx hardhat verify --network", network.name, proxyAddress);

    const networkName = network.name;
    saveDeployment(networkName, proxyAddress, implementationAddress, deployer.address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

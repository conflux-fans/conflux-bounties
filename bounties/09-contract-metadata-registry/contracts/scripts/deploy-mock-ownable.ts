/** Deploy MockOwnable for testing. You become the owner. Usage: npx hardhat run scripts/deploy-mock-ownable.ts --network confluxTestnet */
import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying MockOwnable with owner:", deployer.address);

    const MockOwnable = await ethers.getContractFactory("MockOwnable");
    const mock = await MockOwnable.deploy(deployer.address);
    await mock.waitForDeployment();

    const address = await mock.getAddress();
    console.log("\nMockOwnable deployed to:", address);
    console.log("\nUse this address in the submission form. Your wallet is the owner.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

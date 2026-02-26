import * as fs from "fs";
import * as path from "path";
import { ethers, network, run, upgrades } from "hardhat";

const DEPLOYMENTS_DIR = path.join(__dirname, "../deployments");
const INITIALIZER_ABI = ["function initialize(address admin, address moderator)"];

const CONFLUX_NETWORKS = ["confluxTestnet", "confluxMainnet"];

async function main() {
    const proxyArg = process.argv.find((arg) => /^0x[a-fA-F0-9]{40}$/.test(arg));

    let proxyAddress: string;
    let implementationAddress: string;
    let deployerAddress: string | undefined;

    if (proxyArg) {
        proxyAddress = proxyArg;
        const deploymentPath = path.join(DEPLOYMENTS_DIR, `${network.name}.json`);
        if (fs.existsSync(deploymentPath)) {
            const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
            if (deployment.proxyAddress?.toLowerCase() === proxyAddress.toLowerCase()) {
                implementationAddress = deployment.implementationAddress;
                deployerAddress = deployment.deployerAddress;
            }
        }
        if (!implementationAddress) {
            implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
        }
    } else {
        const deploymentPath = path.join(DEPLOYMENTS_DIR, `${network.name}.json`);
        if (!fs.existsSync(deploymentPath)) {
            throw new Error(
                `No deployment found for network "${network.name}". Run deploy first or pass the proxy address:\n` +
                    `  npx hardhat run scripts/verify.ts --network ${network.name} <PROXY_ADDRESS>`
            );
        }
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
        proxyAddress = deployment.proxyAddress;
        implementationAddress = deployment.implementationAddress;
        deployerAddress = deployment.deployerAddress;
        console.log(`Using proxy address from deployment: ${proxyAddress}`);
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(proxyAddress) || !/^0x[a-fA-F0-9]{40}$/.test(implementationAddress)) {
        throw new Error(`Invalid address: proxy=${proxyAddress} implementation=${implementationAddress}`);
    }

    console.log(`Verifying proxy at ${proxyAddress} on ConfluxScan (${network.name})...`);
    console.log(`Verifying implementation: ${implementationAddress}`);

    const verifyOne = async (address: string, contract?: string, constructorArguments?: unknown[]) => {
        try {
            await run("verify:verify", {
                address,
                ...(contract && { contract }),
                ...(constructorArguments && constructorArguments.length > 0 && { constructorArguments }),
            });
            console.log(`Successfully verified contract at ${address}`);
        } catch (error: unknown) {
            const err = error as { message?: string };
            if (err.message?.toLowerCase().includes("already verified")) {
                console.log(`Contract at ${address} is already verified.`);
            } else {
                throw error;
            }
        }
    };

    await verifyOne(implementationAddress);

    const isConflux = CONFLUX_NETWORKS.includes(network.name);
    if (isConflux) {
        console.log("");
        console.log("Skipping proxy verification on Conflux (explorer reports constructor_args_not_match).");
        console.log("Implementation is verified; proxy is linked and usable on the explorer.");
    } else {
        deployerAddress = deployerAddress || process.env.DEPLOYER_ADDRESS;
        if (!deployerAddress || !/^0x[a-fA-F0-9]{40}$/.test(deployerAddress)) {
            throw new Error(
                "Deployer address required for proxy verification. " +
                    "Set deployerAddress in the deployment JSON or env DEPLOYER_ADDRESS."
            );
        }
        const iface = new ethers.Interface(INITIALIZER_ABI);
        const initializerData = iface.encodeFunctionData("initialize", [deployerAddress, deployerAddress]);
        const proxyConstructorArgs: [string, string] = [implementationAddress, initializerData];
        try {
            await run("verify:verify", {
                address: proxyAddress,
                contract: "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
                constructorArguments: proxyConstructorArgs,
            });
            console.log("Successfully verified proxy.");
        } catch (error: unknown) {
            const err = error as { message?: string };
            if (err.message?.toLowerCase().includes("already verified")) {
                console.log("Proxy is already verified.");
            } else {
                throw error;
            }
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

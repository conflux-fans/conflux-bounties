import { ethers } from 'hardhat';

async function main() {
  const treasury = process.env.TREASURY_ADDRESS;
  if (!treasury) throw new Error('TREASURY_ADDRESS required');

  console.log('Deploying X402PaymentReceiver...');
  console.log('  Treasury:', treasury);

  const factory = await ethers.getContractFactory('X402PaymentReceiver');
  const contract = await factory.deploy(treasury);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log('  Deployed to:', address);
  console.log('  Owner:', await contract.owner());

  const network = await ethers.provider.getNetwork();
  const explorer = Number(network.chainId) === 71
    ? 'https://evmtestnet.confluxscan.org'
    : 'https://evm.confluxscan.io';

  console.log(`  Explorer: ${explorer}/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * fix-price-adapter-factory.ts
 *
 * One-time fix: updates the SwappiPriceAdapter's factory address on mainnet.
 *
 * Problem: the adapter was deployed with factory 0x20b45b8a60E3a5051D9CE6e63Ad7614D3fa5ED54
 * which has NO code on Conflux eSpace mainnet. As a result, getPrice() always returns 0.
 *
 * Fix: call setFactory() to point to the real factory (0xe2a6f7c0ce4d5d300f97aa7e125455f5cd3342f5)
 * retrieved from router.factory() on-chain.
 *
 * Usage (mainnet):
 *   EXECUTOR_PRIVATE_KEY=0x... npx hardhat run scripts/fix-price-adapter-factory.ts --network espaceMainnet
 *
 * Requires: owner wallet (0x623928228700438166d4BB226898425D13faa0dc) to sign the tx.
 */

import { ethers, network } from 'hardhat';

const DEPLOYED = {
  espaceMainnet: {
    priceAdapter:   '0xd2cc2a7eb4a5792ce6383ccd0f789c1a9c48ecf9',
    correctFactory: '0xe2a6f7c0ce4d5d300f97aa7e125455f5cd3342f5',
    badFactory:     '0x20b45b8a60e3a5051d9ce6e63ad7614d3fa5ed54',
  },
};

const PRICE_ADAPTER_ABI = [
  'function factory() external view returns (address)',
  'function router() external view returns (address)',
  'function setFactory(address _factory) external',
  'function owner() external view returns (address)',
  'event FactoryUpdated(address indexed newFactory)',
];

async function main() {
  const net = network.name;
  if (net !== 'espaceMainnet') {
    throw new Error(`This script must be run with --network espaceMainnet (got: ${net})`);
  }

  const addrs = DEPLOYED.espaceMainnet;
  const [signer] = await ethers.getSigners();
  const adapter = new ethers.Contract(addrs.priceAdapter, PRICE_ADAPTER_ABI, signer);

  console.log(`Network:        ${net}`);
  console.log(`Signer:         ${signer.address}`);
  console.log(`PriceAdapter:   ${addrs.priceAdapter}`);

  const currentFactory = await adapter.factory();
  const owner          = await adapter.owner();
  const currentRouter  = await adapter.router();

  console.log(`\nCurrent state:`);
  console.log(`  owner:   ${owner}`);
  console.log(`  factory: ${currentFactory}`);
  console.log(`  router:  ${currentRouter}`);

  if (signer.address.toLowerCase() !== owner.toLowerCase()) {
    throw new Error(`Signer ${signer.address} is not the owner (${owner}). Cannot set factory.`);
  }

  if (currentFactory.toLowerCase() === addrs.correctFactory.toLowerCase()) {
    console.log(`\n✅  Factory is already set correctly — nothing to do.`);
    return;
  }

  console.log(`\nCurrent factory ${currentFactory} has no code on-chain.`);
  console.log(`Setting factory → ${addrs.correctFactory}`);

  const tx = await adapter.setFactory(addrs.correctFactory);
  console.log(`\nTx submitted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber} (status=${receipt.status})`);

  const updatedFactory = await adapter.factory();
  console.log(`\n✅  New factory: ${updatedFactory}`);
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});

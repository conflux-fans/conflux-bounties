#!/usr/bin/env ts

import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with:', deployer.address);

  // Pyth addresses on Conflux eSpace
  const PYTH_ENDPOINT_MAINNET = '0xe9e45c4a3f58d27ec491327000293359ff618e2f';
  const PYTH_ENDPOINT_TESTNET = '0x43cF1c26D56a3e46D6826D615E5Ca7B7a96e5C6b';

  const pythAddress = process.env.PYTH_ENDPOINT_ADDRESS || PYTH_ENDPOINT_TESTNET;

  // Price feed IDs
  const BTC_PRICE_ID = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72fc6562aedb9';
  const ETH_PRICE_ID = '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';
  const CFX_PRICE_ID = '0x0000000000000000000000000000000000000000000000000000000000000000'; // placeholder
  const USDC_PRICE_ID = '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a';

  // Deploy PriceConsumer
  const PriceConsumer = await ethers.getContractFactory('PriceConsumer');
  const priceConsumer = await PriceConsumer.deploy(
    pythAddress, BTC_PRICE_ID, ETH_PRICE_ID, CFX_PRICE_ID, USDC_PRICE_ID
  );
  await priceConsumer.waitForDeployment();
  console.log('PriceConsumer deployed to:', await priceConsumer.getAddress());

  // Deploy PriceTrigger (BTC above $70,000)
  const PriceTrigger = await ethers.getContractFactory('PriceTrigger');
  const priceTrigger = await PriceTrigger.deploy(pythAddress, BTC_PRICE_ID, 70000000000, true);
  await priceTrigger.waitForDeployment();
  console.log('PriceTrigger deployed to:', await priceTrigger.getAddress());

  // Deploy MockLendingProtocol
  const MockLending = await ethers.getContractFactory('MockLendingProtocol');
  const mockLending = await MockLending.deploy(pythAddress, BTC_PRICE_ID);
  await mockLending.waitForDeployment();
  console.log('MockLendingProtocol deployed to:', await mockLending.getAddress());

  // Deploy PricePredictionMarket
  const PredictionMarket = await ethers.getContractFactory('PricePredictionMarket');
  const predictionMarket = await PredictionMarket.deploy(pythAddress, BTC_PRICE_ID);
  await predictionMarket.waitForDeployment();
  console.log('PricePredictionMarket deployed to:', await predictionMarket.getAddress());

  console.log('\nDeployment complete!');
  console.log('Pyth Endpoint:', pythAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

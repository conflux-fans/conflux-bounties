import { ethers, run, network } from 'hardhat';

// Swappi V2 addresses on Conflux eSpace
const SWAPPI_ADDRESSES: Record<string, { router: string; factory: string }> = {
  espaceTestnet: {
    router: '0x873789aaF553FD0B4252d0D2b72C6331c47aff2E',
    factory: '0x36B83E0D41D1dd9C73a006F0c1cbC1F096E69E34', // confirmed working (198 pairs)
  },
  espaceMainnet: {
    router:  '0xE37B52296b0bAA91412cD0Cd97975B0805037B84',  // Swappi v2 router — confirmed deployed (only one with bytecode)
    factory: '0xe2a6f7c0ce4d5d300f97aa7e125455f5cd3342f5',  // real factory — from router.factory() call; 0x20b45b8a... had no code
  },
  hardhat: {
    // Will be replaced by mock in tests
    router: ethers.ZeroAddress,
    factory: ethers.ZeroAddress,
  },
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;

  console.log(`Deploying to ${networkName} with account: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceCFX = parseFloat(ethers.formatEther(balance));
  console.log(`Balance: ${balanceCFX.toFixed(4)} CFX`);

  // Pre-flight: refuse to deploy with insufficient balance
  const MIN_CFX: Record<string, number> = { espaceTestnet: 0.1, espaceMainnet: 0.5 };
  const minRequired = MIN_CFX[networkName];
  if (minRequired !== undefined && balanceCFX < minRequired) {
    console.error(`\n❌  Insufficient balance (${balanceCFX.toFixed(4)} CFX). Minimum required for ${networkName}: ${minRequired} CFX`);
    console.error(`   Fund the deployer wallet ${deployer.address} before proceeding.\n`);
    process.exit(1);
  }

  const swappiAddrs = SWAPPI_ADDRESSES[networkName] ?? SWAPPI_ADDRESSES.hardhat;

  // 1. Deploy SwappiPriceAdapter
  console.log('\n[1/3] Deploying SwappiPriceAdapter…');
  const PriceAdapterFactory = await ethers.getContractFactory('SwappiPriceAdapter');
  const priceAdapter = await PriceAdapterFactory.deploy(
    swappiAddrs.router,
    swappiAddrs.factory,
    deployer.address,
  );
  await priceAdapter.waitForDeployment();
  const priceAdapterAddress = await priceAdapter.getAddress();
  console.log(`  SwappiPriceAdapter: ${priceAdapterAddress}`);

  // 2. Deploy AutomationManager
  console.log('[2/3] Deploying AutomationManager…');
  const AutomationManagerFactory = await ethers.getContractFactory('AutomationManager');
  const automationManager = await AutomationManagerFactory.deploy(
    priceAdapterAddress,
    deployer.address,
  );
  await automationManager.waitForDeployment();
  const automationManagerAddress = await automationManager.getAddress();
  console.log(`  AutomationManager: ${automationManagerAddress}`);

  // 3. Deploy PermitHandler
  console.log('[3/3] Deploying PermitHandler…');
  const PermitHandlerFactory = await ethers.getContractFactory('PermitHandler');
  const permitHandler = await PermitHandlerFactory.deploy();
  await permitHandler.waitForDeployment();
  const permitHandlerAddress = await permitHandler.getAddress();
  console.log(`  PermitHandler: ${permitHandlerAddress}`);

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log('\n=== Deployment Summary ===');
  console.log(JSON.stringify({
    network: networkName,
    deployer: deployer.address,
    SwappiPriceAdapter: priceAdapterAddress,
    AutomationManager: automationManagerAddress,
    PermitHandler: permitHandlerAddress,
  }, null, 2));

  // ─── .env snippet ─────────────────────────────────────────────────────────
  console.log('\n=== Add to your .env ===');
  console.log(`AUTOMATION_MANAGER_ADDRESS=${automationManagerAddress}`);
  console.log(`PRICE_ADAPTER_ADDRESS=${priceAdapterAddress}`);
  console.log(`PERMIT_HANDLER_ADDRESS=${permitHandlerAddress}`);
  if (networkName === 'espaceMainnet') {
    console.log(`NEXT_PUBLIC_AUTOMATION_MANAGER_ADDRESS=${automationManagerAddress}`);
    console.log(`NETWORK=mainnet`);
    console.log(`NEXT_PUBLIC_NETWORK=mainnet`);
  } else {
    console.log(`NEXT_PUBLIC_AUTOMATION_MANAGER_ADDRESS=${automationManagerAddress}`);
  }

  // ─── Verify on Conflux eSpace explorer (if not local) ────────────────────
  if (networkName !== 'hardhat') {
    console.log('\nWaiting 10s before verification…');
    await new Promise(r => setTimeout(r, 10_000));

    try {
      await run('verify:verify', {
        address: priceAdapterAddress,
        constructorArguments: [swappiAddrs.router, swappiAddrs.factory, deployer.address],
      });
      await run('verify:verify', {
        address: automationManagerAddress,
        constructorArguments: [priceAdapterAddress, deployer.address],
      });
      await run('verify:verify', { address: permitHandlerAddress, constructorArguments: [] });
    } catch (e: unknown) {
      console.warn('Verification failed (may already be verified):', (e as Error).message);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

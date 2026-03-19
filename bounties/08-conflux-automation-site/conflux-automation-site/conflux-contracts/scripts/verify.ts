/**
 * verify.ts
 *
 * Verifies already-deployed contracts on the Conflux eSpace block explorer.
 * Reads deployed addresses from env vars (set after running deploy.ts).
 *
 * Usage (testnet):
 *   pnpm --filter @conflux-cas/contracts verify
 * Usage (mainnet):
 *   pnpm --filter @conflux-cas/contracts verify:mainnet
 *
 * Required env vars:
 *   AUTOMATION_MANAGER_ADDRESS
 *   PRICE_ADAPTER_ADDRESS
 *   PERMIT_HANDLER_ADDRESS
 *
 * Swappi addresses (used as constructor args for SwappiPriceAdapter):
 *   SWAPPI_ROUTER_ADDRESS  (optional – falls back to known addresses)
 *   SWAPPI_FACTORY_ADDRESS (optional – falls back to known addresses)
 */

import { run, network, ethers } from 'hardhat';

// Known Swappi addresses — used only as constructor arg hints for verification
const SWAPPI: Record<string, { router: string; factory: string }> = {
  espaceTestnet: {
    router:  '0x873789aaF553FD0B4252d0D2b72C6331c47aff2E',
    factory: '0x36B83E0D41D1dd9C73a006F0c1cbC1F096E69E34',
  },
  espaceMainnet: {
    router:  '0xE37B52296b0bAA91412cD0Cd97975B0805037B84',  // Swappi v2 router — confirmed deployed (only one with bytecode)
    factory: '0xe2a6f7c0ce4d5d300f97aa7e125455f5cd3342f5',  // real factory — from router.factory() call; 0x20b45b8a... had no code
  },
};

async function verifyContract(
  label: string,
  address: string,
  constructorArguments: unknown[],
) {
  console.log(`\n[verify] ${label} @ ${address}`);
  try {
    await run('verify:verify', { address, constructorArguments });
    console.log(`  ✅  Verified`);
  } catch (e: unknown) {
    const msg = (e as Error).message ?? String(e);
    if (msg.toLowerCase().includes('already verified')) {
      console.log(`  ℹ️   Already verified`);
    } else if (msg.toLowerCase().includes('constructor_args_not_match')) {
      // Known ConfluxScan bug with viaIR-compiled contracts.
      // Sourcify verification (enabled in hardhat.config.ts) still succeeds — check
      // https://repo.sourcify.dev/contracts/full_match/1030/<address>/
      console.log(`  ℹ️   ConfluxScan constructor_args mismatch (viaIR limitation) — check Sourcify for ✅`);
    } else {
      console.warn(`  ⚠️   Verification failed: ${msg}`);
    }
  }
}

async function main() {
  const networkName = network.name;
  if (networkName === 'hardhat') {
    console.error('❌  Cannot verify on the in-memory Hardhat network. Use --network espaceTestnet or --network espaceMainnet.');
    process.exit(1);
  }

  console.log(`\nVerifying contracts on ${networkName}…`);

  // ─── Resolve addresses ───────────────────────────────────────────────────

  const automationManager = process.env.AUTOMATION_MANAGER_ADDRESS;
  const priceAdapter      = process.env.PRICE_ADAPTER_ADDRESS;
  const permitHandler     = process.env.PERMIT_HANDLER_ADDRESS;

  const missing = [
    !automationManager && 'AUTOMATION_MANAGER_ADDRESS',
    !priceAdapter      && 'PRICE_ADAPTER_ADDRESS',
    !permitHandler     && 'PERMIT_HANDLER_ADDRESS',
  ].filter(Boolean);

  if (missing.length > 0) {
    console.error(`\n❌  Missing required env vars: ${missing.join(', ')}`);
    console.error('    Run deploy.ts first and copy the printed .env snippet.\n');
    process.exit(1);
  }

  const swappi  = SWAPPI[networkName] ?? SWAPPI.espaceTestnet;
  const router  = process.env.SWAPPI_ROUTER_ADDRESS  ?? swappi.router;
  const factory = process.env.SWAPPI_FACTORY_ADDRESS ?? swappi.factory;

  const [deployer] = await ethers.getSigners();

  // Small delay so the explorer has indexed the deployment transactions
  console.log('Waiting 10 s for explorer indexing…');
  await new Promise(r => setTimeout(r, 10_000));

  // ─── Verify all three ────────────────────────────────────────────────────

  await verifyContract(
    'SwappiPriceAdapter',
    priceAdapter!,
    [router, factory, deployer.address],
  );

  await verifyContract(
    'AutomationManager',
    automationManager!,
    [priceAdapter!, deployer.address],
  );

  await verifyContract(
    'PermitHandler',
    permitHandler!,
    [],
  );

  console.log('\n=== Verification complete ===\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

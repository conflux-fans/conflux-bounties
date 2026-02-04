/**
 * Quick script to test RPC connectivity to Conflux nodes.
 * Usage: pnpm --filter server test:rpc
 */

const ENDPOINTS = [
  { name: "Core Mainnet", url: "https://main.confluxrpc.com", method: "cfx_getStatus" },
  { name: "eSpace Mainnet", url: "https://evm.confluxrpc.com", method: "eth_blockNumber" },
  { name: "Core Testnet", url: "https://test.confluxrpc.com", method: "cfx_getStatus" },
  { name: "eSpace Testnet", url: "https://evmtestnet.confluxrpc.com", method: "eth_blockNumber" },
];

async function testEndpoint(endpoint: { name: string; url: string; method: string }) {
  const start = performance.now();
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: endpoint.method, params: [] }),
    });
    const latency = Math.round(performance.now() - start);
    const json = await res.json();

    if (json.error) {
      console.log(`  [FAIL] ${endpoint.name} — RPC error: ${json.error.message} (${latency}ms)`);
    } else {
      console.log(`  [OK]   ${endpoint.name} — ${latency}ms`);
    }
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    console.log(`  [FAIL] ${endpoint.name} — ${err instanceof Error ? err.message : String(err)} (${latency}ms)`);
  }
}

async function main() {
  console.log("\nTesting Conflux RPC endpoints...\n");
  for (const ep of ENDPOINTS) {
    await testEndpoint(ep);
  }
  console.log("\nDone.\n");
}

main();

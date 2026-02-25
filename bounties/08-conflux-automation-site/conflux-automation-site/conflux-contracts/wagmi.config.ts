import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@wagmi/cli';
import { hardhat } from '@wagmi/cli/plugins';
import type { Plugin } from '@wagmi/cli';

// ─── Deployment registry ─────────────────────────────────────────────────────
// deployments.json is the single source of truth for deployed contract
// addresses. Updated by conflux-cas/scripts/deploy.ts after each deploy.
// Committing this file tracks the canonical on-chain state per network.
interface DeploymentRegistry {
  [chainId: string]: { [contractName: string]: string };
}

function loadDeployments(): DeploymentRegistry {
  try {
    return JSON.parse(readFileSync(resolve('./deployments.json'), 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Converts the flat deployments.json structure to wagmi's deployments format:
 *   { AutomationManager: { 1030: '0x...', 71: '0x...' } }
 */
function toWagmiDeployments(
  registry: DeploymentRegistry,
  contractNames: string[],
): Record<string, Record<number, `0x${string}`>> {
  const result: Record<string, Record<number, `0x${string}`>> = {};
  for (const name of contractNames) {
    const byChain: Record<number, `0x${string}`> = {};
    for (const [chainId, contracts] of Object.entries(registry)) {
      if (contracts[name]) {
        byChain[Number(chainId)] = contracts[name] as `0x${string}`;
      }
    }
    if (Object.keys(byChain).length > 0) result[name] = byChain;
  }
  return result;
}

const CONTRACT_NAMES = ['AutomationManager', 'SwappiPriceAdapter', 'PermitHandler'];
const deploymentRegistry = loadDeployments();
const wagmiDeployments = toWagmiDeployments(deploymentRegistry, CONTRACT_NAMES);

/**
 * Custom plugin — appends `as const` bytecode exports for each contract so
 * that `@cfxdevkit/sdk/automation` can expose them for programmatic deploys
 * without pulling in Hardhat as a dependency.
 */
function hardhatBytecodePlugin(contractNames: string[]): Plugin {
  return {
    name: 'hardhat-bytecode',
    async run() {
      const lines: string[] = [
        '',
        '// ─── Deployment bytecode ─────────────────────────────────────────────────────',
        '// Used by conflux-cas/scripts/deploy.ts via viem deployContract.',
        '// Regenerate with: pnpm contracts:codegen',
      ];
      for (const name of contractNames) {
        const artifactPath = resolve(
          `./artifacts/contracts/${name}.sol/${name}.json`,
        );
        const artifact = JSON.parse(readFileSync(artifactPath, 'utf-8')) as {
          bytecode: string;
        };
        const varName =
          name.charAt(0).toLowerCase() + name.slice(1) + 'Bytecode';
        lines.push(
          `export const ${varName} = '${artifact.bytecode}' as const;`,
        );
      }
      return { content: lines.join('\n') };
    },
  };
}

/**
 * @wagmi/cli codegen config
 *
 * Reads compiled Hardhat artifacts from ./artifacts and emits type-safe
 * `as const` ABI + address + bytecode exports to the SDK's automation source.
 *
 * Pipeline:
 *   pnpm contracts:codegen   (from monorepo root)
 *   = hardhat compile → wagmi generate
 *   → conflux-sdk/src/automation/generated.ts
 *
 * After a new deployment, update deployments.json then re-run codegen to
 * bake the new addresses into the SDK.
 */
export default defineConfig({
  out: '../conflux-sdk/src/automation/generated.ts',
  plugins: [
    hardhat({
      project: './',
      // Explicit allowlist — only our 3 production contracts
      include: [
        'AutomationManager.json',
        'SwappiPriceAdapter.json',
        'PermitHandler.json',
      ],
      // Embed deployed addresses (from deployments.json) into generated.ts.
      // This produces automationManagerAddress + automationManagerConfig per contract.
      deployments: wagmiDeployments,
    }),
    hardhatBytecodePlugin(CONTRACT_NAMES),
  ],
});


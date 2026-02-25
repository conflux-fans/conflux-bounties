/**
 * KeeperClient — viem implementation of the KeeperClient interface.
 *
 * Wraps AutomationManager contract calls for executeLimitOrder and executeDCATick.
 * The executor wallet is a keeper (not a custodian) — it cannot move user funds
 * unless the user has set an on-chain allowance for that specific swap.
 */

import { AUTOMATION_MANAGER_ABI } from '@cfxdevkit/sdk/automation';
import type { DCAJob, LimitOrderJob } from '@conflux-cas/shared';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  type Hash,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { KeeperClient as IKeeperClient } from './executor.js';
import { logger } from './logger.js';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * Decode the amountOut from a swap receipt by finding the last ERC-20
 * Transfer event whose `to` address is the job owner (the swap recipient).
 * Returns the raw amount as a decimal string, or null if not found.
 */
function decodeAmountOut(
  logs: readonly { topics: readonly string[]; data: string; address: string }[],
  owner: Address
): string | null {
  const TRANSFER_TOPIC =
    '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const ownerLower = owner.toLowerCase();
  // Walk logs in reverse — the last Transfer to owner is tokenOut
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    if (
      log.topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
      log.topics[2] &&
      `0x${log.topics[2].slice(26)}`.toLowerCase() === ownerLower
    ) {
      try {
        return BigInt(log.data).toString();
      } catch {
        return null;
      }
    }
  }
  return null;
}

// --------------------------------------------------------------------------
// Config
// --------------------------------------------------------------------------
export interface KeeperClientConfig {
  /** RPC endpoint for Conflux eSpace */
  rpcUrl: string;
  /** Hex private key (0x-prefixed) of the keeper wallet */
  privateKey: `0x${string}`;
  /** Deployed AutomationManager contract address */
  contractAddress: Address;
  /**
   * Swappi router address.
   * Testnet:  0x873789aaf553fd0b4252d0d2b72c6331c47aff2e
   * Mainnet:  0xE37B52296b0bAA91412cD0Cd97975B0805037B84  (Swappi v2 — only address with deployed code; old 0x62B0873... has no bytecode)
   */
  swappiRouter: Address;
  /**
   * Maximum gas price in gwei before aborting execution (circuit breaker).
   * Defaults to 1000 gwei.
   */
  maxGasPriceGwei?: bigint;
  /** Chain definition — pass the viem chain object (espaceTestnet / espaceMainnet) */
  chain: Parameters<typeof createWalletClient>[0]['chain'];
  /** RPC request timeout in milliseconds (applies to read/simulate/write calls). */
  rpcTimeoutMs?: number;
}

// --------------------------------------------------------------------------
// KeeperClientImpl
// --------------------------------------------------------------------------
export class KeeperClientImpl implements IKeeperClient {
  private readonly walletClient;
  private readonly publicClient;
  private readonly contractAddress: Address;
  private readonly swappiRouter: Address;
  private readonly maxGasPriceGwei: bigint;
  private readonly rpcTimeoutMs: number;
  private readonly account;

  constructor(config: KeeperClientConfig) {
    this.account = privateKeyToAccount(config.privateKey);
    this.contractAddress = config.contractAddress;
    this.swappiRouter = config.swappiRouter;
    this.maxGasPriceGwei = config.maxGasPriceGwei ?? 1000n;
    this.rpcTimeoutMs = config.rpcTimeoutMs ?? 120_000; // default 2 minutes

    this.publicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    });

    this.walletClient = createWalletClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
      account: this.account,
    });
  }

  private withTimeout<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    timeoutMs = this.rpcTimeoutMs
  ): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fn(controller.signal).finally(() => clearTimeout(id));
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /**
   * Query the on-chain status of a job.
   * Returns one of: 'active' | 'executed' | 'cancelled' | 'expired'.
   * Throws if the contract call fails (e.g. job not found).
   */
  async getOnChainStatus(
    onChainJobId: `0x${string}`
  ): Promise<'active' | 'executed' | 'cancelled' | 'expired'> {
    const job = (await this.withTimeout((signal) =>
      this.publicClient.readContract({
        address: this.contractAddress,
        abi: AUTOMATION_MANAGER_ABI,
        functionName: 'getJob',
        args: [onChainJobId],
        signal,
      })
    )) as { status: number };
    // JobStatus enum: 0=ACTIVE, 1=EXECUTED, 2=CANCELLED, 3=EXPIRED
    switch (job.status) {
      case 0:
        return 'active';
      case 1:
        return 'executed';
      case 2:
        return 'cancelled';
      case 3:
        return 'expired';
      default:
        return 'cancelled'; // unknown → treat as cancelled (stop retrying)
    }
  }

  /** Guard: abort if chain is paused or gas price is too high */
  private async preflightCheck(): Promise<void> {
    // Check on-chain pause flag
    const isPaused = await this.withTimeout((signal) =>
      this.publicClient.readContract({
        address: this.contractAddress,
        abi: AUTOMATION_MANAGER_ABI,
        functionName: 'paused',
        signal,
      })
    );
    if (isPaused) {
      throw new Error('AutomationManager is paused on-chain');
    }

    // Check gas price circuit breaker (getGasPrice doesn't accept AbortSignal,
    // so we race it against a plain timeout promise instead)
    const gasPrice = await Promise.race([
      this.publicClient.getGasPrice(),
      new Promise<never>((_, rej) =>
        setTimeout(
          () => rej(new Error('getGasPrice timeout')),
          this.rpcTimeoutMs
        )
      ),
    ]);
    const gasPriceGwei = gasPrice / 1_000_000_000n;
    if (gasPriceGwei > this.maxGasPriceGwei) {
      throw new Error(
        `Gas price ${gasPriceGwei} gwei exceeds cap ${this.maxGasPriceGwei} gwei`
      );
    }
  }

  /**
   * Build minimal swap calldata for a token-in/token-out pair via Swappi.
   *
   * In a production keeper the calldata would be built via a DEX aggregator
   * (e.g. OKX DEX API) to get optimal routing.  For the MVP we encode the
   * simplest Swappi path: `swapExactTokensForTokens(amountIn, minOut, path, to, deadline)`.
   *
   * NOTE: The AutomationManager does NOT use this calldata for custody;
   * it only uses it to call the router on behalf of the user's pre-approved allowance.
   */
  private buildSwapCalldata(
    tokenIn: Address,
    tokenOut: Address,
    amountIn: bigint,
    minAmountOut: bigint,
    recipient: Address
  ): `0x${string}` {
    // swapExactTokensForTokens(uint256,uint256,address[],address,uint256)
    // selector = 0x38ed1739
    const selector = '38ed1739';
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 min — 5 min was too tight and caused EXPIRED reverts

    const encode256 = (n: bigint) => n.toString(16).padStart(64, '0');
    const encodeAddr = (a: string) =>
      a.slice(2).toLowerCase().padStart(64, '0');

    // path is dynamic array: offset + length + [tokenIn, tokenOut]
    const pathOffset = (5 * 32).toString(16).padStart(64, '0'); // 5 static params before dynamic
    const pathLength = encode256(2n);
    const pathData = encodeAddr(tokenIn) + encodeAddr(tokenOut);

    const calldata =
      '0x' +
      selector +
      encode256(amountIn) +
      encode256(minAmountOut) +
      pathOffset +
      encodeAddr(recipient) +
      encode256(deadline) +
      pathLength +
      pathData;

    return calldata as `0x${string}`;
  }

  // --------------------------------------------------------------------------
  // IKeeperClient interface implementation
  // --------------------------------------------------------------------------

  async executeLimitOrder(
    jobId: string,
    owner: string,
    params: LimitOrderJob['params']
  ): Promise<{ txHash: string; amountOut: string | null }> {
    await this.preflightCheck();

    const amountIn = BigInt(params.amountIn);
    // Pass 0 for the router-level minAmountOut so the router never reverts due
    // to slippage — the AutomationManager contract enforces params.minAmountOut
    // via a post-swap balanceOf check, which is the canonical guard.
    // Using a non-zero value here causes double-enforcement and makes the router
    // silently return success=false ("Swap failed") instead of the clearer
    // on-chain "Slippage exceeded" revert from the contract.
    const minAmountOut = 0n;

    const swapCalldata = this.buildSwapCalldata(
      params.tokenIn as Address,
      params.tokenOut as Address,
      amountIn,
      minAmountOut,
      owner as Address
    );

    logger.info(
      {
        jobId,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn,
      },
      '[KeeperClient] executeLimitOrder'
    );

    // Simulate first — throws with a decoded revert reason if it would fail,
    // saving gas and giving us actionable error messages.
    try {
      await this.withTimeout((signal) =>
        this.publicClient.simulateContract({
          address: this.contractAddress,
          abi: AUTOMATION_MANAGER_ABI,
          functionName: 'executeLimitOrder',
          args: [jobId as `0x${string}`, this.swappiRouter, swapCalldata],
          account: this.account.address,
          signal,
        })
      );
    } catch (simErr: unknown) {
      const msg = simErr instanceof Error ? simErr.message : String(simErr);
      logger.error(
        { jobId, error: msg.slice(0, 500) },
        '[KeeperClient] executeLimitOrder simulation reverted'
      );
      throw simErr;
    }

    const hash: Hash = await this.withTimeout((signal) =>
      this.walletClient.writeContract({
        address: this.contractAddress,
        abi: AUTOMATION_MANAGER_ABI,
        functionName: 'executeLimitOrder',
        args: [jobId as `0x${string}`, this.swappiRouter, swapCalldata],
        chain: undefined,
        account: this.account,
        signal,
      })
    );

    logger.info({ jobId, hash }, '[KeeperClient] limitOrder tx submitted');

    const receipt = await Promise.race([
      this.publicClient.waitForTransactionReceipt({ hash } as any),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('waitForTransactionReceipt timeout')), this.rpcTimeoutMs)
      ),
    ]);
    if ((receipt as any).status !== 'success') {
      // Re-simulate to surface a decoded revert reason the executor can act on.
      let reason: string = (hash as string) ?? 'unknown';
      try {
        await this.withTimeout((signal) =>
          this.publicClient.simulateContract({
            address: this.contractAddress,
            abi: AUTOMATION_MANAGER_ABI,
            functionName: 'executeLimitOrder',
            args: [jobId as `0x${string}`, this.swappiRouter, swapCalldata],
            account: this.account.address,
            signal,
          })
        );
      } catch (simErr: unknown) {
        if (simErr instanceof Error) reason = simErr.message;
      }
      throw new Error(`Limit order tx reverted: ${reason}`);
    }

    const amountOut = decodeAmountOut(receipt.logs, owner as Address);
    logger.info(
      { jobId, hash, blockNumber: receipt.blockNumber.toString(), amountOut },
      '[KeeperClient] limitOrder confirmed'
    );
    return { txHash: hash, amountOut };
  }

  async executeDCATick(
    jobId: string,
    owner: string,
    params: DCAJob['params']
  ): Promise<{ txHash: string; amountOut: string | null; nextExecutionSec: number }> {
    await this.preflightCheck();

    // ── On-chain preflight: verify the DCA interval has actually been reached ──
    // The DB's nextExecution may be in wrong units (ms vs seconds) or stale.
    // The contract is authoritative — check before simulating to avoid wasting
    // gas and to surface a clean early error instead of a revert.
    const onChainParams = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: AUTOMATION_MANAGER_ABI,
      functionName: 'getDCAJob',
      args: [jobId as `0x${string}`],
    })) as {
      intervalSeconds: bigint;
      nextExecution: bigint;
      swapsCompleted: bigint;
      totalSwaps: bigint;
    };
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    if (nowSec < onChainParams.nextExecution) {
      throw new Error(
        `DCAIntervalNotReached(${onChainParams.nextExecution}) — on-chain interval not reached yet ` +
          `(now=${nowSec}, next=${onChainParams.nextExecution}, ` +
          `remaining=${onChainParams.nextExecution - nowSec}s)`
      );
    }

    const amountPerTick = BigInt(params.amountPerSwap);
    // For DCA, minAmountOut is calculated with a conservative 1% slippage applied
    // in the SafetyGuard; here we use 0 as the contract does its own validation.
    const minAmountOut = 0n;

    const swapCalldata = this.buildSwapCalldata(
      params.tokenIn as Address,
      params.tokenOut as Address,
      amountPerTick,
      minAmountOut,
      owner as Address
    );

    logger.info(
      {
        jobId,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountPerTick: params.amountPerSwap,
      },
      '[KeeperClient] executeDCATick'
    );

    // Simulate first — throws with a decoded revert reason if it would fail.
    try {
      await this.withTimeout((signal) =>
        this.publicClient.simulateContract({
          address: this.contractAddress,
          abi: AUTOMATION_MANAGER_ABI,
          functionName: 'executeDCATick',
          args: [jobId as `0x${string}`, this.swappiRouter, swapCalldata],
          account: this.account.address,
          signal,
        })
      );
    } catch (simErr: unknown) {
      const msg = simErr instanceof Error ? simErr.message : String(simErr);
      logger.error(
        { jobId, error: msg.slice(0, 500) },
        '[KeeperClient] executeDCATick simulation reverted'
      );
      throw simErr;
    }

    const hash: Hash = await this.withTimeout((signal) =>
      this.walletClient.writeContract({
        address: this.contractAddress,
        abi: AUTOMATION_MANAGER_ABI,
        functionName: 'executeDCATick',
        args: [jobId as `0x${string}`, this.swappiRouter, swapCalldata],
        chain: undefined,
        account: this.account,
        signal,
      })
    );

    logger.info({ jobId, hash }, '[KeeperClient] dca tx submitted');

    const receipt = await Promise.race([
      this.publicClient.waitForTransactionReceipt({ hash } as any),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('waitForTransactionReceipt timeout')), this.rpcTimeoutMs)
      ),
    ]);
    if ((receipt as any).status !== 'success') {
      // Re-simulate to surface a decoded revert reason the executor can act on.
      let reason: string = (hash as string) ?? 'unknown';
      try {
        await this.withTimeout((signal) =>
          this.publicClient.simulateContract({
            address: this.contractAddress,
            abi: AUTOMATION_MANAGER_ABI,
            functionName: 'executeDCATick',
            args: [jobId as `0x${string}`, this.swappiRouter, swapCalldata],
            account: this.account.address,
            signal,
          })
        );
      } catch (simErr: unknown) {
        if (simErr instanceof Error) reason = simErr.message;
      }
      throw new Error(`DCA tick tx reverted: ${reason}`);
    }

    const amountOut = decodeAmountOut(receipt.logs, owner as Address);
    // Re-read the contract's nextExecution after the tick so the DB is exactly
    // in sync with what the contract stored (block.timestamp_at_execution + intervalSeconds).
    // This avoids the wall-clock vs chain-clock skew that causes premature retries.
    const postTickParams = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: AUTOMATION_MANAGER_ABI,
      functionName: 'getDCAJob',
      args: [jobId as `0x${string}`],
    })) as {
      intervalSeconds: bigint;
      nextExecution: bigint;
      swapsCompleted: bigint;
      totalSwaps: bigint;
    };
    const nextExecutionSec = Number(postTickParams.nextExecution);
    logger.info(
      { jobId, hash, blockNumber: receipt.blockNumber.toString(), amountOut, nextExecutionSec },
      '[KeeperClient] dca confirmed'
    );
    return { txHash: hash, amountOut, nextExecutionSec };
  }
}

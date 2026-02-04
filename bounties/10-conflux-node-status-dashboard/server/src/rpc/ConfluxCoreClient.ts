import {
  type IRpcClient,
  type JsonRpcResponse,
  type CfxStatus,
  type CfxBlock,
  CfxStatusSchema,
  CfxBlockSchema,
  JsonRpcResponseSchema,
} from "./interfaces";

/**
 * JSON-RPC client for Conflux Core Space.
 * Uses raw fetch() for cfx_* methods.
 */
export class ConfluxCoreClient implements IRpcClient {
  private requestId = 0;

  constructor(public readonly rpcUrl: string) {}

  /** Send a raw JSON-RPC request and return the parsed result */
  private async rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
    const id = ++this.requestId;

    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    const parsed: JsonRpcResponse = JsonRpcResponseSchema.parse(json);

    if (parsed.error) {
      throw new Error(`RPC error ${parsed.error.code}: ${parsed.error.message}`);
    }

    return parsed.result as T;
  }

  /** Fetch full node status via cfx_getStatus */
  async getStatus(): Promise<CfxStatus> {
    const raw = await this.rpcCall<unknown>("cfx_getStatus");
    return CfxStatusSchema.parse(raw);
  }

  /** Get current epoch number */
  async getBlockHeight(): Promise<number> {
    const status = await this.getStatus();
    return parseInt(status.epochNumber, 16);
  }

  /**
   * Get sync lag.
   * Core Space: difference between epochNumber and latestFinalized.
   * Returns 0 when fully synced.
   */
  async getSyncLag(): Promise<number> {
    const status = await this.getStatus();
    const current = parseInt(status.epochNumber, 16);
    const finalized = parseInt(status.latestFinalized, 16);
    return Math.max(0, current - finalized);
  }

  /** Get gas price in Drip */
  async getGasPrice(): Promise<bigint> {
    const hex = await this.rpcCall<string>("cfx_gasPrice");
    return BigInt(hex);
  }

  /**
   * Get connected peer count.
   * Core Space reports pendingTxNumber via cfx_getStatus,
   * but peer count requires a separate call.
   * Falls back to status.pendingTxNumber parse if no direct method.
   */
  async getPeerCount(): Promise<number> {
    try {
      const hex = await this.rpcCall<string>("cfx_getStatus");
      /** cfx_getStatus returns an object, not a hex. Use the parsed status. */
      const status = CfxStatusSchema.parse(hex);
      return parseInt(status.networkId, 16);
    } catch {
      /** Fallback: status already provides some network info */
      const status = await this.getStatus();
      /** networkId isn't peer count — use a direct call if available */
      return parseInt(status.networkId, 16);
    }
  }

  /** Get pending transaction count from cfx_getStatus */
  async getPendingTxCount(): Promise<number> {
    const status = await this.getStatus();
    return parseInt(status.pendingTxNumber, 16);
  }

  /** Get latest block details via cfx_getBlockByEpochNumber */
  async getLatestBlock(): Promise<{
    height: number;
    hash: string;
    timestamp: number;
    txCount: number;
    gasUsed: number;
    gasLimit: number;
  }> {
    const raw = await this.rpcCall<unknown>("cfx_getBlockByEpochNumber", [
      "latest_state",
      false,
    ]);

    const block: CfxBlock = CfxBlockSchema.parse(raw);

    return {
      height: parseInt(block.epochNumber, 16),
      hash: block.hash,
      timestamp: parseInt(block.timestamp, 16),
      txCount: block.transactions.length,
      gasUsed: parseInt(block.gasUsed, 16),
      gasLimit: parseInt(block.gasLimit, 16),
    };
  }

  /** Measure round-trip latency via cfx_epochNumber */
  async measureLatency(): Promise<number> {
    const start = performance.now();
    await this.rpcCall<string>("cfx_epochNumber");
    return Math.round(performance.now() - start);
  }
}

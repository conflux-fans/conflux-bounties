import type { AutomationLogger } from './logger.js';
import { noopLogger } from './logger.js';
import type { Job } from './types.js';

/**
 * Price source adapter interface.
 *
 * Returns the spot price of `tokenIn` denominated in `tokenOut`, scaled by
 * 1e18.  Implementations may call a DEX (Swappi, etc.), an oracle, or a mock.
 */
export interface PriceSource {
  /**
   * Returns 0n if the pair is unknown or price cannot be fetched.
   */
  getPrice(tokenIn: string, tokenOut: string): Promise<bigint>;
}

export interface PriceCheckResult {
  conditionMet: boolean;
  currentPrice: bigint;
  targetPrice: bigint;
  swapUsd: number;
}

/**
 * Callback that resolves a token address to its ERC-20 decimal count.
 * Implementations should cache the result for performance.
 */
export type DecimalsResolver = (token: string) => Promise<number>;

/** Default resolver — assumes 18 decimals for every token. */
const defaultDecimalsResolver: DecimalsResolver = async () => 18;

/**
 * PriceChecker – queries a price source and evaluates whether a job's
 * trigger condition is currently met.
 */
export class PriceChecker {
  private source: PriceSource;
  private tokenPricesUsd: Map<string, number>;
  /**
   * Resolves a token's decimal count.  Called lazily when _estimateUsd needs
   * to convert raw wei amounts into human-readable values.  The resolver may
   * query the chain, a static map, or simply return 18.
   */
  private getDecimals: DecimalsResolver;
  private readonly log: AutomationLogger;

  constructor(
    source: PriceSource,
    tokenPricesUsd: Map<string, number> = new Map(),
    logger: AutomationLogger = noopLogger,
    getDecimals: DecimalsResolver = defaultDecimalsResolver
  ) {
    this.source = source;
    this.tokenPricesUsd = tokenPricesUsd;
    this.getDecimals = getDecimals;
    this.log = logger;
  }

  async checkLimitOrder(
    job: Job & { type: 'limit_order' }
  ): Promise<PriceCheckResult> {
    const params = job.params;
    const currentPrice = await this.source.getPrice(
      params.tokenIn,
      params.tokenOut
    );
    const targetPrice = BigInt(params.targetPrice);

    let conditionMet: boolean;
    if (params.direction === 'gte') {
      conditionMet = currentPrice >= targetPrice;
    } else {
      conditionMet = currentPrice <= targetPrice;
    }

    const swapUsd = await this._estimateUsd(params.tokenIn, params.amountIn);

    this.log.debug(
      {
        jobId: job.id,
        currentPrice: currentPrice.toString(),
        targetPrice: targetPrice.toString(),
        conditionMet,
        swapUsd,
      },
      '[PriceChecker] limit-order check'
    );

    return { conditionMet, currentPrice, targetPrice, swapUsd };
  }

  async checkDCA(job: Job & { type: 'dca' }): Promise<PriceCheckResult> {
    const params = job.params;
    // DCA has no price condition — just verify the interval has been reached.
    // We add a 15-second buffer before declaring conditionMet so that by the
    // time the transaction is mined the on-chain block.timestamp is also
    // reliably past nextExecution, avoiding DCAIntervalNotReached reverts at
    // the execution boundary.
    const DCA_EXECUTION_BUFFER_MS = 15_000;
    const conditionMet = Date.now() >= params.nextExecution + DCA_EXECUTION_BUFFER_MS;
    const currentPrice = await this.source.getPrice(
      params.tokenIn,
      params.tokenOut
    );
    const swapUsd = await this._estimateUsd(params.tokenIn, params.amountPerSwap);

    this.log.debug(
      {
        jobId: job.id,
        nextExecution: params.nextExecution,
        conditionMet,
        swapUsd,
      },
      '[PriceChecker] DCA check'
    );

    return { conditionMet, currentPrice, targetPrice: 0n, swapUsd };
  }

  updateTokenPrice(token: string, usdPrice: number): void {
    this.tokenPricesUsd.set(token.toLowerCase(), usdPrice);
  }

  private async _estimateUsd(token: string, amountWei: string): Promise<number> {
    const usdPerToken = this.tokenPricesUsd.get(token.toLowerCase()) ?? 0;
    // Resolve the token's actual decimal count (on-chain or cached).
    const decimals = await this.getDecimals(token);
    const divisor = 10 ** decimals;
    const amount = Number(BigInt(amountWei)) / divisor;
    return amount * usdPerToken;
  }
}

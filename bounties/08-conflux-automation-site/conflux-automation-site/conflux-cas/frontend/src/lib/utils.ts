/** Error parser for clean UX messages */
export function parseError(err: unknown): string {
  const msg = (err as Error)?.message || String(err);

  // ── Custom contract errors ─────────────────────────────────────────────

  // TooManyJobs: user has hit the per-address active job cap.
  if (msg.includes('TooManyJobs')) {
    return 'You have reached the maximum number of active jobs. Cancel an existing job to free a slot before creating a new one.';
  }

  // SlippageTooHigh: contract rejects slippage > 5% at creation time.
  if (msg.includes('SlippageTooHigh')) {
    const m = msg.match(/SlippageTooHigh\((\d+),\s*(\d+)\)/);
    if (m) {
      const requested = parseInt(m[1], 10) / 100;
      const allowed = parseInt(m[2], 10) / 100;
      return `Slippage ${requested}% exceeds the contract maximum of ${allowed}%. Please lower your slippage.`;
    }
    return 'Slippage value is too high for this contract. Maximum is 5%. Please lower it and try again.';
  }

  // InvalidParams: contract-level validation of job parameters.
  if (msg.includes('InvalidParams')) {
    const m = msg.match(/InvalidParams\("(.*?)"\)/);
    if (m) return `Invalid parameters: ${m[1]}`;
    return 'Invalid job parameters. Check your inputs and try again.';
  }

  // JobNotActive / JobNotFound: stale UI state.
  if (msg.includes('JobNotActive')) {
    return 'This job is no longer active. Refresh the page to see its current status.';
  }
  if (msg.includes('JobNotFound')) {
    return 'Job not found on-chain. It may have already been removed.';
  }

  // JobExpiredError: job passed its expiry timestamp.
  if (msg.includes('JobExpiredError')) {
    return 'This job has expired and cannot be executed.';
  }

  // DCACompleted: all swaps for this DCA are done.
  if (msg.includes('DCACompleted')) {
    return 'This DCA job has already completed all its scheduled swaps.';
  }

  // DCAIntervalNotReached: keeper fired too early.
  if (msg.includes('DCAIntervalNotReached')) {
    return 'DCA interval has not elapsed yet. The keeper will retry at the next scheduled time.';
  }

  // PriceConditionNotMet: limit order price not reached.
  if (msg.includes('PriceConditionNotMet')) {
    return 'Price condition not met — the market price has not reached your target yet.';
  }

  // EnforcedPause: contract is paused by the owner.
  if (msg.includes('EnforcedPause')) {
    return 'The contract is currently paused. Please try again later.';
  }

  // Unauthorized / OwnableUnauthorizedAccount.
  if (
    msg.includes('Unauthorized') ||
    msg.includes('OwnableUnauthorizedAccount')
  ) {
    return 'Your wallet is not authorised to perform this action.';
  }

  // ZeroAddress: a required address was not provided.
  if (msg.includes('ZeroAddress')) {
    return 'A zero address was passed — this is a configuration error. Please contact support.';
  }

  // SafeERC20FailedOperation: token transfer failed (e.g. insufficient balance/allowance).
  if (msg.includes('SafeERC20FailedOperation')) {
    return 'Token transfer failed. Make sure you have approved enough tokens or have sufficient balance.';
  }

  // ReentrancyGuardReentrantCall: should never happen from the frontend.
  if (msg.includes('ReentrancyGuardReentrantCall')) {
    return 'Reentrancy detected — please do not double-click. Wait for the current transaction to confirm.';
  }

  // ── Execution-time slippage ────────────────────────────────────────────
  // NOTE: do NOT catch the generic word "slippage" — viem embeds parameter
  // names like "minAmountOut" in full error messages which would mask real errors.
  if (msg.includes('Slippage exceeded')) {
    return 'Execution failed: swap output was below the minimum. The keeper will retry automatically.';
  }

  // ── Contract validation string failures ───────────────────────────────
  if (
    msg.includes('"minAmountOut is zero"') ||
    msg.includes("'minAmountOut is zero'")
  ) {
    return 'Minimum output is zero — ensure a target price is set and retry.';
  }
  if (
    msg.includes('"amountIn is zero"') ||
    msg.includes("'amountIn is zero'")
  ) {
    return 'Please enter an amount to sell.';
  }
  if (
    msg.includes('"targetPrice is zero"') ||
    msg.includes("'targetPrice is zero'")
  ) {
    return 'Please enter a target price.';
  }

  // ── Wallet / RPC errors ───────────────────────────────────────────────
  if (msg.includes('insufficient funds')) {
    return 'Insufficient funds for gas or token transfer.';
  }
  if (msg.includes('User rejected') || msg.includes('user rejected')) {
    return 'Transaction was rejected in your wallet.';
  }
  if (msg.includes('could not be found') || msg.includes('timed out')) {
    return 'Transaction confirmation timed out — it may still confirm. Check your wallet activity.';
  }

  // ── Generic revert reason extraction ─────────────────────────────────
  // viem format: Error: SomeName("human reason")
  const match = msg.match(/Error: ([A-Za-z0-9_]+)\("(.*?)"\)/);
  if (match) {
    return `Transaction reverted: ${match[2] || match[1]}`;
  }

  const maxLen = 200;
  return msg.length > maxLen ? `${msg.substring(0, maxLen)}…` : msg;
}

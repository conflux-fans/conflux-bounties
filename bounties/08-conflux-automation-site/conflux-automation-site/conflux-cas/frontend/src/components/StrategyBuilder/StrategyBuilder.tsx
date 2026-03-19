'use client';

import type { DCAJob, Job, LimitOrderJob } from '@conflux-cas/shared';
import {
  ArrowDown,
  CheckCircle2,
  ChevronDown,
  Info,
  RefreshCcw,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Address, formatUnits, parseEventLogs, parseUnits } from 'viem';
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWriteContract,
} from 'wagmi';
import {
  CFX_NATIVE_ADDRESS,
  getPairedTokens,
  resolveTokenInAddress,
  type TokenWithBalance,
  wcfxAddress,
} from '@/hooks/usePoolTokens';
import { useTokenPrice } from '@/hooks/useTokenPrice';
import { useAuthContext } from '@/lib/auth-context';
import {
  AUTOMATION_MANAGER_ABI,
  AUTOMATION_MANAGER_ADDRESS,
  ERC20_ABI,
  MAX_UINT256,
  WCFX_ABI,
} from '@/lib/contracts';
import { usePoolsContext } from '@/lib/pools-context';

type StrategyKind = 'limit_order' | 'dca';

// ── Tx stepper types ──────────────────────────────────────────────────────────
type TxStepId = 'wrap' | 'approve' | 'onchain' | 'save';
type TxStepStatus =
  | 'idle'
  | 'active'
  | 'waiting'
  | 'done'
  | 'skipped'
  | 'error';
interface TxStepDef {
  id: TxStepId;
  label: string;
  detail: string;
  status: TxStepStatus;
  txHash?: `0x${string}`;
}

function _toWeiString(humanValue: string, decimals = 18): string {
  const trimmed = humanValue.trim();
  if (!trimmed || trimmed === '0') return '0';
  return parseUnits(trimmed, decimals).toString();
}

/** Format a balance string for display, capped to 6 significant digits */
function fmtBalance(b: string): string {
  const n = parseFloat(b);
  if (!n) return '';
  if (n < 0.000001) return '<0.000001';
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function StrategyBuilder({
  onSuccess,
  onSubmittingChange,
}: {
  onSuccess?: () => void;
  onSubmittingChange?: (v: boolean) => void;
} = {}) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { token } = useAuthContext();

  const {
    tokens,
    pairs,
    loading: poolsLoading,
    balancesLoading,
    error: poolsError,
    rpcWarning,
    refresh,
  } = usePoolsContext();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [kind, setKind] = useState<StrategyKind>('limit_order');
  const [submitting, setSubmitting] = useState(false);
  const [txSteps, setTxSteps] = useState<TxStepDef[] | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unlimitedApproval, setUnlimitedApproval] = useState(false);

  // Notify parent (e.g. StrategyModal) when the stepper overlay becomes visible
  // so it can block the close button until all transactions complete.
  useEffect(() => {
    onSubmittingChange?.(txSteps !== null);
  }, [onSubmittingChange, txSteps]);

  // Update a single step's status and detail atomically
  const setStep = useCallback(
    (
      id: TxStepId,
      status: TxStepStatus,
      detail: string,
      txHash?: `0x${string}`
    ) => {
      setTxSteps(
        (prev) =>
          prev?.map((s) =>
            s.id === id
              ? { ...s, status, detail, ...(txHash ? { txHash } : {}) }
              : s
          ) ?? prev
      );
    },
    []
  );

  // Shared fields
  const [tokenIn, setTokenIn] = useState('');
  const [tokenOut, setTokenOut] = useState('');
  const [slippage, setSlippage] = useState('50'); // bps

  // Derived token info from pool list
  const tokenInInfo = useMemo(
    () => tokens.find((t) => t.address === tokenIn),
    [tokens, tokenIn]
  );
  const tokenOutInfo = useMemo(
    () => tokens.find((t) => t.address === tokenOut),
    [tokens, tokenOut]
  );
  const tokenOutOptions = useMemo(
    () => getPairedTokens(pairs, tokens, tokenIn),
    [pairs, tokens, tokenIn]
  );

  // ── Verified decimals ──────────────────────────────────────────────────────
  // GeckoTerminal may omit decimals for some tokens (returns null).  We keep a
  // per-address cache and do a single on-chain `decimals()` read the first time
  // a token with null decimals is selected.  Native CFX is always 18.
  const verifiedDecimalsRef = useRef<Map<string, number>>(new Map());
  const [tokenInDecimals, setTokenInDecimals] = useState<number>(18);
  const [tokenOutDecimals, setTokenOutDecimals] = useState<number>(18);

  const DECIMALS_ABI = [
    {
      name: 'decimals',
      type: 'function' as const,
      stateMutability: 'view' as const,
      inputs: [],
      outputs: [{ name: '', type: 'uint8' }],
    },
  ] as const;

  useEffect(() => {
    if (
      !tokenIn ||
      tokenIn.toLowerCase() === CFX_NATIVE_ADDRESS.toLowerCase()
    ) {
      setTokenInDecimals(18);
      return;
    }
    const verified = verifiedDecimalsRef.current.get(tokenIn.toLowerCase());
    if (verified != null) {
      setTokenInDecimals(verified);
      return;
    }
    if (tokenInInfo?.decimals != null) {
      setTokenInDecimals(tokenInInfo.decimals);
      return;
    }
    // decimals are null — fetch from the ERC-20 contract
    if (!publicClient) {
      setTokenInDecimals(18);
      return;
    }
    publicClient
      .readContract({
        address: tokenIn as Address,
        abi: DECIMALS_ABI,
        functionName: 'decimals',
      })
      .then((d) => {
        const n = Number(d);
        verifiedDecimalsRef.current.set(tokenIn.toLowerCase(), n);
        setTokenInDecimals(n);
      })
      .catch(() => setTokenInDecimals(18));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenIn, tokenInInfo?.decimals, publicClient, DECIMALS_ABI]);

  useEffect(() => {
    if (
      !tokenOut ||
      tokenOut.toLowerCase() === CFX_NATIVE_ADDRESS.toLowerCase()
    ) {
      setTokenOutDecimals(18);
      return;
    }
    const verified = verifiedDecimalsRef.current.get(tokenOut.toLowerCase());
    if (verified != null) {
      setTokenOutDecimals(verified);
      return;
    }
    if (tokenOutInfo?.decimals != null) {
      setTokenOutDecimals(tokenOutInfo.decimals);
      return;
    }
    if (!publicClient) {
      setTokenOutDecimals(18);
      return;
    }
    publicClient
      .readContract({
        address: tokenOut as Address,
        abi: DECIMALS_ABI,
        functionName: 'decimals',
      })
      .then((d) => {
        const n = Number(d);
        verifiedDecimalsRef.current.set(tokenOut.toLowerCase(), n);
        setTokenOutDecimals(n);
      })
      .catch(() => setTokenOutDecimals(18));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenOut, tokenOutInfo?.decimals, publicClient, DECIMALS_ABI]);

  // WCFX address and balance (for wrap/unwrap utility)
  const wcfxAddr = wcfxAddress() as `0x${string}`;
  const wcfxInfo = useMemo(
    () =>
      tokens.find((t) => t.address.toLowerCase() === wcfxAddr.toLowerCase()),
    [tokens, wcfxAddr]
  );
  const tokenInIsCfx =
    tokenIn.toLowerCase() === CFX_NATIVE_ADDRESS.toLowerCase();

  // Live price from Swappi + USD prices from DeFiLlama
  const {
    swappiPrice,
    tokenInUsd,
    tokenOutUsd,
    loading: priceLoading,
    error: priceError,
    lastUpdated: _priceLastUpdated,
    refresh: refreshPrice,
  } = useTokenPrice(
    tokenIn || undefined,
    tokenOut || undefined,
    tokenInDecimals,
    tokenOutDecimals
  );

  // Token In list: prefer tokens the user holds, but always include the currently
  // selected token so switching back (or swapping in↔out) never clears the pill.
  const tokenInOptions = useMemo(() => {
    if (!address) return tokens;
    const held = tokens.filter((t) => BigInt(t.balanceWei) > 0n);
    const base = held.length > 0 ? held : tokens;
    if (tokenIn && !base.find((t) => t.address === tokenIn)) {
      const sel = tokens.find((t) => t.address === tokenIn);
      if (sel) return [sel, ...base];
    }
    return base;
  }, [tokens, address, tokenIn]);

  // Auto-select CFX as default tokenIn once token list is available
  useEffect(() => {
    if (tokenIn || tokens.length === 0) return;
    const cfx = tokens.find(
      (t) => t.address.toLowerCase() === CFX_NATIVE_ADDRESS.toLowerCase()
    );
    if (cfx) setTokenIn(cfx.address);
  }, [tokens, tokenIn]);

  // Auto-select tokenOut: prefer USDT when CFX is selected, otherwise first paired token
  useEffect(() => {
    if (tokenOut || !tokenIn || pairs.length === 0) return;
    const paired = getPairedTokens(pairs, tokens, tokenIn);
    if (paired.length === 0) return;
    const usdt = paired.find((t) => t.symbol.toUpperCase() === 'USDT');
    setTokenOut((usdt ?? paired[0]).address);
  }, [tokenIn, tokenOut, pairs, tokens]);

  // Reset amounts + target price whenever the selected pair changes
  const prevPairRef = useRef('');
  useEffect(() => {
    const pair = `${tokenIn}|${tokenOut}`;
    if (!prevPairRef.current) {
      prevPairRef.current = pair;
      return;
    }
    if (prevPairRef.current === pair) return;
    prevPairRef.current = pair;
    setAmountIn('');
    setAmountPerSwap('');
    setTargetPrice('');
  }, [tokenIn, tokenOut]);

  // Limit-order fields
  const [amountIn, setAmountIn] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [direction, setDirection] = useState<'gte' | 'lte'>('gte');

  // DCA fields
  const [amountPerSwap, setAmountPerSwap] = useState('');
  const [intervalValue, setIntervalValue] = useState('5');
  const [intervalUnit, setIntervalUnit] = useState<
    'minutes' | 'hours' | 'days' | 'weeks'
  >('minutes');
  const [totalSwaps, setTotalSwaps] = useState('10');

  // Expiry quick-pick (days as string, '' = no expiry)
  const [expiryPreset, setExpiryPreset] = useState<
    '' | '1' | '7' | '30' | '365'
  >('7');

  // Interval in seconds (derived)
  const intervalUnitSecs: Record<string, number> = {
    minutes: 60,
    hours: 3600,
    days: 86400,
    weeks: 604800,
  };
  const intervalSeconds =
    parseInt(intervalValue || '0', 10) *
    (intervalUnitSecs[intervalUnit] ?? 3600);

  // Auto-wrap preview: how much native CFX would need wrapping for current form values
  const requiredPreview = useMemo(() => {
    if (!tokenInIsCfx) return 0n;
    try {
      if (kind === 'limit_order') {
        return amountIn.trim()
          ? parseUnits(amountIn.trim(), tokenInDecimals)
          : 0n;
      }
      const pw = amountPerSwap.trim()
        ? parseUnits(amountPerSwap.trim(), tokenInDecimals)
        : 0n;
      return pw * BigInt(parseInt(totalSwaps, 10) || 1);
    } catch {
      return 0n;
    }
  }, [
    tokenInIsCfx,
    kind,
    amountIn,
    amountPerSwap,
    totalSwaps,
    tokenInDecimals,
  ]);
  const wcfxBalWei = BigInt(wcfxInfo?.balanceWei ?? '0');

  // Sum wCFX already committed by active jobs so the UI preview reflects the
  // true shortfall (same logic the approval step uses at submit-time).
  const [cfxExistingCommitted, setCfxExistingCommitted] = useState(0n);
  useEffect(() => {
    if (!tokenInIsCfx || !token) {
      setCfxExistingCommitted(0n);
      return;
    }
    const TERMINAL = new Set(['executed', 'cancelled', 'failed']);
    fetch('/api/jobs', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((p: { jobs: Job[] }) => {
        let committed = 0n;
        for (const j of Array.isArray(p.jobs) ? p.jobs : []) {
          if (TERMINAL.has(j.status)) continue;
          const jTin =
            j.type === 'limit_order'
              ? (j as LimitOrderJob).params.tokenIn
              : (j as DCAJob).params.tokenIn;
          if (jTin.toLowerCase() !== wcfxAddr.toLowerCase()) continue;
          if (j.type === 'limit_order') {
            committed += BigInt((j as LimitOrderJob).params.amountIn);
          } else {
            const dca = j as DCAJob;
            committed +=
              BigInt(dca.params.amountPerSwap) *
              BigInt(Math.max(0, dca.params.totalSwaps - dca.params.swapsCompleted));
          }
        }
        setCfxExistingCommitted(committed);
      })
      .catch(() => setCfxExistingCommitted(0n));
  }, [tokenInIsCfx, token, wcfxAddr]);

  // Must cover both the new strategy AND what existing active jobs still need.
  const needsAutoWrap =
    tokenInIsCfx &&
    requiredPreview + cfxExistingCommitted > wcfxBalWei &&
    requiredPreview > 0n;
  const autoWrapAmount = needsAutoWrap
    ? requiredPreview + cfxExistingCommitted - wcfxBalWei
    : 0n;

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!token) {
      setError('Sign in first — click "Sign In" in the navbar.');
      setSubmitting(false);
      return;
    }

    if (!address) {
      setError('Connect your wallet first.');
      setSubmitting(false);
      return;
    }

    if (!publicClient) {
      setError('Wallet client not ready — please reload.');
      setSubmitting(false);
      return;
    }

    // ── Pre-flight: ensure amounts are non-zero before touching the chain ────────
    if (kind === 'dca') {
      // Guard against accidentally submitting a year-long (or longer) interval.
      // maxJobsPerUser slots are finite; a stuck job blocks the user indefinitely.
      const MAX_INTERVAL_SECS = 30 * 86_400; // 30 days
      if (intervalSeconds > MAX_INTERVAL_SECS) {
        setError(
          `Interval too long (${Math.round(intervalSeconds / 86400)} days). Maximum is 30 days.`
        );
        setSubmitting(false);
        return;
      }
    }
    if (kind === 'limit_order') {
      if (!amountIn.trim() || parseFloat(amountIn) <= 0) {
        setError('Enter a sell amount greater than zero.');
        setSubmitting(false);
        return;
      }
    } else {
      if (!amountPerSwap.trim() || parseFloat(amountPerSwap) <= 0) {
        setError('Enter an amount per swap greater than zero.');
        setSubmitting(false);
        return;
      }
    }

    let activeStepId: TxStepId = 'wrap'; // tracks current step for error attribution

    try {
      let body: object;
      // Resolve CFX (native) → WCFX address before sending to the backend
      const resolvedTokenIn = resolveTokenInAddress(tokenIn);
      const resolvedTokenOut = resolveTokenInAddress(tokenOut);

      // Use EIP-1559 fee estimation (supported since Conflux eSpace v2.4.0).
      // Apply a 20% buffer so txs confirm on the first attempt.
      const feeData = await publicClient.estimateFeesPerGas();
      const maxFeePerGas = (feeData.maxFeePerGas * 120n) / 100n;
      const maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * 120n) / 100n;

      // Helper: estimate gas via our own RPC (not the wallet) with a 30% buffer.
      // Passing explicit `gas` means Rabby/MetaMask receive a fully-specified tx
      // and never need to run their own eth_estimateGas, which avoids the
      // "gas price too low" / "estimation failed" prompts.
      const withGasBuffer = (n: bigint) => (n * 130n) / 100n;

      // ── 1. ERC-20 approval (if allowance insufficient) ───────────────────
      const slippageBps = parseInt(slippage, 10);
      const expiresAtSec = expiryPreset
        ? BigInt(
            Math.floor(Date.now() / 1000) + parseInt(expiryPreset, 10) * 86_400
          )
        : 0n;

      const amountInWei = parseUnits(amountIn.trim() || '0', tokenInDecimals);
      const amountPerSwapWei = parseUnits(
        amountPerSwap.trim() || '0',
        tokenInDecimals
      );

      // How much allowance this strategy needs
      const requiredAllowance =
        kind === 'limit_order'
          ? amountInWei
          : amountPerSwapWei * BigInt(parseInt(totalSwaps, 10) || 1);

      // When CFX native is selected, auto-wrap the shortfall to WCFX, then approve it.
      const tokenInIsNative =
        tokenIn.toLowerCase() === CFX_NATIVE_ADDRESS.toLowerCase();

      // ── 0. Pre-fetch active jobs once — used by both wrap and approve steps ──
      // The wrap shortfall and the required approval must both cover the new
      // strategy PLUS the remaining committed amounts of all active jobs for the
      // same token-in, so we fetch jobs here and reuse the result below.
      const TERMINAL_STATUSES = new Set(['executed', 'cancelled', 'failed']);
      let existingCommitted = 0n;
      try {
        const jobsRes = await fetch('/api/jobs', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (jobsRes.ok) {
          const payload = (await jobsRes.json()) as { jobs: Job[] };
          const existingJobs = Array.isArray(payload.jobs) ? payload.jobs : [];
          for (const j of existingJobs) {
            if (TERMINAL_STATUSES.has(j.status)) continue;
            const jTokenIn =
              j.type === 'limit_order'
                ? (j as LimitOrderJob).params.tokenIn
                : (j as DCAJob).params.tokenIn;
            if (jTokenIn.toLowerCase() !== resolvedTokenIn.toLowerCase())
              continue;
            if (j.type === 'limit_order') {
              existingCommitted += BigInt(
                (j as LimitOrderJob).params.amountIn
              );
            } else {
              const dca = j as DCAJob;
              const remaining = Math.max(
                0,
                dca.params.totalSwaps - dca.params.swapsCompleted
              );
              existingCommitted +=
                BigInt(dca.params.amountPerSwap) * BigInt(remaining);
            }
          }
        }
      } catch {
        // Non-fatal — fall back to checking only the new strategy's amount.
      }

      // ── 0b. Check wCFX balance to determine if wrap step is needed ────────
      let needsWrap = false;
      let wcfxBal = 0n;
      if (tokenInIsNative && requiredAllowance > 0n) {
        wcfxBal = (await publicClient.readContract({
          address: wcfxAddr,
          abi: WCFX_ABI,
          functionName: 'balanceOf',
          args: [address],
        })) as bigint;
        // Must cover the new strategy AND what existing active strategies still need.
        if (wcfxBal < existingCommitted + requiredAllowance) {
          needsWrap = true;
        }
      }

      // ── Initialise step tracker ──────────────────────────────────────────
      const tokenSym = tokenInIsNative
        ? 'wCFX'
        : (tokenInInfo?.symbol ?? 'token');
      const steps: TxStepDef[] = [];
      if (needsWrap) {
        steps.push({
          id: 'wrap',
          label: 'Wrap CFX → wCFX',
          detail: 'Pending…',
          status: 'idle',
        });
      }
      steps.push(
        {
          id: 'approve',
          label: `Approve ${tokenSym}`,
          detail: 'Pending…',
          status: 'idle',
        },
        {
          id: 'onchain',
          label: kind === 'dca' ? 'Register DCA job' : 'Register limit order',
          detail: 'Pending…',
          status: 'idle',
        },
        {
          id: 'save',
          label: 'Save strategy',
          detail: 'Pending…',
          status: 'idle',
        }
      );
      setTxSteps(steps);
      activeStepId = needsWrap ? 'wrap' : 'approve';

      // ── 1. Auto-wrap CFX → wCFX if WCFX balance is insufficient ──────────
      if (needsWrap) {
        const shortfall = existingCommitted + requiredAllowance - wcfxBal;
        const shortfallFmt = parseFloat(formatUnits(shortfall, 18)).toFixed(6);
        setStep('wrap', 'active', `Wrapping ${shortfallFmt} CFX → wCFX…`);
        const wrapGas = await publicClient.estimateContractGas({
          address: wcfxAddr,
          abi: WCFX_ABI,
          functionName: 'deposit',
          value: shortfall,
          account: address,
        });
        const wrapHash = await writeContractAsync({
          address: wcfxAddr,
          abi: WCFX_ABI,
          functionName: 'deposit',
          value: shortfall,
          gas: withGasBuffer(wrapGas),
          maxFeePerGas,
          maxPriorityFeePerGas,
        });
        setStep('wrap', 'waiting', 'Waiting for wrap confirmation…', wrapHash);
        await publicClient.waitForTransactionReceipt({
          hash: wrapHash,
          pollingInterval: 2_000,
          timeout: 120_000,
        });
        setStep('wrap', 'done', `Wrapped ${shortfallFmt} CFX ✓`, wrapHash);
      }

      // ── 1. ERC-20 approval (resolvedTokenIn is always ERC-20 — WCFX for native CFX) ──
      activeStepId = 'approve';
      if (requiredAllowance > 0n) {
        setStep('approve', 'active', 'Checking token allowance…');
        const currentAllowance = (await publicClient.readContract({
          address: resolvedTokenIn as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, AUTOMATION_MANAGER_ADDRESS],
        })) as bigint;

        // ── existingCommitted already computed above (step 0 pre-fetch) ─────
        // Total allowance this account needs: new strategy + all active ones.
        const totalRequired = existingCommitted + requiredAllowance;

        if (currentAllowance < totalRequired) {
          const approveAmount = unlimitedApproval ? MAX_UINT256 : totalRequired;
          const decimals = tokenInDecimals;
          const sym = tokenInIsNative ? 'wCFX' : (tokenInInfo?.symbol ?? '');
          const totalFormatted = formatUnits(totalRequired, decimals);
          const approveLabel = unlimitedApproval
            ? 'unlimited'
            : existingCommitted > 0n
              ? `${totalFormatted} ${sym} (this + existing strategies)`
              : kind === 'dca'
                ? `${totalFormatted} ${sym} (${amountPerSwap} × ${totalSwaps} orders)`
                : `${totalFormatted} ${sym}`;
          setStep('approve', 'active', `Approve ${approveLabel}…`);
          const approveGas = await publicClient.estimateContractGas({
            address: resolvedTokenIn as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [AUTOMATION_MANAGER_ADDRESS, approveAmount],
            account: address,
          });
          const approveTxHash = await writeContractAsync({
            address: resolvedTokenIn as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [AUTOMATION_MANAGER_ADDRESS, approveAmount],
            gas: withGasBuffer(approveGas),
            maxFeePerGas,
            maxPriorityFeePerGas,
          });
          setStep(
            'approve',
            'waiting',
            'Waiting for approval confirmation…',
            approveTxHash
          );
          await publicClient.waitForTransactionReceipt({
            hash: approveTxHash,
            pollingInterval: 2_000,
            timeout: 120_000,
          });
          setStep(
            'approve',
            'done',
            `Approved ${approveLabel} ✓`,
            approveTxHash
          );
        } else {
          setStep('approve', 'skipped', 'Allowance already sufficient');
        }
      } else {
        setStep('approve', 'skipped', 'No approval needed');
      }

      // ── 2. Register job on-chain ──────────────────────────────────────────
      // The AutomationManager generates a bytes32 jobId on-chain and emits
      // JobCreated.  We read that event and store it alongside the DB record
      // so the keeper knows which on-chain job to execute.

      let onChainJobId: string | null = null;

      try {
        let txHash: `0x${string}`;

        activeStepId = 'onchain';
        if (kind === 'limit_order') {
          const targetPriceWei = parseUnits(targetPrice.trim() || '0', 18);
          const expectedOut =
            targetPriceWei > 0n
              ? (amountInWei * targetPriceWei) / BigInt(10 ** 18)
              : 0n;
          const minAmountOut =
            (expectedOut * BigInt(10000 - slippageBps)) / 10000n;

          setStep(
            'onchain',
            'active',
            'Register limit order (confirm in wallet)…'
          );
          const loArgs = [
            {
              tokenIn: resolvedTokenIn as `0x${string}`,
              tokenOut: resolvedTokenOut as `0x${string}`,
              amountIn: amountInWei,
              minAmountOut,
              targetPrice: targetPriceWei,
              triggerAbove: direction === 'gte',
            },
            BigInt(slippageBps),
            expiresAtSec,
          ] as const;
          const loGas = await publicClient.estimateContractGas({
            address: AUTOMATION_MANAGER_ADDRESS,
            abi: AUTOMATION_MANAGER_ABI,
            functionName: 'createLimitOrder',
            args: loArgs,
            account: address,
          });
          txHash = await writeContractAsync({
            address: AUTOMATION_MANAGER_ADDRESS,
            abi: AUTOMATION_MANAGER_ABI,
            functionName: 'createLimitOrder',
            args: loArgs,
            gas: withGasBuffer(loGas),
            maxFeePerGas,
            maxPriorityFeePerGas,
          });
        } else {
          setStep('onchain', 'active', 'Register DCA job (confirm in wallet)…');
          const dcaArgs = [
            {
              tokenIn: resolvedTokenIn as `0x${string}`,
              tokenOut: resolvedTokenOut as `0x${string}`,
              amountPerSwap: amountPerSwapWei,
              intervalSeconds: BigInt(intervalSeconds),
              totalSwaps: BigInt(parseInt(totalSwaps, 10)),
              swapsCompleted: 0n,
              nextExecution: 0n,
            },
            BigInt(slippageBps),
            expiresAtSec,
          ] as const;
          const dcaGas = await publicClient.estimateContractGas({
            address: AUTOMATION_MANAGER_ADDRESS,
            abi: AUTOMATION_MANAGER_ABI,
            functionName: 'createDCAJob',
            args: dcaArgs,
            account: address,
          });
          txHash = await writeContractAsync({
            address: AUTOMATION_MANAGER_ADDRESS,
            abi: AUTOMATION_MANAGER_ABI,
            functionName: 'createDCAJob',
            args: dcaArgs,
            gas: withGasBuffer(dcaGas),
            maxFeePerGas,
            maxPriorityFeePerGas,
          });
        }

        // ── 3. Parse JobCreated event to get bytes32 jobId ──────────────────
        setStep(
          'onchain',
          'waiting',
          `Waiting for confirmation… (tx ${txHash.slice(0, 10)}…)`,
          txHash
        );
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: txHash,
          pollingInterval: 2_000, // poll every 2 s (Conflux block time ~2-3 s)
          timeout: 120_000, // give up after 2 min
        });
        const logs = parseEventLogs({
          abi: AUTOMATION_MANAGER_ABI,
          eventName: 'JobCreated',
          logs: receipt.logs,
        });

        if (logs.length > 0) {
          onChainJobId = logs[0].args.jobId as string;
        } else {
          // Transaction confirmed but log not found — proceed without it
          // (worker will skip execution until onChainJobId is set)
          console.warn(
            '[StrategyBuilder] JobCreated log not found in receipt',
            receipt.transactionHash
          );
        }
        setStep(
          'onchain',
          'done',
          onChainJobId
            ? `Registered ✓ (job ${onChainJobId.slice(0, 10)}…)`
            : 'Registered ✓',
          txHash
        );
      } catch (contractErr: unknown) {
        const msg = (contractErr as Error).message ?? String(contractErr);
        // Viem throws "could not be found" when waitForTransactionReceipt times out.
        // The tx may still confirm — give user a clear message with the tx hash.
        if (msg.includes('could not be found') || msg.includes('timed out')) {
          throw new Error(
            `On-chain registration timed out waiting for confirmation. ` +
              `The transaction may still confirm — check your wallet activity or ConfluxScan. ` +
              `If it confirms, re-open the Create page; the strategy will not be double-registered.`
          );
        }
        throw new Error(`On-chain registration failed: ${msg}`);
      }

      // ── 4. Build backend body ─────────────────────────────────────────────
      activeStepId = 'save';
      setStep('save', 'active', 'Saving strategy…');
      if (kind === 'limit_order') {
        const targetPriceWei = parseUnits(targetPrice.trim() || '0', 18);
        // minAmountOut = amountIn * targetPrice/1e18 * (1 - slippage)
        const expectedOut =
          targetPriceWei > 0n
            ? (amountInWei * targetPriceWei) / BigInt(10 ** 18)
            : 0n;
        const minAmountOut =
          (expectedOut * BigInt(10000 - slippageBps)) / 10000n;

        body = {
          type: 'limit_order',
          params: {
            tokenIn: resolvedTokenIn,
            tokenOut: resolvedTokenOut,
            amountIn: amountInWei.toString(),
            minAmountOut: minAmountOut.toString(),
            targetPrice: targetPriceWei.toString(),
            direction,
          },
          ...(onChainJobId ? { onChainJobId } : {}),
          ...(expiryPreset
            ? {
                expiresAt: Date.now() + parseInt(expiryPreset, 10) * 86_400_000,
              }
            : {}),
        };
      } else {
        body = {
          type: 'dca',
          params: {
            tokenIn: resolvedTokenIn,
            tokenOut: resolvedTokenOut,
            amountPerSwap: amountPerSwapWei.toString(),
            intervalSeconds,
            totalSwaps: parseInt(totalSwaps, 10),
            swapsCompleted: 0,
            nextExecution: 0,
          },
          ...(onChainJobId ? { onChainJobId } : {}),
        };
      }

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }

      setStep('save', 'done', 'Strategy saved ✓');
      // Refresh balances + reset form (hidden under stepper, ready for next use)
      refresh();
      setAmountIn('');
      setAmountPerSwap('');
      setTargetPrice('');
      setExpiryPreset('');
      setError(null);
      // Stepper shows success state; user clicks “View Strategies” to close
    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      setError(msg);
      setStep(activeStepId, 'error', msg.slice(0, 120));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Derived display values ──────────────────────────────────────────────────
  const amountInNum = parseFloat(amountIn || '0');
  const targetPriceNum = parseFloat(targetPrice || '0');
  const estimatedOut =
    amountInNum > 0 && targetPriceNum > 0
      ? (amountInNum * targetPriceNum).toLocaleString(undefined, {
          maximumFractionDigits: 6,
        })
      : '0.0';
  const amountInUsd =
    tokenInUsd != null && amountInNum > 0
      ? (amountInNum * tokenInUsd).toFixed(2)
      : null;
  const estimatedOutUsd =
    tokenOutUsd != null && amountInNum > 0 && targetPriceNum > 0
      ? (amountInNum * targetPriceNum * tokenOutUsd).toFixed(2)
      : null;

  const amountPerSwapNum = parseFloat(amountPerSwap || '0');
  const perTradeUsd =
    tokenInUsd != null && amountPerSwapNum > 0
      ? (amountPerSwapNum * tokenInUsd).toFixed(2)
      : null;
  const totalSwapsNum = parseInt(totalSwaps || '1', 10) || 1;

  // When CFX native is selected, the effective sellable balance is native CFX + WCFX
  // because auto-wrap bridges the gap at submission time.
  const CFX_GAS_RESERVE = 100_000_000_000_000_000n; // 0.1 CFX reserved for wrap + approve + create gas
  const cfxNativeWei = tokenInIsCfx
    ? BigInt(tokenInInfo?.balanceWei ?? '0')
    : 0n;
  const cfxEffectiveWei = tokenInIsCfx
    ? cfxNativeWei + wcfxBalWei > CFX_GAS_RESERVE
      ? cfxNativeWei + wcfxBalWei - CFX_GAS_RESERVE
      : 0n
    : 0n;
  const cfxEffectiveFormatted = tokenInIsCfx
    ? formatUnits(cfxNativeWei + wcfxBalWei, 18)
    : '';
  const cfxMaxFormatted = tokenInIsCfx ? formatUnits(cfxEffectiveWei, 18) : '';

  const inBalanceLabel =
    tokenInIsCfx && wcfxBalWei > 0n
      ? `${fmtBalance(formatUnits(cfxNativeWei, 18))} CFX + ${fmtBalance(formatUnits(wcfxBalWei, 18))} wCFX`
      : tokenInInfo
        ? fmtBalance(tokenInInfo.balanceFormatted) || '0.00'
        : '0.00';
  const inBalance = tokenInIsCfx
    ? fmtBalance(cfxEffectiveFormatted) || '0.00'
    : tokenInInfo
      ? fmtBalance(tokenInInfo.balanceFormatted) || '0.00'
      : '0.00';
  const outBalance = tokenOutInfo
    ? fmtBalance(tokenOutInfo.balanceFormatted) || '0.00'
    : '0.00';

  // Swap token in ↔ out; invert the target price so the displayed rate stays correct
  const swapTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    if (targetPrice) {
      const p = parseFloat(targetPrice);
      if (p > 0) setTargetPrice((1 / p).toFixed(6));
    }
  };

  // Set target price as market +/– pct
  const applyPct = (pct: number) => {
    const base = parseFloat(swappiPrice ?? '0');
    if (!base) return;
    setTargetPrice((base * (1 + pct / 100)).toFixed(6));
  };

  const EXPIRY_LABELS: Record<string, string> = {
    '1': '1 Day',
    '7': '1 Week',
    '30': '1 Month',
    '365': '1 Year',
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-[560px] mx-auto space-y-1"
    >
      {/* ── Tx stepper overlay (replaces form content during submission) ─────── */}
      {txSteps !== null && (
        <TxStepperPanel
          steps={txSteps}
          error={error}
          onRetry={() => {
            setTxSteps(null);
            setError(null);
          }}
          onDone={() => {
            setTxSteps(null);
            onSuccess?.();
          }}
          chainId={chainId}
        />
      )}
      {/* ── Form ─────────────────────────────────────────────────────────────── */}
      {txSteps === null && (
        <>
          {/* ── Tab bar ──────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-1 mb-3">
            {(['limit_order', 'dca'] as StrategyKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  kind === k
                    ? 'bg-slate-700 text-white ring-1 ring-conflux-500'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {k === 'limit_order' ? 'Limit' : 'DCA'}
              </button>
            ))}
          </div>

          {/* ── Banners ──────────────────────────────────────────────────────── */}
          {mounted && poolsError && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950 border border-amber-800 rounded-lg px-3 py-2 mb-2">
              <span>⚠ Could not load token list: {poolsError}</span>
              <button
                type="button"
                onClick={refresh}
                className="underline ml-auto"
              >
                Retry
              </button>
            </div>
          )}
          {mounted && rpcWarning && !poolsError && (
            <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-950 border border-yellow-800 rounded-lg px-3 py-2 mb-2">
              <span>
                ⚠ Balance fetch degraded. Shown balances may be stale.
              </span>
              <button
                type="button"
                onClick={refresh}
                className="underline ml-auto"
              >
                Retry
              </button>
            </div>
          )}
          {mounted && priceError && tokenIn && tokenOut && (
            <div className="flex items-center gap-2 text-xs text-orange-400 bg-orange-950 border border-orange-800 rounded-lg px-3 py-2 mb-2">
              <span>⚠ {priceError}</span>
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 text-xs text-green-300 bg-green-950 border border-green-700 rounded-lg px-3 py-2 mb-2">
              <span>
                <CheckCircle2 className="h-4 w-4 inline-block mr-1" />{' '}
                {successMsg}
              </span>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="ml-auto text-green-500 hover:text-green-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ══════════════════ LIMIT ORDER ═══════════════════════════════════ */}
          {kind === 'limit_order' && (
            <>
              {/* Sell panel */}
              <AmountPanel
                label="Sell"
                amount={amountIn}
                onAmountChange={setAmountIn}
                onMax={
                  tokenInInfo
                    ? () =>
                        setAmountIn(
                          tokenInIsCfx
                            ? cfxMaxFormatted
                            : tokenInInfo.balanceFormatted
                        )
                    : undefined
                }
                tokens={mounted ? tokenInOptions : []}
                selectedToken={tokenIn}
                onTokenChange={(v) => {
                  setTokenIn(v);
                  setTokenOut('');
                }}
                usdValue={amountInUsd}
                priceLoading={priceLoading}
                balance={
                  tokenInIsCfx && wcfxBalWei > 0n ? inBalanceLabel : inBalance
                }
                balancesLoading={balancesLoading}
                loading={!mounted || poolsLoading}
                placeholder={
                  address && tokenInOptions.length < tokens.length
                    ? `${tokenInOptions.length} tokens in wallet…`
                    : 'Select token…'
                }
              />

              {needsAutoWrap && (
                <div className="mt-3 px-3 py-2 bg-amber-950/40 border border-amber-900/50 rounded-lg text-amber-500 text-xs font-medium flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  <span>
                    Requires wrapping{' '}
                    <b>{fmtBalance(formatUnits(autoWrapAmount, 18))} CFX</b>.
                    This will be done automatically.
                  </span>
                </div>
              )}

              <SwapArrow />

              {/* Buy panel (tokenOut, no amount field) */}
              <div className="flex flex-col gap-3 mt-3 relative z-20">
                {/* Buy panel (target price) */}
                <div className="bg-slate-800/40 border border-slate-700/50 backdrop-blur-md rounded-2xl p-5 space-y-4 hover:border-slate-700 transition-colors relative z-20">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      When 1
                      <TokenPill token={tokenInInfo} fallback="?" />
                      is worth
                    </span>
                    <button
                      type="button"
                      onClick={swapTokens}
                      title="Swap tokens"
                      className="w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 transition-colors"
                    >
                      ⇅
                    </button>
                  </div>
                  {/* Current market price strip */}
                  {mounted && tokenInInfo && tokenOutInfo && (
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <span>Market:</span>
                      {priceLoading ? (
                        <span className="animate-pulse text-slate-600">
                          fetching…
                        </span>
                      ) : swappiPrice ? (
                        <span className="text-conflux-400 font-medium">
                          {swappiPrice} {tokenOutInfo.symbol}
                        </span>
                      ) : (
                        <span className="text-orange-500">unavailable</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          refreshPrice();
                          refresh();
                        }}
                        title="Refresh price &amp; balances"
                        className="ml-auto text-slate-600 hover:text-slate-300 transition-colors"
                      >
                        <RefreshCcw
                          className={`h-3 w-3 ${priceLoading ? 'animate-spin' : ''}`}
                        />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {priceLoading && !targetPrice ? (
                        <div className="flex-1 h-10 bg-slate-700 rounded-lg animate-pulse" />
                      ) : (
                        <input
                          type="text"
                          value={targetPrice}
                          onChange={(e) => setTargetPrice(e.target.value)}
                          placeholder={swappiPrice ?? '0.00'}
                          className="flex-1 bg-transparent text-2xl tracking-tight font-semibold text-white placeholder-slate-600 focus:outline-none min-w-0"
                        />
                      )}
                      <TokenSelectButton
                        tokens={
                          mounted ? (tokenIn ? tokenOutOptions : tokens) : []
                        }
                        value={tokenOut}
                        onChange={setTokenOut}
                        loading={!mounted || poolsLoading}
                      />
                    </div>
                    {/* Trigger price in USD */}
                    {mounted && tokenOutUsd != null && targetPriceNum > 0 && (
                      <div className="text-xs text-slate-500">
                        ≈{' '}
                        <span className="text-slate-400">
                          $
                          {(targetPriceNum * tokenOutUsd).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            }
                          )}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Presets + direction toggle */}
                  <div className="flex justify-between items-center gap-1 pt-1 border-t border-slate-700/50 mt-2">
                    <div className="flex gap-1">
                      {[1, 5, 10].map((p) => (
                        <button
                          key={p}
                          type="button"
                          disabled={priceLoading || !swappiPrice}
                          onClick={() => applyPct(direction === 'gte' ? p : -p)}
                          className="px-2 py-1 rounded border border-slate-700 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors shrink-0 disabled:opacity-40"
                        >
                          {direction === 'gte' ? '+' : '-'}
                          {p}%
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
                        {direction === 'gte' ? 'Sell Higher' : 'Stop Loss'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDirection((d) => (d === 'gte' ? 'lte' : 'gte'))
                        }
                        title={
                          direction === 'gte'
                            ? 'Execute when price rises to target.'
                            : 'Execute when price drops to target.'
                        }
                        className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-colors border ${
                          direction === 'gte'
                            ? 'border-green-700/50 text-green-400 bg-green-950/40 hover:bg-green-900/40'
                            : 'border-red-700/50 text-red-400 bg-red-950/40 hover:bg-red-900/40'
                        }`}
                      >
                        {direction === 'gte' ? '▲ ≥ target' : '▼ ≤ target'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Output & Expiry row */}
                <div className="bg-slate-800/40 border border-slate-700/50 backdrop-blur-md rounded-2xl p-5 flex flex-col sm:flex-row gap-6 hover:border-slate-700 transition-colors relative z-10">
                  {/* Buy panel (read-only estimated output) */}
                  <div className="flex-1 flex flex-col justify-center">
                    <span className="text-sm font-medium text-slate-400 mb-2">
                      Estimated Output
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-semibold text-white tracking-tight truncate flex-1">
                        {estimatedOut !== '0.0' ? estimatedOut : '0.00'}
                      </span>
                      <TokenPill token={tokenOutInfo} fallback="?" />
                    </div>
                    {estimatedOutUsd && (
                      <div className="text-xs text-slate-500 mt-1">
                        ≈ ${estimatedOutUsd}
                      </div>
                    )}
                  </div>

                  <div className="w-px bg-slate-700/50 hidden sm:block"></div>
                  <div className="h-px bg-slate-700/50 sm:hidden block"></div>

                  {/* Expiry */}
                  <div className="flex-1 flex flex-col justify-center gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-300">
                        Expiry
                      </span>
                      <span className="text-xs text-slate-500">
                        {expiryPreset
                          ? EXPIRY_LABELS[
                              expiryPreset as keyof typeof EXPIRY_LABELS
                            ]
                          : ''}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {(['1', '7', '30', '365'] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() =>
                            setExpiryPreset(expiryPreset === d ? '' : d)
                          }
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            expiryPreset === d
                              ? 'bg-conflux-500 text-white shadow-md shadow-conflux-500/20'
                              : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/50'
                          }`}
                        >
                          1{' '}
                          {d === '1'
                            ? 'Day'
                            : d === '7'
                              ? 'Wk'
                              : d === '30'
                                ? 'Mo'
                                : 'Yr'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════ DCA ═══════════════════════════════════════════ */}
          {kind === 'dca' && (
            <>
              {/* Price info strip */}
              {mounted && swappiPrice && tokenInInfo && tokenOutInfo && (
                <div className="text-sm text-conflux-400 pb-1 flex items-center gap-1">
                  <span className="text-slate-400">↗</span>
                  <span>1 {tokenInInfo.symbol}</span>
                  {tokenInUsd != null && (
                    <span className="text-slate-500">
                      (${tokenInUsd.toFixed(2)})
                    </span>
                  )}
                  <span className="text-slate-400">
                    = {swappiPrice} {tokenOutInfo.symbol}
                  </span>
                  {tokenOutUsd != null && (
                    <span className="text-slate-500">
                      (${tokenOutUsd.toFixed(2)})
                    </span>
                  )}
                </div>
              )}

              {/* Allocate panel (tokenIn + total amount) */}
              <AmountPanel
                label="Allocate"
                amount={amountPerSwap}
                onAmountChange={setAmountPerSwap}
                onMax={
                  tokenInInfo
                    ? () => {
                        const totalWei = tokenInIsCfx
                          ? cfxEffectiveWei
                          : BigInt(tokenInInfo.balanceWei ?? '0');
                        const perSwapWei =
                          totalSwapsNum > 0
                            ? totalWei / BigInt(totalSwapsNum)
                            : totalWei;
                        setAmountPerSwap(
                          formatUnits(perSwapWei, tokenInDecimals)
                        );
                      }
                    : undefined
                }
                tokens={mounted ? tokenInOptions : []}
                selectedToken={tokenIn}
                onTokenChange={(v) => {
                  setTokenIn(v);
                  setTokenOut('');
                }}
                usdValue={perTradeUsd}
                priceLoading={priceLoading}
                balance={
                  tokenInIsCfx && wcfxBalWei > 0n ? inBalanceLabel : inBalance
                }
                balancesLoading={balancesLoading}
                loading={!mounted || poolsLoading}
                placeholder="Select token…"
              />
              {needsAutoWrap && (
                <div className="mt-3 px-3 py-2 bg-amber-950/40 border border-amber-900/50 rounded-lg text-amber-500 text-xs font-medium flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  <span>
                    Requires wrapping{' '}
                    <b>{fmtBalance(formatUnits(autoWrapAmount, 18))} CFX</b>.
                    This will be done automatically.
                  </span>
                </div>
              )}

              <SwapArrow />

              {/* Buy panel (tokenOut, no amount field) */}
              <div className="bg-slate-800/40 border border-slate-700/50 backdrop-blur-md rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-colors relative z-20">
                <span className="text-sm font-medium text-slate-400">Buy</span>
                <div className="flex items-center justify-end">
                  <div className="ml-auto flex flex-col items-end gap-1.5">
                    <TokenSelectButton
                      tokens={
                        mounted ? (tokenIn ? tokenOutOptions : tokens) : []
                      }
                      value={tokenOut}
                      onChange={setTokenOut}
                      loading={!mounted || poolsLoading}
                      placeholder="Select token"
                    />
                    {tokenOutInfo && (
                      <span className="text-sm font-medium text-slate-500">
                        Balance: {outBalance}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Every N <unit> & Over N orders */}
              <div className="mt-3 bg-slate-800/40 border border-slate-700/50 backdrop-blur-md rounded-2xl p-5 hover:border-slate-700 transition-colors flex flex-col sm:flex-row gap-6 relative z-10">
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-sm font-medium text-slate-300">
                      Frequency
                    </span>
                    <span title="How often to execute a swap">
                      <Info className="h-3.5 w-3.5 text-slate-500" />
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={intervalValue}
                      onChange={(e) => setIntervalValue(e.target.value)}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-conflux-500"
                    />
                    <select
                      value={intervalUnit}
                      onChange={(e) =>
                        setIntervalUnit(e.target.value as typeof intervalUnit)
                      }
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-conflux-500"
                    >
                      <option value="minutes">minutes</option>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                      <option value="weeks">weeks</option>
                    </select>
                  </div>
                </div>

                <div className="w-px bg-slate-700/50 hidden sm:block"></div>
                <div className="h-px bg-slate-700/50 sm:hidden block"></div>

                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-sm font-medium text-slate-300">
                      Order Count
                    </span>
                    <span title="Total number of swaps to execute">
                      <Info className="h-3.5 w-3.5 text-slate-500" />
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={totalSwaps}
                      onChange={(e) => setTotalSwaps(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-conflux-500 pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm pointer-events-none">
                      orders
                    </span>
                  </div>
                </div>
              </div>

              {/* Per-trade summary */}
              <div className="mt-2 bg-slate-800/20 rounded-xl p-3 border border-slate-700/30">
                <p className="text-xs text-slate-400 text-center">
                  {amountPerSwapNum > 0 ? (
                    <>
                      Executes <b>{totalSwapsNum}</b>{' '}
                      {totalSwapsNum === 1 ? 'order' : 'orders'} of{' '}
                      <b className="text-white">
                        {amountPerSwapNum.toLocaleString()}{' '}
                        {tokenInInfo?.symbol ?? 'token'}
                      </b>{' '}
                      per trade. Total allocation is{' '}
                      <b>
                        {(amountPerSwapNum * totalSwapsNum).toLocaleString()}{' '}
                        {tokenInInfo?.symbol ?? 'token'}
                      </b>
                      .
                    </>
                  ) : (
                    `0 ${tokenInInfo?.symbol ?? 'token'} per trade`
                  )}
                </p>
              </div>
            </>
          )}

          {/* ── Advanced Settings ────────────────────────────────────────────── */}
          <div className="bg-slate-800/40 border border-slate-700/50 backdrop-blur-md rounded-2xl px-5 py-3 mt-4 hover:border-slate-700 transition-colors flex flex-col sm:flex-row items-center gap-4 justify-between">
            {/* Slippage */}
            <div className="flex items-center w-full justify-between sm:w-auto sm:justify-start gap-4">
              <span className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                Slippage
                <span title="Slippage tolerance">
                  <Info className="h-3.5 w-3.5 text-slate-500" />
                </span>
              </span>
              <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-700/50">
                {['25', '50', '100'].map((bps) => (
                  <button
                    key={bps}
                    type="button"
                    onClick={() => setSlippage(bps)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                      slippage === bps
                        ? 'bg-conflux-500 text-white shadow-md shadow-conflux-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {parseInt(bps, 10) / 100}%
                  </button>
                ))}
              </div>
            </div>

            {/* Approval amount */}
            {tokenIn && (
              <div className="flex items-center w-full justify-between sm:w-auto sm:justify-start gap-3">
                <span className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
                  Unlimited Auth
                  <span title="Approve exact amount or allow reuse for future strategies">
                    <Info className="h-3.5 w-3.5 text-slate-500" />
                  </span>
                </span>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={unlimitedApproval}
                    onChange={() => setUnlimitedApproval((v) => !v)}
                    className="sr-only"
                  />
                  <div
                    aria-hidden="true"
                    className={`w-9 h-5 rounded-full transition-colors relative ${
                      unlimitedApproval ? 'bg-conflux-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        unlimitedApproval ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* ── Error & submit ───────────────────────────────────────────────── */}
          {error && (
            <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !mounted}
            className="w-full bg-conflux-600 hover:bg-conflux-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-2xl transition-colors text-base mt-2"
          >
            {!mounted
              ? 'Loading…'
              : !address
                ? 'Connect wallet'
                : 'Create Strategy'}
          </button>

          {/* Disclaimer */}
          <div className="flex gap-2 items-start text-xs text-slate-500 px-1 pt-1">
            <span className="mt-0.5 shrink-0">▲</span>
            <p>
              {kind === 'limit_order'
                ? 'Limit orders may not execute when the price is exactly at the target, due to gas costs and swap fees.'
                : 'DCA orders execute at market price on each interval. Execution depends on the keeper being operational.'}
            </p>
          </div>
        </>
      )}
    </form>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Token logo — shows the GeckoTerminal image when available, falls back to a coloured initial circle */
function TokenPill({
  token,
  fallback,
}: {
  token?: TokenWithBalance;
  fallback?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const symbol = token?.symbol ?? fallback ?? '?';

  if (token?.logoURI && !imgError) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white overflow-hidden flex-shrink-0 ring-1 ring-slate-600/50">
        <img
          src={token.logoURI}
          alt={symbol}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain"
        />
      </span>
    );
  }

  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-yellow-500',
    'bg-pink-500',
    'bg-teal-500',
  ];
  const color = colors[symbol.charCodeAt(0) % colors.length];
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold flex-shrink-0 ${color}`}
    >
      {symbol[0]}
    </span>
  );
}

/** Compact token selector shown inline in an amount row */
function TokenSelectButton({
  tokens,
  value,
  onChange,
  loading = false,
  placeholder = 'Select token',
}: {
  tokens: TokenWithBalance[];
  value: string;
  onChange: (addr: string) => void;
  loading?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = tokens.find((t) => t.address === value);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return tokens;
    return tokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q)
    );
  }, [tokens, search]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 bg-slate-700 rounded-full px-3 py-1.5 text-sm text-slate-400 animate-pulse min-w-[100px]">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 rounded-full px-3 py-1.5 text-sm font-semibold text-white transition-colors min-w-[100px] justify-between z-10"
      >
        {selected ? (
          <>
            <TokenPill token={selected} />
            <span>{selected.symbol}</span>
          </>
        ) : (
          <span className="text-slate-300">{placeholder}</span>
        )}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-[100] right-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col max-h-72">
          <div className="p-2 border-b border-slate-700">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search token…"
              className="w-full bg-slate-800 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-conflux-500"
            />
          </div>
          <ul className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-500 italic">
                No tokens found
              </li>
            )}
            {filtered.map((t) => (
              <li key={t.address}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(t.address);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors ${
                    t.address === value
                      ? 'bg-conflux-800 text-white'
                      : 'hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <TokenPill token={t} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold leading-none truncate">{t.symbol}</p>
                    <p className="text-slate-400 text-xs truncate">{t.name}</p>
                  </div>
                  {parseFloat(t.balanceFormatted) > 0 && (
                    <span className="text-green-400 text-xs shrink-0">
                      {fmtBalance(t.balanceFormatted)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Amount input panel (Sell / Buy / Allocate) */
function AmountPanel({
  label,
  amount,
  onAmountChange,
  tokens,
  selectedToken,
  onTokenChange,
  usdValue,
  priceLoading = false,
  balance,
  balancesLoading,
  loading,
  placeholder,
  readOnly = false,
  onMax,
}: {
  label: string;
  amount: string;
  onAmountChange: (v: string) => void;
  tokens: TokenWithBalance[];
  selectedToken: string;
  onTokenChange: (v: string) => void;
  usdValue: string | null;
  priceLoading?: boolean;
  balance: string;
  balancesLoading: boolean;
  loading: boolean;
  placeholder: string;
  readOnly?: boolean;
  onMax?: () => void;
}) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 backdrop-blur-md rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-colors relative z-30">
      <span className="text-sm font-medium text-slate-400">{label}</span>
      <div className="flex items-center gap-4">
        <input
          type="text"
          value={amount}
          onChange={(e) => !readOnly && onAmountChange(e.target.value)}
          readOnly={readOnly}
          placeholder="0.0"
          className={`flex-1 bg-transparent text-4xl tracking-tight font-semibold placeholder-slate-600 focus:outline-none min-w-0 ${
            readOnly ? 'text-slate-400 cursor-default' : 'text-white'
          }`}
        />
        <TokenSelectButton
          tokens={tokens}
          value={selectedToken}
          onChange={onTokenChange}
          loading={loading}
          placeholder={placeholder}
        />
      </div>
      <div className="flex items-center justify-between text-sm text-slate-500 pt-1">
        <span className="font-medium">
          {priceLoading ? (
            <span className="animate-pulse text-slate-600">…</span>
          ) : usdValue != null ? (
            `$${usdValue}`
          ) : null}
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          {balancesLoading && <span className="animate-pulse">…</span>}
          <span className="text-slate-400">Balance:</span> {balance}
          {onMax && !readOnly && (
            <button
              type="button"
              onClick={onMax}
              className="ml-1 px-2 py-0.5 rounded text-xs font-bold bg-conflux-500/20 text-conflux-400 hover:bg-conflux-500/30 hover:text-conflux-300 transition-colors"
            >
              MAX
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

/** Circular down-arrow between panels */
function SwapArrow({ onClick }: { onClick?: () => void }) {
  return (
    <div className="flex justify-center -my-1 relative z-10">
      <button
        type="button"
        onClick={onClick}
        className={`w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-slate-300 transition-colors ${
          onClick ? 'hover:bg-slate-600 cursor-pointer' : 'cursor-default'
        }`}
      >
        <ArrowDown className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── TxStepperPanel ─────────────────────────────────────────────────────────────
/** Full-panel step tracker rendered inside the slide-over while transactions execute */
function TxStepperPanel({
  steps,
  error,
  onRetry,
  onDone,
  chainId,
}: {
  steps: TxStepDef[];
  error: string | null;
  onRetry: () => void;
  onDone: () => void;
  chainId: number;
}) {
  const allDone = steps.every(
    (s) => s.status === 'done' || s.status === 'skipped'
  );
  const hasError = steps.some((s) => s.status === 'error');
  const explorerBase =
    chainId === 71
      ? 'https://evmtestnet.confluxscan.org'
      : 'https://evm.confluxscan.org';

  return (
    <div className="flex flex-col gap-6 py-2">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3 text-center">
        {allDone ? (
          <div className="w-14 h-14 rounded-full bg-green-900/60 border border-green-600 flex items-center justify-center">
            <CheckCircle2
              className="w-7 h-7 text-green-400"
              strokeWidth={2.5}
            />
          </div>
        ) : hasError ? (
          <div className="w-14 h-14 rounded-full bg-red-900/60 border border-red-600 flex items-center justify-center">
            <XCircle className="w-7 h-7 text-red-400" strokeWidth={2.5} />
          </div>
        ) : (
          <div className="w-14 h-14 rounded-full border-4 border-conflux-500/30 border-t-conflux-500 animate-spin" />
        )}
        <div>
          <h3 className="text-lg font-semibold text-white">
            {allDone
              ? 'Strategy Created!'
              : hasError
                ? 'Something went wrong'
                : 'Creating Strategy…'}
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">
            {allDone
              ? 'Your strategy is live and will be monitored by the keeper.'
              : hasError
                ? 'One of the steps failed. You can try again from the form.'
                : 'Keep this tab open while transactions are processed.'}
          </p>
        </div>
      </div>

      {/* ── Step list ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
              step.status === 'active' || step.status === 'waiting'
                ? 'border-conflux-700 bg-conflux-950/40'
                : step.status === 'done'
                  ? 'border-green-800/50 bg-green-950/20'
                  : step.status === 'error'
                    ? 'border-red-800/60 bg-red-950/20'
                    : 'border-slate-800 bg-slate-900/20 opacity-60'
            }`}
          >
            {/* Status icon */}
            <div className="mt-0.5 shrink-0 w-6 h-6 flex items-center justify-center">
              {step.status === 'done' && (
                <div className="w-6 h-6 rounded-full bg-green-800 border border-green-600 flex items-center justify-center">
                  <svg
                    className="w-3.5 h-3.5 text-green-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
              {step.status === 'skipped' && (
                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <span className="text-slate-500 text-xs font-bold">—</span>
                </div>
              )}
              {(step.status === 'active' || step.status === 'waiting') && (
                <div className="w-6 h-6 rounded-full border-2 border-conflux-400 border-t-transparent animate-spin" />
              )}
              {step.status === 'error' && (
                <div className="w-6 h-6 rounded-full bg-red-900 border border-red-600 flex items-center justify-center">
                  <svg
                    className="w-3.5 h-3.5 text-red-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
              )}
              {step.status === 'idle' && (
                <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <span className="text-slate-600 text-xs font-semibold">
                    {i + 1}
                  </span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium leading-tight ${
                  step.status === 'idle' || step.status === 'skipped'
                    ? 'text-slate-500'
                    : step.status === 'done'
                      ? 'text-green-300'
                      : step.status === 'error'
                        ? 'text-red-300'
                        : 'text-white'
                }`}
              >
                {step.label}
              </p>
              <p
                className={`text-xs mt-0.5 ${step.status === 'error' ? 'text-red-400' : 'text-slate-500'}`}
              >
                {step.detail}
              </p>
              {step.txHash && (
                <a
                  href={`${explorerBase}/tx/${step.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-conflux-400 hover:text-conflux-300 transition-colors mt-0.5 inline-block font-mono"
                >
                  {step.txHash.slice(0, 10)}…{step.txHash.slice(-6)} ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      {allDone && (
        <button
          type="button"
          onClick={onDone}
          className="w-full bg-conflux-600 hover:bg-conflux-700 text-white font-semibold py-3.5 rounded-2xl transition-colors text-base"
        >
          View Strategies
        </button>
      )}
      {hasError && (
        <div className="space-y-2">
          {error && (
            <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300 break-words">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={onRetry}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-2xl transition-colors"
          >
            ← Try Again
          </button>
        </div>
      )}
    </div>
  );
}

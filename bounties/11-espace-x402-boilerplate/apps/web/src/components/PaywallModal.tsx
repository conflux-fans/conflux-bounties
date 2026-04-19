"use client";

import { useState } from "react";
import { useAccount, useWalletClient, useChainId, useReadContract, useBalance } from "wagmi";
import { formatUnits } from "viem";
import type { PaymentChallenge } from "@/lib/api";
import { X, CreditCard, Loader2, CheckCircle, AlertTriangle, Wallet } from "lucide-react";
import { TOKEN_DECIMALS, RECEIVE_WITH_AUTHORIZATION_TYPES, getERC3009Domain, splitSignature, hashNonce, tokenSymbol } from "@x402/shared";

const balanceOfAbi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

interface Props {
  challenge: PaymentChallenge;
  onClose: () => void;
  onPaymentComplete: (invoiceId: string, payer?: string) => void;
  onTokenSwitch?: (tokenAddress: string) => void;
}

export function PaywallModal({ challenge, onClose, onPaymentComplete, onTokenSwitch }: Props) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  const symbol = tokenSymbol(challenge.token);
  const hasMultipleTokens = challenge.supportedTokens && challenge.supportedTokens.length > 1;

  // Fetch token balance for the current challenge token
  const { data: tokenBalance } = useReadContract({
    address: challenge.token as `0x${string}`,
    abi: balanceOfAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Fetch native CFX balance
  const { data: cfxBalance } = useBalance({ address });
  const [status, setStatus] = useState<"idle" | "signing" | "confirming" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tokenAmount = (Number(challenge.amount) / 10 ** TOKEN_DECIMALS).toFixed(2);

  // Detect if the connected wallet is the seller (recipient) — settlement will fail on-chain
  const isSeller = address && challenge.recipient &&
    address.toLowerCase() === challenge.recipient.toLowerCase();

  async function handlePay() {
    if (!walletClient || !address) return;
    setStatus("signing");
    setError(null);

    try {
      if (!challenge.verifierAddress) {
        throw new Error("Missing verifier contract address in 402 challenge");
      }
      const verifierAddr = challenge.verifierAddress;
      const nonce = hashNonce(challenge.nonce);
      const validAfter = 0;
      const validBefore = challenge.expiry;

      // Sign EIP-712 ReceiveWithAuthorization (off-chain, no gas for the user)
      const tokenDomain = getERC3009Domain(challenge.token);
      const signature = await walletClient.signTypedData({
        domain: {
          name: tokenDomain.name,
          version: tokenDomain.version,
          chainId: BigInt(chainId),
          verifyingContract: challenge.token as `0x${string}`,
        },
        types: RECEIVE_WITH_AUTHORIZATION_TYPES,
        primaryType: "ReceiveWithAuthorization",
        message: {
          from: address,
          to: verifierAddr as `0x${string}`,
          value: BigInt(challenge.amount),
          validAfter: BigInt(validAfter),
          validBefore: BigInt(validBefore),
          nonce: nonce as `0x${string}`,
        },
      });

      const { v, r, s } = splitSignature(signature);

      setStatus("confirming");

      // Submit signed authorization to the seller API for settlement
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
      const settleRes = await fetch(`${apiBase}/invoices/${challenge.invoiceId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorization: {
            from: address,
            to: verifierAddr,
            value: challenge.amount,
            validAfter,
            validBefore,
            nonce,
            v, r, s,
          },
        }),
      });

      const settleData = await settleRes.json();
      if (settleData.verified) {
        if (settleData.txHash) setTxHash(settleData.txHash);
        setStatus("done");
        setTimeout(() => onPaymentComplete(challenge.invoiceId, address), 1000);
      } else {
        throw new Error(settleData.error || "Settlement failed");
      }
    } catch (err: unknown) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Payment failed");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0F2744] border border-gray-700/50 rounded-2xl max-w-md w-full p-0 relative shadow-2xl overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 bg-gradient-to-r from-conflux-teal to-blue-500" />

        <div className="p-6">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-gray-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-conflux-teal/15 flex items-center justify-center">
              <CreditCard className="text-conflux-teal" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Payment Required</h3>
              <p className="text-xs text-gray-400">HTTP 402 — sign to authorize {symbol} payment</p>
            </div>
          </div>

          <div className="rounded-xl bg-black/20 border border-gray-700/30 p-4 space-y-3 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Network</span>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                chainId === 1030
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${chainId === 1030 ? "bg-amber-400" : "bg-emerald-400"}`} />
                {chainId === 1030 ? "Mainnet" : "Testnet"} ({chainId})
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Endpoint</span>
              <code className="text-white font-mono text-xs bg-gray-800/60 px-2 py-0.5 rounded">{challenge.endpoint}</code>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-gray-400">Amount</span>
              <span className="font-mono text-xl font-bold text-conflux-teal">{tokenAmount} <span className="text-sm font-normal text-gray-400">{symbol}</span></span>
            </div>
            {challenge.description && (
              <div className="flex justify-between text-sm gap-4">
                <span className="text-gray-400 shrink-0">Description</span>
                <span className="text-gray-300 text-right">{challenge.description}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Expires</span>
              <span className="text-gray-300">{new Date(challenge.expiry * 1000).toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Token selector (mainnet multi-token) */}
          {hasMultipleTokens && onTokenSwitch && status === "idle" && (
            <div className="rounded-xl bg-black/20 border border-gray-700/30 p-3 mb-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Pay with</p>
              <div className="flex gap-2">
                {challenge.supportedTokens!.map((t) => {
                  const isActive = t.address.toLowerCase() === challenge.token.toLowerCase();
                  return (
                    <button
                      key={t.address}
                      onClick={() => { if (!isActive) onTokenSwitch(t.address); }}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all border ${
                        isActive
                          ? "bg-conflux-teal/15 text-conflux-teal border-conflux-teal/30"
                          : "bg-gray-800/50 text-gray-400 border-gray-700/30 hover:border-gray-600 hover:text-gray-300"
                      }`}
                    >
                      <span className="font-semibold">{t.symbol}</span>
                      <span className="block text-xs opacity-70 mt-0.5">{t.price}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Wallet balances */}
          {address && (
            <div className="rounded-xl bg-black/20 border border-gray-700/30 p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={14} className="text-gray-400" />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Your Balances</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-400">{symbol}</span>
                  <span className={`font-mono font-semibold ${
                    tokenBalance !== undefined && BigInt(tokenBalance) >= BigInt(challenge.amount)
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}>
                    {tokenBalance !== undefined
                      ? formatUnits(BigInt(tokenBalance), TOKEN_DECIMALS)
                      : "..."
                    }
                  </span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-gray-400">CFX (gas)</span>
                  <span className="font-mono text-gray-300">
                    {cfxBalance ? Number(cfxBalance.formatted).toFixed(4) : "..."}
                  </span>
                </div>
              </div>
              {tokenBalance !== undefined && BigInt(tokenBalance) < BigInt(challenge.amount) && (
                <p className="text-xs text-red-400 mt-3">
                  Insufficient {symbol} balance. You need {tokenAmount} but have {formatUnits(BigInt(tokenBalance), TOKEN_DECIMALS)}.
                  {chainId !== 1030 && " Mint test tokens below."}
                </p>
              )}
            </div>
          )}

          {isSeller && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
              <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-300">
                <p className="font-medium">You are the seller of this API</p>
                <p className="text-xs text-amber-400/80 mt-1">
                  The connected wallet is the payment recipient. On-chain settlement will fail because
                  the buyer and seller cannot be the same address. Connect a different wallet to test as a buyer.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
              <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {txHash && (
            <div className="bg-gray-800/50 rounded-xl p-3 mb-4 border border-gray-700/30">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Transaction Hash</p>
              <p className="text-xs font-mono text-gray-300 break-all">{txHash}</p>
            </div>
          )}

          {status === "done" ? (
            <div className="w-full py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 font-medium flex items-center justify-center gap-2 text-sm">
              <CheckCircle size={16} /> Payment confirmed
            </div>
          ) : (
            <button
              onClick={handlePay}
              disabled={status === "signing" || status === "confirming" || !!isSeller}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-conflux-teal to-blue-500 text-white font-medium
                         hover:opacity-90 disabled:opacity-50 transition-all
                         flex items-center justify-center gap-2 text-sm shadow-lg shadow-conflux-teal/20"
            >
              {status === "signing" && <><Loader2 size={16} className="animate-spin" /> Sign authorization in wallet...</>}
              {status === "confirming" && <><Loader2 size={16} className="animate-spin" /> Settling payment...</>}
              {status === "error" && "Retry payment"}
              {status === "idle" && `Authorize ${tokenAmount} ${symbol}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { Coins } from "lucide-react";
import { useNetwork } from "@/components/NetworkContext";

const TESTNET_USDT0 = process.env.NEXT_PUBLIC_USDT0_ADDRESS || "0x91de8a02c4E85b4b7cAB8c13F71a5272E4EF9b11";

const mintAbi = [
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export function MintTestTokens() {
  const { address, isConnected } = useAccount();
  const { isTestnet } = useNetwork();
  const [amount, setAmount] = useState("100");
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Only show on testnet — you can't mint real USDT0 on mainnet
  if (!isConnected || !isTestnet) return null;

  const USDT0_ADDRESS = TESTNET_USDT0;

  const handleMint = () => {
    if (!address) return;
    writeContract({
      address: USDT0_ADDRESS as `0x${string}`,
      abi: mintAbi,
      functionName: "mint",
      args: [address, parseUnits(amount, 6)],
    });
  };

  return (
    <div className="rounded-2xl border border-gray-700/50 bg-[#0F2744]/40 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Coins size={18} className="text-conflux-teal" />
        <h3 className="text-sm font-semibold text-white">Mint Test USDT0</h3>
        <span className="text-xs text-gray-500">(Testnet only)</span>
      </div>
      <p className="text-xs text-gray-400 mb-2">
        MockUSDT0 has a public mint function for testnet. Get free tokens to try premium endpoints.
      </p>
      <p className="text-xs text-gray-500 mb-4 font-mono flex items-center gap-1.5">
        Contract:{" "}
        <a
          href={`https://evmtestnet.confluxscan.net/token/${USDT0_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-conflux-teal hover:underline"
        >
          {USDT0_ADDRESS.slice(0, 6)}...{USDT0_ADDRESS.slice(-4)}
        </a>
        <button
          onClick={() => navigator.clipboard.writeText(USDT0_ADDRESS)}
          className="text-gray-600 hover:text-gray-400 transition-colors"
          title="Copy address"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-conflux-teal"
          min="1"
          max="10000"
        />
        <span className="text-xs text-gray-500">USDT0</span>
        <button
          onClick={handleMint}
          disabled={isPending || isConfirming}
          className="px-4 py-2 rounded-lg bg-conflux-teal/10 text-conflux-teal text-sm font-medium hover:bg-conflux-teal/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Confirm in wallet..." : isConfirming ? "Minting..." : "Mint"}
        </button>
      </div>
      {isSuccess && txHash && (
        <p className="text-xs text-emerald-400 mt-3">
          Minted {amount} USDT0.{" "}
          <a
            href={`https://evmtestnet.confluxscan.net/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View tx
          </a>
        </p>
      )}
      {error && (
        <p className="text-xs text-red-400 mt-3">
          {error.message.slice(0, 120)}
        </p>
      )}
    </div>
  );
}

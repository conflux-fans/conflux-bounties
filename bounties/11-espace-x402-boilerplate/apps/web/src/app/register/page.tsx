"use client";

import { useState } from "react";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import Link from "next/link";
import { CheckCircle, Loader2, AlertTriangle, ExternalLink, Search, Edit3, UserMinus, Shield, Coins, Hash, Users, BookOpen, PenTool, Unlock, RefreshCw, ArrowRightLeft } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { getContractAddress, getChainById } from "@/lib/wagmi";

const verifierAbi = [
  // ─── Write Functions ───
  {
    type: "function",
    name: "registerSeller",
    inputs: [
      { name: "apiBaseUrl", type: "string" },
      { name: "description", type: "string" },
      { name: "escrowDuration", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "reactivateSeller",
    inputs: [
      { name: "apiBaseUrl", type: "string" },
      { name: "description", type: "string" },
      { name: "escrowDuration", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateSeller",
    inputs: [
      { name: "apiBaseUrl", type: "string" },
      { name: "description", type: "string" },
      { name: "escrowDuration", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deactivateSeller",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "settle",
    inputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "from", type: "address" },
      { name: "recipient", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "endpoint", type: "string" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "release",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "refund",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "refundTo",
    inputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "refundRecipient", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setSupportedToken",
    inputs: [
      { name: "token", type: "address" },
      { name: "supported", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ─── Read Functions ───
  {
    type: "function",
    name: "getSeller",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "wallet", type: "address" },
          { name: "apiBaseUrl", type: "string" },
          { name: "description", type: "string" },
          { name: "active", type: "bool" },
          { name: "registeredAt", type: "uint256" },
          { name: "escrowDuration", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSellerCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getActiveSellers",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "wallet", type: "address" },
          { name: "apiBaseUrl", type: "string" },
          { name: "description", type: "string" },
          { name: "active", type: "bool" },
          { name: "registeredAt", type: "uint256" },
          { name: "escrowDuration", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "verifyPayment",
    inputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "expectedAmount", type: "uint256" },
      { name: "expectedEndpoint", type: "string" },
    ],
    outputs: [
      { name: "valid", type: "bool" },
      { name: "payer", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPayment",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "payer", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "token", type: "address" },
          { name: "endpoint", type: "string" },
          { name: "nonce", type: "bytes32" },
          { name: "expiry", type: "uint256" },
          { name: "paidAt", type: "uint256" },
          { name: "releaseAt", type: "uint256" },
          { name: "released", type: "bool" },
          { name: "refunded", type: "bool" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "usedNonces",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "supportedTokens",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ESCROW_DURATION",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_AUTH_DURATION",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type Tab = "register" | "write" | "read";

// ─── Reusable form input ───
function FormField({ label, placeholder, value, onChange, type = "text", required, hint }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-white/5 border border-gray-700/50 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-conflux-teal/50 focus:ring-1 focus:ring-conflux-teal/30 font-mono"
      />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

// ─── Result display ───
function ResultBox({ data, error, label }: { data: unknown; error?: string; label?: string }) {
  if (error) {
    return (
      <div className="mt-3 flex items-start gap-2 text-red-400 bg-red-500/10 p-3 rounded-lg text-sm">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span className="break-all">{error.slice(0, 300)}</span>
      </div>
    );
  }
  if (data === undefined || data === null) return null;
  return (
    <div className="mt-3">
      {label && <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>}
      <pre className="bg-black/30 border border-gray-700/30 rounded-lg p-3 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-all font-mono">
        {typeof data === "object" ? JSON.stringify(data, (_, v) => typeof v === "bigint" ? v.toString() : v, 2) : String(data)}
      </pre>
    </div>
  );
}

// ─── Write function card ───
function WriteCard({ title, description, icon, children, onSubmit, isPending, isConfirming, isSuccess, txHash, explorerUrl, error }: {
  title: string; description: string; icon: React.ReactNode;
  children: React.ReactNode; onSubmit: () => void;
  isPending: boolean; isConfirming: boolean; isSuccess: boolean;
  txHash?: string; explorerUrl?: string; error?: string;
}) {
  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-conflux-teal/10 flex items-center justify-center text-conflux-teal">{icon}</div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      {children}
      {error && (
        <div className="flex items-start gap-2 text-red-400 bg-red-500/10 p-3 rounded-lg text-xs">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span className="break-all">{error.slice(0, 200)}</span>
        </div>
      )}
      {isSuccess && txHash && (
        <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 p-3 rounded-lg text-xs">
          <CheckCircle size={12} className="shrink-0" />
          <span>Transaction confirmed</span>
          {explorerUrl && (
            <a href={`${explorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-conflux-teal hover:underline flex items-center gap-1">
              View <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}
      <button
        onClick={onSubmit}
        disabled={isPending || isConfirming}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-conflux-teal to-blue-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? <><Loader2 size={14} className="animate-spin" /> Confirm in Wallet...</> :
         isConfirming ? <><Loader2 size={14} className="animate-spin" /> Confirming...</> :
         `Execute ${title}`}
      </button>
    </div>
  );
}

// ─── Read function card ───
function ReadCard({ title, description, icon, children, onQuery, isLoading, result, error }: {
  title: string; description: string; icon: React.ReactNode;
  children?: React.ReactNode; onQuery: () => void;
  isLoading: boolean; result: unknown; error?: string;
}) {
  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">{icon}</div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      {children}
      <button
        onClick={onQuery}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20 text-sm font-medium hover:bg-blue-500/25 transition-colors disabled:opacity-50"
      >
        {isLoading ? <><Loader2 size={14} className="animate-spin" /> Querying...</> : <><Search size={14} /> Query</>}
      </button>
      <ResultBox data={result} error={error} label="Result" />
    </div>
  );
}

export default function RegisterPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);
  const chain = getChainById(chainId);
  const explorerUrl = chain.blockExplorers?.default.url;
  const [activeTab, setActiveTab] = useState<Tab>("register");

  // ─── Register form state ───
  const [regUrl, setRegUrl] = useState("");
  const [regDesc, setRegDesc] = useState("");
  const [regEscrowHours, setRegEscrowHours] = useState("24");

  // ─── My seller status ───
  const { data: sellerData } = useReadContract({
    address: contractAddress,
    abi: verifierAbi,
    functionName: "getSeller",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });
  const seller = sellerData as { wallet: string; apiBaseUrl: string; description: string; active: boolean; registeredAt: bigint; escrowDuration: bigint } | undefined;
  const isAlreadyRegistered = seller && seller.wallet !== ZERO_ADDRESS && seller.active;

  // ─── Write contract hooks (one per function) ───
  const regWrite = useWriteContract();
  const regReceipt = useWaitForTransactionReceipt({ hash: regWrite.data });

  const updateWrite = useWriteContract();
  const updateReceipt = useWaitForTransactionReceipt({ hash: updateWrite.data });
  const [updateUrl, setUpdateUrl] = useState("");
  const [updateDesc, setUpdateDesc] = useState("");
  const [updateEscrowHours, setUpdateEscrowHours] = useState("");

  const deactivateWrite = useWriteContract();
  const deactivateReceipt = useWaitForTransactionReceipt({ hash: deactivateWrite.data });
  const [deactivateAddr, setDeactivateAddr] = useState("");

  const refundWrite = useWriteContract();
  const refundReceipt = useWaitForTransactionReceipt({ hash: refundWrite.data });
  const [refundInvoiceId, setRefundInvoiceId] = useState("");

  const reactivateWrite = useWriteContract();
  const reactivateReceipt = useWaitForTransactionReceipt({ hash: reactivateWrite.data });
  const [reactivateUrl, setReactivateUrl] = useState("");
  const [reactivateDesc, setReactivateDesc] = useState("");
  const [reactivateEscrowHours, setReactivateEscrowHours] = useState("24");

  const releaseWrite = useWriteContract();
  const releaseReceipt = useWaitForTransactionReceipt({ hash: releaseWrite.data });
  const [releaseInvoiceId, setReleaseInvoiceId] = useState("");

  const refundToWrite = useWriteContract();
  const refundToReceipt = useWaitForTransactionReceipt({ hash: refundToWrite.data });
  const [refundToInvoiceId, setRefundToInvoiceId] = useState("");
  const [refundToAddr, setRefundToAddr] = useState("");

  const setTokenWrite = useWriteContract();
  const setTokenReceipt = useWaitForTransactionReceipt({ hash: setTokenWrite.data });
  const [tokenAddr, setTokenAddr] = useState("");
  const [tokenSupported, setTokenSupported] = useState(true);

  // ─── Read query state ───
  const [getSellerAddr, setGetSellerAddr] = useState("");
  const [getSellerResult, setGetSellerResult] = useState<unknown>(undefined);
  const [getSellerError, setGetSellerError] = useState("");
  const [getSellerLoading, setGetSellerLoading] = useState(false);

  const [sellerCountResult, setSellerCountResult] = useState<unknown>(undefined);
  const [sellerCountError, setSellerCountError] = useState("");
  const [sellerCountLoading, setSellerCountLoading] = useState(false);

  const [activeSellersResult, setActiveSellersResult] = useState<unknown>(undefined);
  const [activeSellersError, setActiveSellersError] = useState("");
  const [activeSellersLoading, setActiveSellersLoading] = useState(false);

  const [verifyInvoiceId, setVerifyInvoiceId] = useState("");
  const [verifyAmount, setVerifyAmount] = useState("");
  const [verifyEndpoint, setVerifyEndpoint] = useState("");
  const [verifyResult, setVerifyResult] = useState<unknown>(undefined);
  const [verifyError, setVerifyError] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);

  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  const [paymentResult, setPaymentResult] = useState<unknown>(undefined);
  const [paymentError, setPaymentError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [nonceVal, setNonceVal] = useState("");
  const [nonceResult, setNonceResult] = useState<unknown>(undefined);
  const [nonceError, setNonceError] = useState("");
  const [nonceLoading, setNonceLoading] = useState(false);

  const [checkTokenAddr, setCheckTokenAddr] = useState("");
  const [checkTokenResult, setCheckTokenResult] = useState<unknown>(undefined);
  const [checkTokenError, setCheckTokenError] = useState("");
  const [checkTokenLoading, setCheckTokenLoading] = useState(false);

  const [activeSellersOffset, setActiveSellersOffset] = useState("0");
  const [activeSellersLimit, setActiveSellersLimit] = useState("20");

  const [escrowDurationResult, setEscrowDurationResult] = useState<unknown>(undefined);
  const [escrowDurationError, setEscrowDurationError] = useState("");
  const [escrowDurationLoading, setEscrowDurationLoading] = useState(false);

  const [maxAuthResult, setMaxAuthResult] = useState<unknown>(undefined);
  const [maxAuthError, setMaxAuthError] = useState("");
  const [maxAuthLoading, setMaxAuthLoading] = useState(false);

  const [ownerResult, setOwnerResult] = useState<unknown>(undefined);
  const [ownerError, setOwnerError] = useState("");
  const [ownerLoading, setOwnerLoading] = useState(false);

  // ─── Generic read helper ───
  async function readContract(functionName: string, args: unknown[], setResult: (v: unknown) => void, setError: (v: string) => void, setLoading: (v: boolean) => void) {
    if (!contractAddress) return;
    setLoading(true);
    setError("");
    setResult(undefined);
    try {
      const { createPublicClient, http } = await import("viem");
      const client = createPublicClient({
        chain: chain as Parameters<typeof createPublicClient>[0]["chain"],
        transport: http(),
      });
      const result = await client.readContract({
        address: contractAddress,
        abi: verifierAbi,
        functionName,
        args,
      } as any);
      setResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "register", label: "Register" },
    { id: "write", label: "Write Functions" },
    { id: "read", label: "Read Functions" },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Contract info header */}
        <div className="mb-6 space-y-3">
          <p className="text-gray-400 text-sm">
            On-chain registry + settlement facilitator. Dual-purpose: settlement facilitator (accepts ERC-3009 signed auth, transfers tokens) and on-chain seller registry. CEI pattern + ReentrancyGuard + Ownable2Step.
          </p>
          {contractAddress && explorerUrl && (
            <div className="rounded-xl bg-black/20 border border-gray-700/30 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Facilitator Contract</span>
                <a
                  href={`${explorerUrl}/address/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-conflux-teal hover:underline flex items-center gap-1"
                >
                  View on ConfluxScan <ExternalLink size={10} />
                </a>
              </div>
              <code className="text-conflux-teal font-mono text-[11px] break-all block">{contractAddress}</code>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-conflux-teal/20 text-conflux-teal"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Manifest info — always visible on Register tab */}
        {activeTab === "register" && (
          <div className="rounded-xl border border-conflux-teal/20 bg-conflux-teal/5 p-4 text-sm mb-6">
            <h4 className="text-conflux-teal font-semibold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <BookOpen size={13} /> API Discovery via Manifest
            </h4>
            <p className="text-gray-300 leading-relaxed">
              Serve a manifest at <code className="text-conflux-teal bg-black/20 px-1.5 py-0.5 rounded text-xs">{"{your-api-url}"}/x402/manifest</code> so buyers can auto-discover your endpoints, pricing, and required parameters.
              The boilerplate includes this route by default. APIs with a manifest show full endpoint details in the{" "}
              <Link href="/" className="text-conflux-teal hover:underline">Registered APIs directory</Link>.
            </p>
          </div>
        )}

        {!isConnected && activeTab !== "read" ? (
          <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-conflux-teal/10 flex items-center justify-center mb-5">
              <svg className="w-8 h-8 text-conflux-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">Wallet Not Connected</h3>
            <p className="text-gray-400 max-w-sm">
              Connect your wallet to interact with write functions. Read functions are available without a wallet.
            </p>
          </div>
        ) : !contractAddress ? (
          <div className="glass-card p-8 flex flex-col items-center text-center">
            <AlertTriangle className="text-amber-400 mb-3" size={32} />
            <h3 className="text-white font-semibold text-lg mb-2">No Contract on This Network</h3>
            <p className="text-gray-400 max-w-sm">
              The X402PaymentVerifier contract has not been deployed on <span className="text-white font-medium">{chain.name} ({chainId})</span>.
              Switch your wallet to a network with a deployed contract.
            </p>
          </div>
        ) : (
          <>
            {/* ─── Register Tab ─── */}
            {activeTab === "register" && (
              <div className="space-y-6">
                {/* Current status */}
                {isAlreadyRegistered && (
                  <div className="glass-card p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <CheckCircle className="text-emerald-400 mt-0.5 shrink-0" size={18} />
                      <div>
                        <h3 className="text-white font-semibold text-sm mb-0.5">You are registered</h3>
                        <p className="text-gray-500 text-xs font-mono">{address}</p>
                      </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">API Base URL</span>
                        <span className="text-white font-mono text-xs">{seller!.apiBaseUrl}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Description</span>
                        <span className="text-white text-xs">{seller!.description}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Registered</span>
                        <span className="text-gray-300 text-xs">{new Date(Number(seller!.registeredAt) * 1000).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Escrow Period</span>
                        <span className="text-white text-xs">{Number(seller!.escrowDuration) / 3600}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Status</span>
                        <span className="text-emerald-400 text-xs font-medium">Active</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Register form */}
                {!isAlreadyRegistered && (
                  <WriteCard
                    title="registerSeller"
                    description="Register your wallet as a seller on-chain"
                    icon={<PenTool size={16} />}
                    onSubmit={() => {
                      if (!contractAddress || !regUrl.trim()) return;
                      const hours = regEscrowHours.trim() === "" ? 24 : parseFloat(regEscrowHours);
                      const escrowSeconds = hours === 0 ? BigInt(1) : BigInt(Math.round(hours * 3600));
                      regWrite.writeContract({
                        address: contractAddress,
                        abi: verifierAbi,
                        functionName: "registerSeller",
                        args: [regUrl.trim(), regDesc.trim(), escrowSeconds],
                      });
                    }}
                    isPending={regWrite.isPending}
                    isConfirming={regReceipt.isLoading}
                    isSuccess={regReceipt.isSuccess}
                    txHash={regWrite.data}
                    explorerUrl={explorerUrl}
                    error={regWrite.error?.message}
                  >
                    <FormField label="API Base URL" placeholder="https://api.example.com" value={regUrl} onChange={setRegUrl} type="url" required hint="The public URL of your API server. Serve a manifest at /x402/manifest so buyers can discover your endpoints, pricing, and parameters." />
                    <FormField label="Description" placeholder="My premium API service" value={regDesc} onChange={setRegDesc} hint="Stored on-chain for discoverability" />
                    <FormField label="Escrow Period (hours)" placeholder="24" value={regEscrowHours} onChange={setRegEscrowHours} type="number" hint="How long payments are held before release (0–720 hours, 0 = no escrow, default 24)" />
                  </WriteCard>
                )}

                {/* Update seller (only if registered) */}
                {isAlreadyRegistered && (
                  <WriteCard
                    title="updateSeller"
                    description="Update your API URL and description"
                    icon={<Edit3 size={16} />}
                    onSubmit={() => {
                      if (!contractAddress || !updateUrl.trim()) return;
                      const uHours = updateEscrowHours.trim() === "" ? null : parseFloat(updateEscrowHours);
                      const escrowSeconds = uHours === null ? BigInt(0) : uHours === 0 ? BigInt(1) : BigInt(Math.round(uHours * 3600));
                      updateWrite.writeContract({
                        address: contractAddress,
                        abi: verifierAbi,
                        functionName: "updateSeller",
                        args: [updateUrl.trim(), updateDesc.trim(), escrowSeconds],
                      });
                    }}
                    isPending={updateWrite.isPending}
                    isConfirming={updateReceipt.isLoading}
                    isSuccess={updateReceipt.isSuccess}
                    txHash={updateWrite.data}
                    explorerUrl={explorerUrl}
                    error={updateWrite.error?.message}
                  >
                    <FormField label="New API Base URL" placeholder="https://api.example.com" value={updateUrl} onChange={setUpdateUrl} type="url" required />
                    <FormField label="New Description" placeholder="Updated description" value={updateDesc} onChange={setUpdateDesc} />
                    <FormField label="Escrow Period (hours)" placeholder="Leave empty to keep current" value={updateEscrowHours} onChange={setUpdateEscrowHours} type="number" hint="0 or empty = keep current value" />
                  </WriteCard>
                )}
              </div>
            )}

            {/* ─── Write Functions Tab ─── */}
            {activeTab === "write" && (
              <div className="space-y-6">
                {/* registerSeller */}
                <WriteCard
                  title="registerSeller"
                  description="Anyone — Registers caller's wallet as a seller"
                  icon={<PenTool size={16} />}
                  onSubmit={() => {
                    if (!contractAddress || !regUrl.trim()) return;
                    const hours = regEscrowHours.trim() === "" ? 24 : parseFloat(regEscrowHours);
                      const escrowSeconds = hours === 0 ? BigInt(1) : BigInt(Math.round(hours * 3600));
                    regWrite.writeContract({
                      address: contractAddress,
                      abi: verifierAbi,
                      functionName: "registerSeller",
                      args: [regUrl.trim(), regDesc.trim(), escrowSeconds],
                    });
                  }}
                  isPending={regWrite.isPending}
                  isConfirming={regReceipt.isLoading}
                  isSuccess={regReceipt.isSuccess}
                  txHash={regWrite.data}
                  explorerUrl={explorerUrl}
                  error={regWrite.error?.message}
                >
                  <FormField label="apiBaseUrl" placeholder="https://api.example.com" value={regUrl} onChange={setRegUrl} type="url" required />
                  <FormField label="description" placeholder="My premium API service" value={regDesc} onChange={setRegDesc} />
                  <FormField label="escrowDuration (hours)" placeholder="24" value={regEscrowHours} onChange={setRegEscrowHours} type="number" hint="0–720 hours (0 = no escrow, default 24)" />
                </WriteCard>

                {/* updateSeller */}
                <WriteCard
                  title="updateSeller"
                  description="Registered seller — Updates caller's seller profile"
                  icon={<Edit3 size={16} />}
                  onSubmit={() => {
                    if (!contractAddress || !updateUrl.trim()) return;
                    const uHours = updateEscrowHours.trim() === "" ? null : parseFloat(updateEscrowHours);
                      const escrowSeconds = uHours === null ? BigInt(0) : uHours === 0 ? BigInt(1) : BigInt(Math.round(uHours * 3600));
                    updateWrite.writeContract({
                      address: contractAddress,
                      abi: verifierAbi,
                      functionName: "updateSeller",
                      args: [updateUrl.trim(), updateDesc.trim(), escrowSeconds],
                    });
                  }}
                  isPending={updateWrite.isPending}
                  isConfirming={updateReceipt.isLoading}
                  isSuccess={updateReceipt.isSuccess}
                  txHash={updateWrite.data}
                  explorerUrl={explorerUrl}
                  error={updateWrite.error?.message}
                >
                  <FormField label="apiBaseUrl" placeholder="https://api.example.com" value={updateUrl} onChange={setUpdateUrl} type="url" required />
                  <FormField label="description" placeholder="Updated description" value={updateDesc} onChange={setUpdateDesc} />
                  <FormField label="escrowDuration (hours)" placeholder="0 = keep current" value={updateEscrowHours} onChange={setUpdateEscrowHours} type="number" hint="0 or empty = keep current value" />
                </WriteCard>

                {/* deactivateSeller */}
                <WriteCard
                  title="deactivateSeller"
                  description="Self / Owner — Marks a seller as inactive"
                  icon={<UserMinus size={16} />}
                  onSubmit={() => {
                    if (!contractAddress || !deactivateAddr.trim()) return;
                    deactivateWrite.writeContract({
                      address: contractAddress,
                      abi: verifierAbi,
                      functionName: "deactivateSeller",
                      args: [deactivateAddr.trim() as `0x${string}`],
                    });
                  }}
                  isPending={deactivateWrite.isPending}
                  isConfirming={deactivateReceipt.isLoading}
                  isSuccess={deactivateReceipt.isSuccess}
                  txHash={deactivateWrite.data}
                  explorerUrl={explorerUrl}
                  error={deactivateWrite.error?.message}
                >
                  <FormField label="wallet" placeholder="0x..." value={deactivateAddr} onChange={setDeactivateAddr} required hint="Address to deactivate (your own, or any if you are owner)" />
                </WriteCard>

                {/* refund */}
                <WriteCard
                  title="refund"
                  description="Seller / Owner — Refunds a paid invoice back to the original payer"
                  icon={<Shield size={16} />}
                  onSubmit={() => {
                    if (!contractAddress || !refundInvoiceId.trim()) return;
                    refundWrite.writeContract({
                      address: contractAddress,
                      abi: verifierAbi,
                      functionName: "refund",
                      args: [refundInvoiceId.trim() as `0x${string}`],
                    });
                  }}
                  isPending={refundWrite.isPending}
                  isConfirming={refundReceipt.isLoading}
                  isSuccess={refundReceipt.isSuccess}
                  txHash={refundWrite.data}
                  explorerUrl={explorerUrl}
                  error={refundWrite.error?.message}
                >
                  <FormField label="invoiceId" placeholder="0x..." value={refundInvoiceId} onChange={setRefundInvoiceId} required hint="bytes32 invoice ID" />
                </WriteCard>

                {/* reactivateSeller */}
                <WriteCard
                  title="reactivateSeller"
                  description="Previously deactivated seller — Reactivates registration"
                  icon={<RefreshCw size={16} />}
                  onSubmit={() => {
                    if (!contractAddress || !reactivateUrl.trim()) return;
                    const rHours = reactivateEscrowHours.trim() === "" ? 24 : parseFloat(reactivateEscrowHours);
                    const escrowSeconds = rHours === 0 ? BigInt(1) : BigInt(Math.round(rHours * 3600));
                    reactivateWrite.writeContract({
                      address: contractAddress,
                      abi: verifierAbi,
                      functionName: "reactivateSeller",
                      args: [reactivateUrl.trim(), reactivateDesc.trim(), escrowSeconds],
                    });
                  }}
                  isPending={reactivateWrite.isPending}
                  isConfirming={reactivateReceipt.isLoading}
                  isSuccess={reactivateReceipt.isSuccess}
                  txHash={reactivateWrite.data}
                  explorerUrl={explorerUrl}
                  error={reactivateWrite.error?.message}
                >
                  <FormField label="apiBaseUrl" placeholder="https://api.example.com" value={reactivateUrl} onChange={setReactivateUrl} type="url" required />
                  <FormField label="description" placeholder="My premium API service" value={reactivateDesc} onChange={setReactivateDesc} />
                  <FormField label="escrowDuration (hours)" placeholder="24" value={reactivateEscrowHours} onChange={setReactivateEscrowHours} type="number" hint="0–720 hours (0 = no escrow, default 24)" />
                </WriteCard>

                {/* release */}
                <WriteCard
                  title="release"
                  description="Anyone — Releases escrowed funds to seller after 24h grace period"
                  icon={<Unlock size={16} />}
                  onSubmit={() => {
                    if (!contractAddress || !releaseInvoiceId.trim()) return;
                    releaseWrite.writeContract({
                      address: contractAddress,
                      abi: verifierAbi,
                      functionName: "release",
                      args: [releaseInvoiceId.trim() as `0x${string}`],
                    });
                  }}
                  isPending={releaseWrite.isPending}
                  isConfirming={releaseReceipt.isLoading}
                  isSuccess={releaseReceipt.isSuccess}
                  txHash={releaseWrite.data}
                  explorerUrl={explorerUrl}
                  error={releaseWrite.error?.message}
                >
                  <FormField label="invoiceId" placeholder="0x..." value={releaseInvoiceId} onChange={setReleaseInvoiceId} required hint="bytes32 invoice ID — escrow must have expired" />
                </WriteCard>

                {/* refund */}
                <WriteCard
                  title="refund"
                  description="Seller — Refunds a paid invoice back to the original payer"
                  icon={<Shield size={16} />}
                  onSubmit={() => {
                    if (!contractAddress || !refundInvoiceId.trim()) return;
                    refundWrite.writeContract({
                      address: contractAddress,
                      abi: verifierAbi,
                      functionName: "refund",
                      args: [refundInvoiceId.trim() as `0x${string}`],
                    });
                  }}
                  isPending={refundWrite.isPending}
                  isConfirming={refundReceipt.isLoading}
                  isSuccess={refundReceipt.isSuccess}
                  txHash={refundWrite.data}
                  explorerUrl={explorerUrl}
                  error={refundWrite.error?.message}
                >
                  <FormField label="invoiceId" placeholder="0x..." value={refundInvoiceId} onChange={setRefundInvoiceId} required hint="bytes32 invoice ID" />
                </WriteCard>

                {/* refundTo */}
                <WriteCard
                  title="refundTo"
                  description="Seller — Refunds to an alternative address (e.g. if payer is blocklisted)"
                  icon={<ArrowRightLeft size={16} />}
                  onSubmit={() => {
                    if (!contractAddress || !refundToInvoiceId.trim() || !refundToAddr.trim()) return;
                    refundToWrite.writeContract({
                      address: contractAddress,
                      abi: verifierAbi,
                      functionName: "refundTo",
                      args: [refundToInvoiceId.trim() as `0x${string}`, refundToAddr.trim() as `0x${string}`],
                    });
                  }}
                  isPending={refundToWrite.isPending}
                  isConfirming={refundToReceipt.isLoading}
                  isSuccess={refundToReceipt.isSuccess}
                  txHash={refundToWrite.data}
                  explorerUrl={explorerUrl}
                  error={refundToWrite.error?.message}
                >
                  <FormField label="invoiceId" placeholder="0x..." value={refundToInvoiceId} onChange={setRefundToInvoiceId} required hint="bytes32 invoice ID" />
                  <FormField label="refundRecipient" placeholder="0x..." value={refundToAddr} onChange={setRefundToAddr} required hint="Alternative address to receive the refund" />
                </WriteCard>

                {/* setSupportedToken */}
                <WriteCard
                  title="setSupportedToken"
                  description="Owner only — Adds or removes tokens from the settlement whitelist"
                  icon={<Coins size={16} />}
                  onSubmit={() => {
                    if (!contractAddress || !tokenAddr.trim()) return;
                    setTokenWrite.writeContract({
                      address: contractAddress,
                      abi: verifierAbi,
                      functionName: "setSupportedToken",
                      args: [tokenAddr.trim() as `0x${string}`, tokenSupported],
                    });
                  }}
                  isPending={setTokenWrite.isPending}
                  isConfirming={setTokenReceipt.isLoading}
                  isSuccess={setTokenReceipt.isSuccess}
                  txHash={setTokenWrite.data}
                  explorerUrl={explorerUrl}
                  error={setTokenWrite.error?.message}
                >
                  <FormField label="token" placeholder="0x..." value={tokenAddr} onChange={setTokenAddr} required hint="ERC-3009 token contract address" />
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">supported</label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setTokenSupported(true)}
                        className={`px-3 py-1.5 rounded-lg text-sm ${tokenSupported ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/5 text-gray-400 border border-gray-700/50"}`}
                      >
                        true
                      </button>
                      <button
                        type="button"
                        onClick={() => setTokenSupported(false)}
                        className={`px-3 py-1.5 rounded-lg text-sm ${!tokenSupported ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-white/5 text-gray-400 border border-gray-700/50"}`}
                      >
                        false
                      </button>
                    </div>
                  </div>
                </WriteCard>
              </div>
            )}

            {/* ─── Read Functions Tab ─── */}
            {activeTab === "read" && (
              <div className="space-y-6">
                {/* getSeller */}
                <ReadCard
                  title="getSeller"
                  description="Seller profile: wallet, apiBaseUrl, description, active, registeredAt"
                  icon={<Search size={16} />}
                  onQuery={() => readContract("getSeller", [getSellerAddr.trim() as `0x${string}`], setGetSellerResult, setGetSellerError, setGetSellerLoading)}
                  isLoading={getSellerLoading}
                  result={getSellerResult}
                  error={getSellerError}
                >
                  <FormField label="wallet" placeholder="0x..." value={getSellerAddr} onChange={setGetSellerAddr} required />
                </ReadCard>

                {/* getSellerCount */}
                <ReadCard
                  title="getSellerCount"
                  description="Total number of registered sellers"
                  icon={<Hash size={16} />}
                  onQuery={() => readContract("getSellerCount", [], setSellerCountResult, setSellerCountError, setSellerCountLoading)}
                  isLoading={sellerCountLoading}
                  result={sellerCountResult}
                  error={sellerCountError}
                />

                {/* getActiveSellers */}
                <ReadCard
                  title="getActiveSellers"
                  description="Paginated array of active seller profiles"
                  icon={<Users size={16} />}
                  onQuery={() => readContract("getActiveSellers", [BigInt(activeSellersOffset || "0"), BigInt(activeSellersLimit || "20")], setActiveSellersResult, setActiveSellersError, setActiveSellersLoading)}
                  isLoading={activeSellersLoading}
                  result={activeSellersResult}
                  error={activeSellersError}
                >
                  <FormField label="offset" placeholder="0" value={activeSellersOffset} onChange={setActiveSellersOffset} hint="Starting index" />
                  <FormField label="limit" placeholder="20" value={activeSellersLimit} onChange={setActiveSellersLimit} hint="Max results" />
                </ReadCard>

                {/* verifyPayment */}
                <ReadCard
                  title="verifyPayment"
                  description="(valid, payer) — checks invoice paid with matching amount + endpoint"
                  icon={<CheckCircle size={16} />}
                  onQuery={() => readContract("verifyPayment", [verifyInvoiceId.trim() as `0x${string}`, BigInt(verifyAmount || "0"), verifyEndpoint.trim()], setVerifyResult, setVerifyError, setVerifyLoading)}
                  isLoading={verifyLoading}
                  result={verifyResult}
                  error={verifyError}
                >
                  <FormField label="invoiceId" placeholder="0x..." value={verifyInvoiceId} onChange={setVerifyInvoiceId} required hint="bytes32 invoice ID" />
                  <FormField label="expectedAmount" placeholder="100000" value={verifyAmount} onChange={setVerifyAmount} required hint="Amount in token smallest unit (e.g. 100000 = 0.10 USDT0)" />
                  <FormField label="expectedEndpoint" placeholder="/data/premium" value={verifyEndpoint} onChange={setVerifyEndpoint} required />
                </ReadCard>

                {/* getPayment */}
                <ReadCard
                  title="getPayment"
                  description="Full payment record: payer, recipient, amount, token, endpoint, nonce, expiry, paidAt"
                  icon={<BookOpen size={16} />}
                  onQuery={() => readContract("getPayment", [paymentInvoiceId.trim() as `0x${string}`], setPaymentResult, setPaymentError, setPaymentLoading)}
                  isLoading={paymentLoading}
                  result={paymentResult}
                  error={paymentError}
                >
                  <FormField label="invoiceId" placeholder="0x..." value={paymentInvoiceId} onChange={setPaymentInvoiceId} required hint="bytes32 invoice ID" />
                </ReadCard>

                {/* usedNonces */}
                <ReadCard
                  title="usedNonces"
                  description="bool — whether a nonce has been consumed (replay protection)"
                  icon={<Hash size={16} />}
                  onQuery={() => readContract("usedNonces", [nonceVal.trim() as `0x${string}`], setNonceResult, setNonceError, setNonceLoading)}
                  isLoading={nonceLoading}
                  result={nonceResult}
                  error={nonceError}
                >
                  <FormField label="nonce" placeholder="0x..." value={nonceVal} onChange={setNonceVal} required hint="bytes32 nonce" />
                </ReadCard>

                {/* supportedTokens */}
                <ReadCard
                  title="supportedTokens"
                  description="bool — whether a token is whitelisted for settlement"
                  icon={<Coins size={16} />}
                  onQuery={() => readContract("supportedTokens", [checkTokenAddr.trim() as `0x${string}`], setCheckTokenResult, setCheckTokenError, setCheckTokenLoading)}
                  isLoading={checkTokenLoading}
                  result={checkTokenResult}
                  error={checkTokenError}
                >
                  <FormField label="token address" placeholder="0x..." value={checkTokenAddr} onChange={setCheckTokenAddr} required />
                </ReadCard>

                {/* ESCROW_DURATION */}
                <ReadCard
                  title="ESCROW_DURATION"
                  description="Time (seconds) funds are held in escrow before release"
                  icon={<Shield size={16} />}
                  onQuery={() => readContract("ESCROW_DURATION", [], setEscrowDurationResult, setEscrowDurationError, setEscrowDurationLoading)}
                  isLoading={escrowDurationLoading}
                  result={escrowDurationResult}
                  error={escrowDurationError}
                />

                {/* MAX_AUTH_DURATION */}
                <ReadCard
                  title="MAX_AUTH_DURATION"
                  description="Maximum time (seconds) an ERC-3009 authorization can be valid"
                  icon={<Hash size={16} />}
                  onQuery={() => readContract("MAX_AUTH_DURATION", [], setMaxAuthResult, setMaxAuthError, setMaxAuthLoading)}
                  isLoading={maxAuthLoading}
                  result={maxAuthResult}
                  error={maxAuthError}
                />

                {/* owner */}
                <ReadCard
                  title="owner"
                  description="Contract owner address (admin functions)"
                  icon={<Users size={16} />}
                  onQuery={() => readContract("owner", [], setOwnerResult, setOwnerError, setOwnerLoading)}
                  isLoading={ownerLoading}
                  result={ownerResult}
                  error={ownerError}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

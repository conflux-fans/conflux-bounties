"use client";

import { useState } from "react";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { ConnectKitButton } from "connectkit";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Loader2, AlertTriangle, ExternalLink, Search, Edit3, UserMinus, Shield, Coins, Hash, Users, BookOpen, PenTool } from "lucide-react";
import { NetworkBadge } from "@/components/NetworkBadge";
import { getContractAddress, getChainById } from "@/lib/wagmi";

const verifierAbi = [
  {
    type: "function",
    name: "registerSeller",
    inputs: [
      { name: "apiBaseUrl", type: "string" },
      { name: "description", type: "string" },
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
    name: "refund",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
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
    inputs: [],
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

  // ─── My seller status ───
  const { data: sellerData } = useReadContract({
    address: contractAddress,
    abi: verifierAbi,
    functionName: "getSeller",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });
  const seller = sellerData as { wallet: string; apiBaseUrl: string; description: string; active: boolean; registeredAt: bigint } | undefined;
  const isAlreadyRegistered = seller && seller.wallet !== ZERO_ADDRESS && seller.active;

  // ─── Write contract hooks (one per function) ───
  const regWrite = useWriteContract();
  const regReceipt = useWaitForTransactionReceipt({ hash: regWrite.data });

  const updateWrite = useWriteContract();
  const updateReceipt = useWaitForTransactionReceipt({ hash: updateWrite.data });
  const [updateUrl, setUpdateUrl] = useState("");
  const [updateDesc, setUpdateDesc] = useState("");

  const deactivateWrite = useWriteContract();
  const deactivateReceipt = useWaitForTransactionReceipt({ hash: deactivateWrite.data });
  const [deactivateAddr, setDeactivateAddr] = useState("");

  const refundWrite = useWriteContract();
  const refundReceipt = useWaitForTransactionReceipt({ hash: refundWrite.data });
  const [refundInvoiceId, setRefundInvoiceId] = useState("");

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
      <header className="sticky top-0 z-40 glass">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors px-2 py-1 -ml-2 rounded-lg hover:bg-white/5">
            <ArrowLeft size={16} /> Back
          </Link>
          <div className="h-5 w-px bg-gray-700" />
          <h1 className="text-lg font-bold text-white">X402PaymentVerifier</h1>
          <div className="flex-1" />
          {contractAddress && (
            <a
              href={`${explorerUrl}/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-conflux-teal font-mono flex items-center gap-1 transition-colors"
            >
              {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)} <ExternalLink size={10} />
            </a>
          )}
          <NetworkBadge />
          <ConnectKitButton />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Description */}
        <div className="mb-6">
          <p className="text-gray-400 text-sm">
            On-chain registry + settlement facilitator. Dual-purpose: settlement facilitator (accepts ERC-3009 signed auth, transfers tokens) and on-chain seller registry. CEI pattern + ReentrancyGuard + Ownable2Step.
          </p>
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
                      regWrite.writeContract({
                        address: contractAddress,
                        abi: verifierAbi,
                        functionName: "registerSeller",
                        args: [regUrl.trim(), regDesc.trim()],
                      });
                    }}
                    isPending={regWrite.isPending}
                    isConfirming={regReceipt.isLoading}
                    isSuccess={regReceipt.isSuccess}
                    txHash={regWrite.data}
                    explorerUrl={explorerUrl}
                    error={regWrite.error?.message}
                  >
                    <FormField label="API Base URL" placeholder="https://api.example.com" value={regUrl} onChange={setRegUrl} type="url" required hint="The public URL of your API server" />
                    <FormField label="Description" placeholder="My premium API service" value={regDesc} onChange={setRegDesc} hint="Stored on-chain for discoverability" />
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
                      updateWrite.writeContract({
                        address: contractAddress,
                        abi: verifierAbi,
                        functionName: "updateSeller",
                        args: [updateUrl.trim(), updateDesc.trim()],
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
                    regWrite.writeContract({
                      address: contractAddress,
                      abi: verifierAbi,
                      functionName: "registerSeller",
                      args: [regUrl.trim(), regDesc.trim()],
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
                </WriteCard>

                {/* updateSeller */}
                <WriteCard
                  title="updateSeller"
                  description="Registered seller — Updates caller's seller profile"
                  icon={<Edit3 size={16} />}
                  onSubmit={() => {
                    if (!contractAddress || !updateUrl.trim()) return;
                    updateWrite.writeContract({
                      address: contractAddress,
                      abi: verifierAbi,
                      functionName: "updateSeller",
                      args: [updateUrl.trim(), updateDesc.trim()],
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
                  description="Array of all active seller profiles"
                  icon={<Users size={16} />}
                  onQuery={() => readContract("getActiveSellers", [], setActiveSellersResult, setActiveSellersError, setActiveSellersLoading)}
                  isLoading={activeSellersLoading}
                  result={activeSellersResult}
                  error={activeSellersError}
                />

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
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

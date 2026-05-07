export interface X402PaymentChallenge {
  amount: string; // token smallest unit (e.g. 6 decimals for USDT0)
  token: string; // ERC-3009 token address (USDT0, AxCNH)
  nonce: string; // unique per-request
  expiry: number; // unix timestamp (seconds) — maps to validBefore in ERC-3009
  endpoint: string; // path that requires payment
  invoiceId: string; // ephemeral invoice ID
  description?: string;
  recipient?: string; // payment recipient address (service wallet)
  verifierAddress?: string; // X402PaymentVerifier contract address — `to` in ReceiveWithAuthorization
}

/**
 * ERC-3009 authorization payload — the buyer signs this off-chain,
 * the facilitator submits it on-chain.
 */
export interface ERC3009Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string; // bytes32 hex
}

/**
 * Signed authorization ready for on-chain settlement.
 */
export interface SignedAuthorization extends ERC3009Authorization {
  v: number;
  r: string;
  s: string;
}

export interface Invoice {
  id: string;
  endpoint: string;
  amount: string;
  token: string;
  nonce: string;
  expiry: number;
  status: InvoiceStatus;
  payer?: string;
  txHash?: string;
  authorization?: SignedAuthorization;
  createdAt: Date;
  updatedAt: Date;
}

export type InvoiceStatus = "pending" | "paid" | "expired" | "refunded";

export interface UsageLog {
  id: string;
  apiKeyId: string;
  endpoint: string;
  invoiceId?: string;
  statusCode: number;
  responseTimeMs: number;
  timestamp: Date;
}

export interface ApiKey {
  id: string;
  key: string;
  label: string;
  ownerId: string;
  rateLimit: number; // requests per minute
  enabled: boolean;
  createdAt: Date;
}

export interface EndpointPricing {
  endpoint: string;
  price: string; // token smallest unit
  token: string;
  description: string;
  tier: "free" | "premium";
}

export interface AgentSession {
  id: string;
  agentAddress: string;
  totalSpent: string;
  spendCap: string;
  dailyBudget: string;
  dailySpent: string;
  dailyResetAt: Date;
  lastActiveAt: Date;
}

export interface PaymentReceipt {
  invoiceId: string;
  txHash: string;
  payer: string;
  amount: string;
  token: string;
  endpoint: string;
  nonce: string;
  blockNumber: number;
  timestamp: number;
}

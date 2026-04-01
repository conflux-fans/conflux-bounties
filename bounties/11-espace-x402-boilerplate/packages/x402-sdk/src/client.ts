import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { verifierAbi } from "./abi.js";
import { confluxESpaceTestnet } from "./chain.js";
import { RECEIVE_WITH_AUTHORIZATION_TYPES, ERC3009_DOMAIN, getERC3009Domain, splitSignature, hashNonce, hashInvoiceId } from "@x402/shared";

export interface X402PaymentChallenge {
  amount: string;
  token: string;
  nonce: string;
  expiry: number;
  endpoint: string;
  invoiceId: string;
  description?: string;
  recipient?: string;
  verifierAddress?: string;
}

export interface SignedAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
  v: number;
  r: string;
  s: string;
}

export interface X402ClientConfig {
  contractAddress: `0x${string}`;
  privateKey?: `0x${string}`;
  rpcUrl?: string;
  chain?: Chain;
  /** ERC-3009 token domain name (default: "USD Tether 0") */
  tokenDomainName?: string;
  /** ERC-3009 token domain version (default: "1") */
  tokenDomainVersion?: string;
}

export class X402Client {
  public readonly publicClient: PublicClient;
  public readonly walletClient?: WalletClient;
  public readonly contractAddress: `0x${string}`;
  private readonly account?: ReturnType<typeof privateKeyToAccount>;
  private readonly chain: Chain;
  private readonly tokenDomainName: string;
  private readonly tokenDomainVersion: string;

  constructor(config: X402ClientConfig) {
    this.contractAddress = config.contractAddress;
    this.chain = config.chain ?? confluxESpaceTestnet;
    this.tokenDomainName = config.tokenDomainName ?? ERC3009_DOMAIN.name;
    this.tokenDomainVersion = config.tokenDomainVersion ?? ERC3009_DOMAIN.version;
    const transport = http(config.rpcUrl ?? this.chain.rpcUrls.default.http[0]);

    this.publicClient = createPublicClient({ chain: this.chain, transport });

    if (config.privateKey) {
      this.account = privateKeyToAccount(config.privateKey);
      this.walletClient = createWalletClient({
        account: this.account,
        chain: this.chain,
        transport,
      });
    }
  }

  get address(): `0x${string}` | undefined {
    return this.account?.address;
  }

  /**
   * Sign an ERC-3009 receiveWithAuthorization off-chain.
   * The `to` field is the verifier contract address (not the seller).
   * The verifier receives funds first, then forwards to the seller.
   * Returns the signed authorization — does NOT submit any on-chain transaction.
   */
  async signAuthorization(challenge: X402PaymentChallenge): Promise<SignedAuthorization> {
    if (!this.walletClient || !this.account) {
      throw new Error("Wallet not configured — provide a privateKey");
    }

    // The verifier contract address is the `to` in ReceiveWithAuthorization.
    // It can come from the challenge (preferred) or fall back to this client's contractAddress.
    const verifierAddr = (challenge.verifierAddress ?? this.contractAddress) as `0x${string}`;
    if (!verifierAddr || verifierAddr === "0x0000000000000000000000000000000000000000") {
      throw new Error("Payment challenge missing verifierAddress (X402PaymentVerifier contract)");
    }

    const validAfter = 0;
    const validBefore = challenge.expiry;
    const nonce = hashNonce(challenge.nonce);

    // Auto-detect domain from token address if not explicitly configured.
    const autoDetected = getERC3009Domain(challenge.token);
    const domain = {
      name: this.tokenDomainName !== ERC3009_DOMAIN.name ? this.tokenDomainName : autoDetected.name,
      version: this.tokenDomainVersion !== ERC3009_DOMAIN.version ? this.tokenDomainVersion : autoDetected.version,
      chainId: BigInt(this.chain.id),
      verifyingContract: challenge.token as `0x${string}`,
    };

    const message = {
      from: this.account.address,
      to: verifierAddr,
      value: BigInt(challenge.amount),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce: nonce as `0x${string}`,
    };

    const signature = await this.walletClient.signTypedData({
      account: this.account,
      domain,
      types: RECEIVE_WITH_AUTHORIZATION_TYPES,
      primaryType: "ReceiveWithAuthorization",
      message,
    });

    const { v, r, s } = splitSignature(signature);

    return {
      from: this.account.address,
      to: verifierAddr,
      value: challenge.amount,
      validAfter,
      validBefore,
      nonce,
      v,
      r,
      s,
    };
  }

  /**
   * Submit a signed authorization to the seller API for settlement.
   * The seller API acts as the facilitator and calls the on-chain settle().
   */
  async submitAuthorization(
    apiBase: string,
    invoiceId: string,
    auth: SignedAuthorization
  ): Promise<{ txHash?: string; verified: boolean }> {
    let res: Response;
    try {
      res = await fetch(`${apiBase}/invoices/${invoiceId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorization: auth }),
      });
    } catch (err) {
      throw new Error(`Settlement request failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!res.ok && res.status !== 200) {
      let details = "";
      try { details = await res.text(); } catch { /* ignore */ }
      throw new Error(`Settlement returned HTTP ${res.status}: ${details.slice(0, 200)}`);
    }

    try {
      return await res.json() as { txHash?: string; verified: boolean };
    } catch {
      throw new Error(`Settlement returned non-JSON response (HTTP ${res.status})`);
    }
  }

  /**
   * Full x402 payment flow: sign authorization + submit to seller for settlement.
   * Returns the signed authorization (no on-chain tx from the client).
   */
  async payInvoice(challenge: X402PaymentChallenge): Promise<SignedAuthorization> {
    return this.signAuthorization(challenge);
  }

  async waitForPayment(txHash: Hash) {
    return this.publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120_000,
      pollingInterval: 2_000,
    });
  }

  async verifyPayment(
    invoiceId: string,
    expectedAmount: bigint,
    expectedEndpoint: string
  ): Promise<{ valid: boolean; payer: string }> {
    const invoiceIdHash = hashInvoiceId(invoiceId);

    const result = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: verifierAbi,
      functionName: "verifyPayment",
      args: [invoiceIdHash, expectedAmount, expectedEndpoint],
    })) as [boolean, string];

    return { valid: result[0], payer: result[1] };
  }

  async getPayment(invoiceId: string) {
    const invoiceIdHash = hashInvoiceId(invoiceId);

    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: verifierAbi,
      functionName: "getPayment",
      args: [invoiceIdHash],
    });
  }
}

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
  type Chain,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { verifierAbi } from "./abi.js";
import { confluxESpaceTestnet } from "./chain.js";
import { hashInvoiceId } from "@x402/shared";
import type { SignedAuthorization } from "./client.js";

export interface VerifierConfig {
  contractAddress: `0x${string}`;
  rpcUrl?: string;
  chain?: Chain;
  /** Private key for the facilitator wallet that pays gas for settlement */
  facilitatorKey?: `0x${string}`;
}

export class X402Verifier {
  private readonly client: PublicClient;
  private readonly walletClient?: WalletClient;
  private readonly contractAddress: `0x${string}`;
  private readonly account?: ReturnType<typeof privateKeyToAccount>;

  constructor(config: VerifierConfig) {
    this.contractAddress = config.contractAddress;
    const chain = config.chain ?? confluxESpaceTestnet;
    const transport = http(config.rpcUrl ?? chain.rpcUrls.default.http[0]);

    this.client = createPublicClient({ chain, transport });

    if (config.facilitatorKey) {
      this.account = privateKeyToAccount(config.facilitatorKey);
      this.walletClient = createWalletClient({
        account: this.account,
        chain,
        transport,
      });
    }
  }

  /**
   * Settle an x402 payment on-chain by submitting the buyer's signed
   * ERC-3009 receiveWithAuthorization to the X402PaymentVerifier contract.
   * The facilitator (seller) pays the gas. msg.sender must equal recipient.
   *
   * The buyer signs ReceiveWithAuthorization with `to = verifier contract`.
   * The verifier receives funds, then forwards to the recipient (seller).
   *
   * @param recipient The seller's wallet address — must equal msg.sender (this.account)
   */
  async settle(
    invoiceId: string,
    tokenAddress: `0x${string}`,
    endpoint: string,
    auth: SignedAuthorization,
    recipient?: `0x${string}`
  ): Promise<Hash> {
    if (!this.walletClient || !this.account) {
      throw new Error("Facilitator wallet not configured — provide facilitatorKey");
    }

    const invoiceIdHash = hashInvoiceId(invoiceId);
    // recipient defaults to the facilitator's own address (seller == facilitator)
    const recipientAddr = recipient ?? this.account.address;

    const settleArgs = [
      invoiceIdHash,
      tokenAddress,
      auth.from as `0x${string}`,
      recipientAddr,
      BigInt(auth.value),
      BigInt(auth.validAfter),
      BigInt(auth.validBefore),
      auth.nonce as `0x${string}`,
      endpoint,
      auth.v,
      auth.r as `0x${string}`,
      auth.s as `0x${string}`,
    ] as const;

    // Dry-run via eth_call to catch reverts before spending gas.
    try {
      await this.client.simulateContract({
        address: this.contractAddress,
        abi: verifierAbi,
        functionName: "settle",
        args: settleArgs,
        account: this.account,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Settlement simulation failed (would revert on-chain): ${reason.slice(0, 300)}`);
    }

    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: verifierAbi,
      functionName: "settle",
      args: settleArgs,
      chain: this.walletClient.chain,
      account: this.account,
    });

    return hash;
  }

  /**
   * Release escrowed funds to the seller after the grace period (24 hours).
   * Anyone can call this (permissionless) since it only sends to the recorded recipient.
   */
  async release(invoiceId: string): Promise<Hash> {
    if (!this.walletClient || !this.account) {
      throw new Error("Facilitator wallet not configured — provide facilitatorKey");
    }

    const invoiceIdHash = hashInvoiceId(invoiceId);

    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: verifierAbi,
      functionName: "release",
      args: [invoiceIdHash],
      chain: this.walletClient.chain,
      account: this.account,
    });

    return hash;
  }

  /**
   * Refund a paid invoice back to the original payer.
   * Only the payment recipient (seller) can call this.
   * Funds are held in escrow, so no ERC-20 approval is needed.
   */
  async refund(invoiceId: string): Promise<Hash> {
    if (!this.walletClient || !this.account) {
      throw new Error("Facilitator wallet not configured — provide facilitatorKey");
    }

    const invoiceIdHash = hashInvoiceId(invoiceId);

    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: verifierAbi,
      functionName: "refund",
      args: [invoiceIdHash],
      chain: this.walletClient.chain,
      account: this.account,
    });

    return hash;
  }

  /**
   * Refund a paid invoice to an alternative address (e.g., if the original
   * payer is blocklisted). Only the payment recipient (seller) can call this.
   */
  async refundTo(invoiceId: string, refundRecipient: `0x${string}`): Promise<Hash> {
    if (!this.walletClient || !this.account) {
      throw new Error("Facilitator wallet not configured — provide facilitatorKey");
    }

    const invoiceIdHash = hashInvoiceId(invoiceId);

    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: verifierAbi,
      functionName: "refundTo",
      args: [invoiceIdHash, refundRecipient],
      chain: this.walletClient.chain,
      account: this.account,
    });

    return hash;
  }

  /**
   * Register the facilitator's wallet as a seller on the contract.
   */
  async registerSeller(apiBaseUrl: string, description: string, escrowDurationSeconds: bigint = BigInt(0)): Promise<Hash> {
    if (!this.walletClient || !this.account) {
      throw new Error("Facilitator wallet not configured — provide facilitatorKey");
    }

    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: verifierAbi,
      functionName: "registerSeller",
      args: [apiBaseUrl, description, escrowDurationSeconds],
      chain: this.walletClient.chain,
      account: this.account,
    });

    return hash;
  }

  /**
   * Update seller profile.
   * @param escrowDurationSeconds 0 = keep current value.
   */
  async updateSeller(apiBaseUrl: string, description: string, escrowDurationSeconds: bigint = BigInt(0)): Promise<Hash> {
    if (!this.walletClient || !this.account) {
      throw new Error("Facilitator wallet not configured — provide facilitatorKey");
    }

    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: verifierAbi,
      functionName: "updateSeller",
      args: [apiBaseUrl, description, escrowDurationSeconds],
      chain: this.walletClient.chain,
      account: this.account,
    });

    return hash;
  }

  async isInvoicePaid(
    invoiceId: string,
    expectedAmount: bigint,
    expectedEndpoint: string
  ): Promise<{ valid: boolean; payer: string }> {
    const invoiceIdHash = hashInvoiceId(invoiceId);
    const result = (await this.client.readContract({
      address: this.contractAddress,
      abi: verifierAbi,
      functionName: "verifyPayment",
      args: [invoiceIdHash, expectedAmount, expectedEndpoint],
    })) as [boolean, string];
    return { valid: result[0], payer: result[1] };
  }

  async isNonceUsed(from: `0x${string}`, nonce: `0x${string}`): Promise<boolean> {
    const scopedHash = keccak256(
      `0x${from.slice(2)}${nonce.slice(2)}` as `0x${string}`
    );
    return (await this.client.readContract({
      address: this.contractAddress,
      abi: verifierAbi,
      functionName: "usedNonces",
      args: [scopedHash],
    })) as boolean;
  }

  async getSeller(wallet: `0x${string}`): Promise<{
    wallet: string;
    apiBaseUrl: string;
    description: string;
    active: boolean;
    registeredAt: bigint;
  }> {
    return (await this.client.readContract({
      address: this.contractAddress,
      abi: verifierAbi,
      functionName: "getSeller",
      args: [wallet],
    })) as any;
  }

  async getActiveSellers(offset = 0n, limit = 50n): Promise<Array<{
    wallet: string;
    apiBaseUrl: string;
    description: string;
    active: boolean;
    registeredAt: bigint;
  }>> {
    return (await this.client.readContract({
      address: this.contractAddress,
      abi: verifierAbi,
      functionName: "getActiveSellers",
      args: [offset, limit],
    })) as any;
  }

  async getSellerCount(): Promise<bigint> {
    return (await this.client.readContract({
      address: this.contractAddress,
      abi: verifierAbi,
      functionName: "getSellerCount",
      args: [],
    })) as bigint;
  }

  async waitForTx(txHash: Hash) {
    return this.client.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120_000,       // 2 min — Conflux eSpace testnet blocks can be slow
      pollingInterval: 2_000, // check every 2s
    });
  }
}

import { X402Client } from "@x402/sdk";
import { parsePaymentHeaders, TOKEN_DECIMALS } from "@x402/shared";
import { logger } from "./logger.js";
import { SpendTracker, type SpendState } from "./spend.js";
import { AgentStore, type TransactionRecord } from "./store.js";
import { randomUUID } from "node:crypto";

export interface AgentConfig {
  apiBase: string;
  privateKey: `0x${string}`;
  contractAddress: `0x${string}`;
  rpcUrl: string;
  spendCap: string;
  dailyBudget: string;
  pollIntervalMs: number;
  maxRetries: number;
  dbPath?: string;
}

export class X402Agent {
  private client: X402Client;
  private spend: SpendTracker;
  private config: AgentConfig;
  private store?: AgentStore;
  private sessionId: string;

  constructor(config: AgentConfig) {
    this.config = config;
    this.sessionId = randomUUID();
    this.client = new X402Client({
      contractAddress: config.contractAddress,
      privateKey: config.privateKey,
      rpcUrl: config.rpcUrl,
    });

    // Initialize SQLite store if dbPath is provided
    let restoredSpend: SpendState | undefined;
    if (config.dbPath) {
      try {
        this.store = new AgentStore(config.dbPath);
        // Restore spend state from last session to survive restarts
        const savedState = this.store.getMemory("spend_state");
        if (savedState) {
          restoredSpend = JSON.parse(savedState) as SpendState;
          logger.info(
            { totalSpent: restoredSpend.totalSpent, txCount: restoredSpend.txCount },
            "Restored spend state from previous session"
          );
        }
        this.store.createSession(this.sessionId, this.client.address || "unknown");
        logger.info({ sessionId: this.sessionId }, "Session persisted to SQLite");
      } catch (err) {
        logger.warn({ err }, "SQLite store unavailable — running in-memory only");
      }
    }

    this.spend = new SpendTracker(config.spendCap, config.dailyBudget, restoredSpend);

    logger.info(
      { address: this.client.address, sessionId: this.sessionId },
      "Agent wallet initialized"
    );
  }

  get address(): string | undefined {
    return this.client.address;
  }

  get session(): string {
    return this.sessionId;
  }

  /**
   * Call an API endpoint, automatically handling 402 payment challenges.
   *
   * Flow:
   * 1. Make HTTP request
   * 2. If 200 OK → return data
   * 3. If 402 → parse challenge → check budget → sign ERC-3009 auth → settle → retry
   * 4. If retry succeeds → return data
   */
  async callEndpoint(path: string, method = "GET", body?: unknown): Promise<unknown> {
    const url = `${this.config.apiBase}${path}`;
    logger.info({ method, path }, "Calling endpoint");

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        logger.error({ path, err }, "Network error calling endpoint");
        throw new Error(`Network error calling ${path}: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (res.ok) {
        try {
          const data = await res.json();
          logger.info({ path, status: res.status }, "Endpoint returned OK");
          return data;
        } catch {
          logger.warn({ path }, "Response OK but non-JSON body");
          return { status: res.status, body: await res.text().catch(() => "") };
        }
      }

      if (res.status === 402) {
        logger.info({ path }, "Received 402 — payment required (ERC-3009)");

        // Parse challenge from headers + body
        const headersObj: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          headersObj[k] = v;
        });
        let resBody: Record<string, string>;
        try {
          resBody = (await res.json()) as Record<string, string>;
        } catch {
          logger.error({ path }, "402 response had non-JSON body");
          throw new Error(`402 response from ${path} had invalid JSON body`);
        }
        const challenge = parsePaymentHeaders({
          ...headersObj,
          "x-payment-amount": headersObj["x-payment-amount"] || resBody["x-payment-amount"],
          "x-payment-token": headersObj["x-payment-token"] || resBody["x-payment-token"],
          "x-payment-nonce": headersObj["x-payment-nonce"] || resBody["x-payment-nonce"],
          "x-payment-expiry": headersObj["x-payment-expiry"] || resBody["x-payment-expiry"],
          "x-payment-endpoint": headersObj["x-payment-endpoint"] || resBody["x-payment-endpoint"],
          "x-payment-invoice-id":
            headersObj["x-payment-invoice-id"] || resBody["x-payment-invoice-id"],
          "x-payment-recipient":
            headersObj["x-payment-recipient"] || resBody["x-payment-recipient"],
          "x-payment-verifier":
            headersObj["x-payment-verifier"] || resBody["x-payment-verifier"],
        });

        // Check if admin has paused this agent
        try {
          const statusRes = await fetch(`${this.config.apiBase}/agent/${this.client.address}/status`);
          if (statusRes.ok) {
            const statusData = await statusRes.json() as { paused: boolean; reason?: string };
            if (statusData.paused) {
              logger.warn({ reason: statusData.reason }, "Agent paused by admin — aborting");
              throw new Error(`Agent paused by admin${statusData.reason ? `: ${statusData.reason}` : ""}`);
            }
          }
        } catch (pauseErr) {
          // If the pause check itself fails (not a pause error), log and continue
          if (pauseErr instanceof Error && pauseErr.message.startsWith("Agent paused")) throw pauseErr;
          logger.warn({ err: pauseErr }, "Could not check agent pause status — continuing");
        }

        // Check spend limits
        if (!this.spend.canSpend(BigInt(challenge.amount))) {
          logger.warn({ amount: challenge.amount }, "Spend cap reached — aborting");
          throw new Error("Spend cap exceeded");
        }

        // Sign ERC-3009 receiveWithAuthorization off-chain (no gas for agent)
        const humanAmount = (Number(challenge.amount) / 10 ** TOKEN_DECIMALS).toFixed(2);
        logger.info(
          { invoiceId: challenge.invoiceId, amount: `${humanAmount} USDT0` },
          "Signing ERC-3009 authorization"
        );
        const signedAuth = await this.client.signAuthorization(challenge);
        logger.info({ from: signedAuth.from }, "Authorization signed (off-chain, no gas)");

        // Record transaction
        const txRecord: TransactionRecord = {
          sessionId: this.sessionId,
          endpoint: path,
          invoiceId: challenge.invoiceId,
          amount: challenge.amount,
          token: challenge.token,
          status: "signed",
          timestamp: new Date().toISOString(),
        };

        // Submit signed authorization to seller for settlement
        const settleRes = await this.client.submitAuthorization(
          this.config.apiBase,
          challenge.invoiceId,
          signedAuth
        );
        logger.info(
          { verified: settleRes.verified, txHash: settleRes.txHash },
          "Settlement response"
        );

        if (!settleRes.verified) {
          txRecord.status = "failed";
          this.store?.recordTransaction(txRecord);
          logger.warn({ invoiceId: challenge.invoiceId }, "Settlement not verified — retrying");
          continue;
        }

        txRecord.status = "settled";
        txRecord.txHash = settleRes.txHash;
        this.store?.recordTransaction(txRecord);
        this.spend.recordSpend(BigInt(challenge.amount));
        // Persist spend state so it survives restarts
        this.store?.setMemory("spend_state", JSON.stringify(this.spend.getState()));

        // Retry the original request with the paid invoice
        logger.info({ path, attempt: attempt + 1 }, "Retrying with paid invoice");
        const retryRes = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "x-payment-invoice-id": challenge.invoiceId,
            "x-payment-payer": signedAuth.from,
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        if (retryRes.ok) {
          const data = await retryRes.json();
          logger.info({ path }, "Premium data retrieved successfully");
          return data;
        }

        logger.warn({ path, status: retryRes.status }, "Retry failed");
        continue;
      }

      logger.error({ path, status: res.status }, "Unexpected status");
      throw new Error(`Endpoint returned ${res.status}`);
    }

    throw new Error(`Max retries exceeded for ${path}`);
  }

  /**
   * Get current spend summary (used by LangChain budget tool).
   */
  getSpendSummary() {
    return this.spend.getSummary();
  }

  /**
   * Print a formatted session summary to the logger.
   */
  printSessionSummary() {
    const summary = this.spend.getSummary();
    const totalUsdt = (Number(summary.totalSpent) / 10 ** TOKEN_DECIMALS).toFixed(2);
    const dailyUsdt = (Number(summary.dailySpent) / 10 ** TOKEN_DECIMALS).toFixed(2);
    const remainUsdt = (Number(summary.remainingCap) / 10 ** TOKEN_DECIMALS).toFixed(2);

    logger.info(
      {
        sessionId: this.sessionId,
        totalSpent: `${totalUsdt} USDT0`,
        dailySpent: `${dailyUsdt} USDT0`,
        remainingCap: `${remainUsdt} USDT0`,
        transactions: summary.txCount,
      },
      "Session summary"
    );

    // Persist session end to SQLite
    if (this.store) {
      this.store.endSession(this.sessionId, summary.totalSpent, summary.txCount);

      // Print past sessions
      const recent = this.store.getRecentSessions(5);
      if (recent.length > 1) {
        logger.info({ pastSessions: recent.length }, "Recent sessions in database");
      }
    }
  }

  /**
   * Close the agent and its resources.
   */
  close() {
    this.store?.close();
  }
}

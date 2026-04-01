/**
 * SQLite-backed session persistence for the x402 agent.
 * Stores session summaries, transaction logs, and agent memory.
 */
import Database from "better-sqlite3";
import { logger } from "./logger.js";

export interface TransactionRecord {
  id?: number;
  sessionId: string;
  endpoint: string;
  invoiceId: string;
  amount: string;
  token: string;
  status: "signed" | "settled" | "failed";
  txHash?: string;
  timestamp: string;
}

export interface SessionRecord {
  id: string;
  agentAddress: string;
  startedAt: string;
  endedAt?: string;
  totalSpent: string;
  txCount: number;
  status: "active" | "completed" | "failed";
}

export class AgentStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
    logger.info({ dbPath }, "Agent store initialized");
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent_address TEXT NOT NULL,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at TEXT,
        total_spent TEXT NOT NULL DEFAULT '0',
        tx_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        invoice_id TEXT NOT NULL,
        amount TEXT NOT NULL,
        token TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'signed',
        tx_hash TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE TABLE IF NOT EXISTS agent_memory (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  // ─── Sessions ───

  createSession(id: string, agentAddress: string): SessionRecord {
    this.db.prepare(`
      INSERT INTO sessions (id, agent_address) VALUES (?, ?)
    `).run(id, agentAddress);

    return {
      id,
      agentAddress,
      startedAt: new Date().toISOString(),
      totalSpent: "0",
      txCount: 0,
      status: "active",
    };
  }

  endSession(id: string, totalSpent: string, txCount: number) {
    this.db.prepare(`
      UPDATE sessions SET ended_at = datetime('now'), total_spent = ?, tx_count = ?, status = 'completed'
      WHERE id = ?
    `).run(totalSpent, txCount, id);
  }

  getSession(id: string): SessionRecord | undefined {
    return this.db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as SessionRecord | undefined;
  }

  getRecentSessions(limit = 10): SessionRecord[] {
    return this.db.prepare(`
      SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?
    `).all(limit) as SessionRecord[];
  }

  // ─── Transactions ───

  recordTransaction(tx: TransactionRecord) {
    this.db.prepare(`
      INSERT INTO transactions (session_id, endpoint, invoice_id, amount, token, status, tx_hash, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(tx.sessionId, tx.endpoint, tx.invoiceId, tx.amount, tx.token, tx.status, tx.txHash || null, tx.timestamp);
  }

  getSessionTransactions(sessionId: string): TransactionRecord[] {
    return this.db.prepare(`
      SELECT * FROM transactions WHERE session_id = ? ORDER BY timestamp ASC
    `).all(sessionId) as TransactionRecord[];
  }

  // ─── Memory (key-value for agent state) ───

  setMemory(key: string, value: string) {
    this.db.prepare(`
      INSERT OR REPLACE INTO agent_memory (key, value, updated_at) VALUES (?, ?, datetime('now'))
    `).run(key, value);
  }

  getMemory(key: string): string | undefined {
    const row = this.db.prepare(`SELECT value FROM agent_memory WHERE key = ?`).get(key) as { value: string } | undefined;
    return row?.value;
  }

  close() {
    this.db.close();
  }
}

/**
 * Queue Manager - SQLite-based delivery queue for reliable webhook delivery
 */
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const QUEUE_STATES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed'
}

class QueueManager {
  constructor (dbPath) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'queue.db')
    this.db = null
  }

  init () {
    const dir = path.dirname(this.dbPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    this.db = new Database(this.dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY,
        subscription_id TEXT NOT NULL,
        event_name TEXT NOT NULL,
        webhook_url TEXT NOT NULL,
        format TEXT NOT NULL DEFAULT 'generic',
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        delivered_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
      CREATE INDEX IF NOT EXISTS idx_deliveries_created ON deliveries(created_at);
    `)

    return this
  }

  enqueue (delivery) {
    const id = `${delivery.subscriptionId}_${delivery.eventName}_${delivery.webhookUrl}_${Date.now()}`

    const stmt = this.db.prepare(`
      INSERT INTO deliveries (id, subscription_id, event_name, webhook_url, format, payload, max_attempts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      delivery.subscriptionId,
      delivery.eventName,
      delivery.webhookUrl,
      delivery.format || 'generic',
      JSON.stringify(delivery.payload),
      delivery.maxAttempts || 3
    )

    return id
  }

  getNext (limit = 10) {
    const stmt = this.db.prepare(`
      SELECT * FROM deliveries
      WHERE status = 'pending' AND attempts < max_attempts
      ORDER BY created_at ASC
      LIMIT ?
    `)
    return stmt.all(limit)
  }

  markProcessing (id) {
    this.db.prepare(`UPDATE deliveries SET status = 'processing', updated_at = datetime('now') WHERE id = ?`).run(id)
  }

  markSucceeded (id) {
    this.db.prepare(`
      UPDATE deliveries SET status = 'succeeded', delivered_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
    `).run(id)
  }

  markFailed (id, error) {
    this.db.prepare(`
      UPDATE deliveries SET
        status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
        last_error = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(error, id)
  }

  incrementAttempts (id) {
    this.db.prepare(`UPDATE deliveries SET attempts = attempts + 1 WHERE id = ?`).run(id)
  }

  getStats () {
    const stats = this.db.prepare(`
      SELECT status, COUNT(*) as count FROM deliveries GROUP BY status
    `).all()

    const result = { pending: 0, processing: 0, succeeded: 0, failed: 0 }
    for (const row of stats) {
      result[row.status] = row.count
    }
    return result
  }

  getRecent (limit = 20) {
    return this.db.prepare(`
      SELECT id, subscription_id, event_name, webhook_url, status, attempts, created_at, delivered_at
      FROM deliveries ORDER BY created_at DESC LIMIT ?
    `).all(limit)
  }

  cleanup (daysOld = 30) {
    const result = this.db.prepare(`
      DELETE FROM deliveries WHERE status IN ('succeeded', 'failed') AND created_at < datetime('now', ?)
    `).run(`-${daysOld} days`)
    return result.changes
  }

  close () {
    if (this.db) this.db.close()
  }
}

module.exports = { QueueManager, QUEUE_STATES }

/**
 * Seed script that populates the database with demo nodes,
 * 24 hours of simulated metrics, and sample alert rules.
 * Usage: pnpm --filter server seed
 */

import path from "path";
import { Database } from "../server/src/database/Database";
import { NodeRepository } from "../server/src/database/NodeRepository";
import { MetricRepository } from "../server/src/database/MetricRepository";
import { AlertRepository } from "../server/src/database/AlertRepository";

const DB_PATH = process.env.DATABASE_PATH || path.resolve(__dirname, "../data/dashboard.db");

const DEMO_NODES = [
  { name: "Conflux Core Mainnet", rpcUrl: "https://main.confluxrpc.com", spaceType: "core" as const },
  { name: "Conflux eSpace Mainnet", rpcUrl: "https://evm.confluxrpc.com", spaceType: "espace" as const },
  { name: "Conflux Core Testnet", rpcUrl: "https://test.confluxrpc.com", spaceType: "core" as const },
  { name: "Conflux eSpace Testnet", rpcUrl: "https://evmtestnet.confluxrpc.com", spaceType: "espace" as const },
  { name: "Local Dev Node", rpcUrl: "http://localhost:12537", spaceType: "core" as const },
];

/** Generate a random value with some noise around a base */
function jitter(base: number, variance: number): number {
  return Math.round((base + (Math.random() - 0.5) * 2 * variance) * 100) / 100;
}

async function main() {
  console.log(`\nSeeding demo data into: ${DB_PATH}\n`);

  const db = new Database(DB_PATH);
  db.migrate();

  const nodeRepo = new NodeRepository(db.db);
  const metricRepo = new MetricRepository(db.db);
  const alertRepo = new AlertRepository(db.db);

  /** Clear existing data */
  db.db.exec("DELETE FROM metrics; DELETE FROM alerts; DELETE FROM alert_rules; DELETE FROM nodes;");

  /** Create demo nodes */
  const nodeIds: string[] = [];
  for (const n of DEMO_NODES) {
    const id = nodeRepo.create(n);
    nodeIds.push(id);
    console.log(`  Created node: ${n.name} (${id})`);
  }

  /** Generate 24h of metrics at 30-second intervals */
  const now = Date.now();
  const interval = 30_000;
  const points = (24 * 60 * 60 * 1000) / interval;

  console.log(`\n  Generating ${points} data points per metric per node...`);

  for (const nodeId of nodeIds) {
    const batch: Array<{
      nodeId: string;
      metricName: string;
      value: number;
      unit: string;
      timestamp: number;
    }> = [];

    let blockHeight = 50_000_000 + Math.floor(Math.random() * 1_000_000);

    for (let i = 0; i < points; i++) {
      const ts = now - (points - i) * interval;
      blockHeight += Math.floor(Math.random() * 3) + 1;

      batch.push(
        { nodeId, metricName: "block_height", value: blockHeight, unit: "blocks", timestamp: ts },
        { nodeId, metricName: "sync_lag", value: jitter(2, 5), unit: "blocks", timestamp: ts },
        { nodeId, metricName: "is_synced", value: 1, unit: "bool", timestamp: ts },
        { nodeId, metricName: "gas_price_gwei", value: jitter(20, 10), unit: "Gwei", timestamp: ts },
        { nodeId, metricName: "peer_count", value: Math.max(0, Math.round(jitter(25, 8))), unit: "peers", timestamp: ts },
        { nodeId, metricName: "pending_tx_count", value: Math.max(0, Math.round(jitter(100, 80))), unit: "txns", timestamp: ts },
        { nodeId, metricName: "rpc_latency", value: Math.max(1, jitter(150, 100)), unit: "ms", timestamp: ts },
        { nodeId, metricName: "cpu_usage", value: jitter(30, 20), unit: "%", timestamp: ts },
        { nodeId, metricName: "memory_usage", value: jitter(55, 15), unit: "%", timestamp: ts },
        { nodeId, metricName: "disk_usage", value: jitter(40, 5), unit: "%", timestamp: ts },
        { nodeId, metricName: "block_tx_count", value: Math.max(0, Math.round(jitter(5, 5))), unit: "txns", timestamp: ts },
        { nodeId, metricName: "gas_utilization", value: jitter(35, 25), unit: "%", timestamp: ts },
      );

      /** Insert in batches of 5000 to avoid memory issues */
      if (batch.length >= 5000) {
        metricRepo.insertBatch(batch);
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      metricRepo.insertBatch(batch);
    }
  }

  /** Create sample alert rules */
  const rules = [
    { name: "High Sync Lag", metric: "sync_lag", condition: "gt" as const, threshold: 500, severity: "critical" as const, cooldownMs: 300_000, channels: ["console" as const] },
    { name: "Low Peer Count", metric: "peer_count", condition: "lt" as const, threshold: 5, severity: "warning" as const, cooldownMs: 600_000, channels: ["console" as const] },
    { name: "High RPC Latency", metric: "rpc_latency", condition: "gt" as const, threshold: 3000, severity: "warning" as const, cooldownMs: 300_000, channels: ["console" as const] },
    { name: "High CPU Usage", metric: "cpu_usage", condition: "gt" as const, threshold: 90, severity: "warning" as const, cooldownMs: 600_000, channels: ["console" as const] },
  ];

  for (const r of rules) {
    alertRepo.createRule(r);
    console.log(`  Created alert rule: ${r.name}`);
  }

  /** Create a couple of sample triggered alerts */
  const sampleAlertNode = nodeIds[0]!;
  alertRepo.createAlert({
    ruleId: "sample",
    nodeId: sampleAlertNode,
    metric: "rpc_latency",
    value: 5200,
    threshold: 3000,
    severity: "warning",
    message: "High RPC Latency: rpc_latency = 5200 > 3000",
  });

  alertRepo.createAlert({
    ruleId: "sample",
    nodeId: sampleAlertNode,
    metric: "peer_count",
    value: 2,
    threshold: 5,
    severity: "warning",
    message: "Low Peer Count: peer_count = 2 < 5",
  });

  db.close();
  console.log("\nSeed complete!\n");
}

main().catch(console.error);

import { Database } from "./Database";
import { NodeRepository } from "./NodeRepository";
import { MetricRepository } from "./MetricRepository";
import { AlertRepository } from "./AlertRepository";
import path from "path";
import fs from "fs";
import os from "os";

describe("Database Repositories", () => {
  let dbPath: string;
  let database: Database;
  let nodeRepo: NodeRepository;
  let metricRepo: MetricRepository;
  let alertRepo: AlertRepository;

  beforeEach(() => {
    /** Use a temp file so better-sqlite3 works normally with WAL */
    dbPath = path.join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    database = new Database(dbPath);
    database.migrate();
    nodeRepo = new NodeRepository(database.db);
    metricRepo = new MetricRepository(database.db);
    alertRepo = new AlertRepository(database.db);
  });

  afterEach(() => {
    database.close();
    /** Clean up temp db files */
    for (const suffix of ["", "-wal", "-shm"]) {
      try { fs.unlinkSync(dbPath + suffix); } catch { /* ignore */ }
    }
  });

  /* ───────── NodeRepository ───────── */

  describe("NodeRepository", () => {
    it("creates and retrieves a node", () => {
      const id = nodeRepo.create({
        name: "Test Node",
        rpcUrl: "https://example.com",
        spaceType: "core",
      });

      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);

      const node = nodeRepo.findById(id);
      expect(node).toBeDefined();
      expect(node!.name).toBe("Test Node");
      expect(node!.rpc_url).toBe("https://example.com");
      expect(node!.space_type).toBe("core");
      expect(node!.enabled).toBe(1);
    });

    it("lists all nodes", () => {
      nodeRepo.create({ name: "Node A", rpcUrl: "https://a.com", spaceType: "core" });
      nodeRepo.create({ name: "Node B", rpcUrl: "https://b.com", spaceType: "espace" });

      const all = nodeRepo.findAll();
      expect(all).toHaveLength(2);
    });

    it("lists only enabled nodes", () => {
      nodeRepo.create({ name: "Enabled", rpcUrl: "https://a.com", spaceType: "core", enabled: true });
      nodeRepo.create({ name: "Disabled", rpcUrl: "https://b.com", spaceType: "core", enabled: false });

      const enabled = nodeRepo.findEnabled();
      expect(enabled).toHaveLength(1);
      expect(enabled[0]!.name).toBe("Enabled");
    });

    it("updates node fields", () => {
      const id = nodeRepo.create({ name: "Old", rpcUrl: "https://old.com", spaceType: "core" });
      const updated = nodeRepo.update(id, { name: "New", rpcUrl: "https://new.com" });

      expect(updated).toBe(true);

      const node = nodeRepo.findById(id);
      expect(node!.name).toBe("New");
      expect(node!.rpc_url).toBe("https://new.com");
    });

    it("returns false when updating non-existent node", () => {
      expect(nodeRepo.update("nonexistent", { name: "X" })).toBe(false);
    });

    it("returns false for empty update fields", () => {
      const id = nodeRepo.create({ name: "Test", rpcUrl: "https://x.com", spaceType: "core" });
      expect(nodeRepo.update(id, {})).toBe(false);
    });

    it("deletes a node", () => {
      const id = nodeRepo.create({ name: "Temp", rpcUrl: "https://temp.com", spaceType: "espace" });
      expect(nodeRepo.delete(id)).toBe(true);
      expect(nodeRepo.findById(id)).toBeUndefined();
    });

    it("returns false when deleting non-existent node", () => {
      expect(nodeRepo.delete("nonexistent")).toBe(false);
    });
  });

  /* ───────── MetricRepository ───────── */

  describe("MetricRepository", () => {
    let nodeId: string;

    beforeEach(() => {
      nodeId = nodeRepo.create({ name: "N1", rpcUrl: "https://n1.com", spaceType: "core" });
    });

    it("inserts and queries a single metric", () => {
      metricRepo.insert({
        nodeId,
        metricName: "rpc_latency",
        value: 150,
        unit: "ms",
        timestamp: 1000,
      });

      const rows = metricRepo.query({ nodeId, metricName: "rpc_latency" });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.value).toBe(150);
      expect(rows[0]!.unit).toBe("ms");
    });

    it("batch-inserts multiple metrics", () => {
      const points = Array.from({ length: 10 }, (_, i) => ({
        nodeId,
        metricName: "cpu_usage",
        value: 30 + i,
        unit: "%",
        timestamp: 1000 + i * 1000,
      }));

      metricRepo.insertBatch(points);

      const rows = metricRepo.query({ nodeId, metricName: "cpu_usage" });
      expect(rows).toHaveLength(10);
    });

    it("queries with time range filters", () => {
      for (let i = 0; i < 5; i++) {
        metricRepo.insert({
          nodeId,
          metricName: "block_height",
          value: 100 + i,
          unit: "blocks",
          timestamp: 1000 + i * 1000,
        });
      }

      const rows = metricRepo.query({
        nodeId,
        metricName: "block_height",
        from: 2000,
        to: 4000,
      });

      expect(rows).toHaveLength(3);
    });

    it("respects the limit parameter", () => {
      for (let i = 0; i < 20; i++) {
        metricRepo.insert({
          nodeId,
          metricName: "peer_count",
          value: i,
          unit: "peers",
          timestamp: 1000 + i * 1000,
        });
      }

      const rows = metricRepo.query({ nodeId, metricName: "peer_count", limit: 5 });
      expect(rows).toHaveLength(5);
    });

    it("returns latest value per metric name", () => {
      metricRepo.insert({ nodeId, metricName: "cpu_usage", value: 30, unit: "%", timestamp: 1000 });
      metricRepo.insert({ nodeId, metricName: "cpu_usage", value: 50, unit: "%", timestamp: 2000 });
      metricRepo.insert({ nodeId, metricName: "memory_usage", value: 60, unit: "%", timestamp: 1500 });

      const latest = metricRepo.getLatestByNode(nodeId);
      expect(latest).toHaveLength(2);

      const cpu = latest.find((m) => m.metric_name === "cpu_usage");
      expect(cpu!.value).toBe(50);
    });

    it("returns distinct metric names", () => {
      metricRepo.insert({ nodeId, metricName: "cpu_usage", value: 30, unit: "%", timestamp: 1000 });
      metricRepo.insert({ nodeId, metricName: "cpu_usage", value: 40, unit: "%", timestamp: 2000 });
      metricRepo.insert({ nodeId, metricName: "memory_usage", value: 60, unit: "%", timestamp: 1500 });

      const names = metricRepo.getMetricNames(nodeId);
      expect(names.sort()).toEqual(["cpu_usage", "memory_usage"]);
    });
  });

  /* ───────── AlertRepository ───────── */

  describe("AlertRepository", () => {
    let nodeId: string;

    beforeEach(() => {
      nodeId = nodeRepo.create({ name: "N1", rpcUrl: "https://n1.com", spaceType: "core" });
    });

    it("creates and retrieves alert rules", () => {
      const id = alertRepo.createRule({
        name: "High Latency",
        metric: "rpc_latency",
        condition: "gt",
        threshold: 3000,
        severity: "warning",
        cooldownMs: 300_000,
        channels: ["console"],
      });

      expect(typeof id).toBe("string");

      const rules = alertRepo.findAllRules();
      expect(rules).toHaveLength(1);
      expect(rules[0]!.name).toBe("High Latency");
      expect(rules[0]!.threshold).toBe(3000);
    });

    it("finds only enabled rules", () => {
      alertRepo.createRule({
        name: "Rule1",
        metric: "cpu_usage",
        condition: "gt",
        threshold: 90,
        severity: "critical",
        cooldownMs: 300_000,
        channels: ["console"],
      });

      /** All rules start enabled */
      const enabled = alertRepo.findEnabledRules();
      expect(enabled).toHaveLength(1);
    });

    it("deletes alert rules", () => {
      const id = alertRepo.createRule({
        name: "ToDelete",
        metric: "cpu_usage",
        condition: "gt",
        threshold: 90,
        severity: "warning",
        cooldownMs: 300_000,
        channels: ["console"],
      });

      expect(alertRepo.deleteRule(id)).toBe(true);
      expect(alertRepo.findAllRules()).toHaveLength(0);
    });

    it("creates and queries triggered alerts", () => {
      const alertId = alertRepo.createAlert({
        ruleId: "rule-1",
        nodeId,
        metric: "rpc_latency",
        value: 5000,
        threshold: 3000,
        severity: "warning",
        message: "High latency",
      });

      expect(typeof alertId).toBe("string");

      const alerts = alertRepo.findAlerts({ nodeId });
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.value).toBe(5000);
      expect(alerts[0]!.acknowledged).toBe(0);
      expect(alerts[0]!.resolved_at).toBeNull();
    });

    it("acknowledges an alert", () => {
      const alertId = alertRepo.createAlert({
        ruleId: "rule-1",
        nodeId,
        metric: "rpc_latency",
        value: 5000,
        threshold: 3000,
        severity: "warning",
        message: "test",
      });

      expect(alertRepo.acknowledge(alertId)).toBe(true);

      const alerts = alertRepo.findAlerts({ nodeId });
      expect(alerts[0]!.acknowledged).toBe(1);
    });

    it("resolves an alert", () => {
      const alertId = alertRepo.createAlert({
        ruleId: "rule-1",
        nodeId,
        metric: "rpc_latency",
        value: 5000,
        threshold: 3000,
        severity: "warning",
        message: "test",
      });

      expect(alertRepo.resolve(alertId)).toBe(true);

      const alerts = alertRepo.findAlerts({ nodeId });
      expect(alerts[0]!.resolved_at).not.toBeNull();
    });

    it("filters unresolved-only alerts", () => {
      const a1 = alertRepo.createAlert({
        ruleId: "r1", nodeId, metric: "m1", value: 1, threshold: 0, severity: "warning", message: "a",
      });
      alertRepo.createAlert({
        ruleId: "r1", nodeId, metric: "m2", value: 2, threshold: 0, severity: "warning", message: "b",
      });

      alertRepo.resolve(a1);

      const unresolved = alertRepo.findAlerts({ nodeId, unresolvedOnly: true });
      expect(unresolved).toHaveLength(1);
      expect(unresolved[0]!.metric).toBe("m2");
    });

    it("counts unresolved alerts per node", () => {
      alertRepo.createAlert({
        ruleId: "r1", nodeId, metric: "m1", value: 1, threshold: 0, severity: "warning", message: "a",
      });
      alertRepo.createAlert({
        ruleId: "r1", nodeId, metric: "m2", value: 2, threshold: 0, severity: "warning", message: "b",
      });

      const counts = alertRepo.getUnresolvedCounts();
      expect(counts).toHaveLength(1);
      expect(counts[0]!.node_id).toBe(nodeId);
      expect(counts[0]!.count).toBe(2);
    });
  });

  /* ───────── Database.pruneMetrics ───────── */

  describe("Database.pruneMetrics", () => {
    it("removes metrics older than the retention period", () => {
      const nodeId = nodeRepo.create({ name: "N", rpcUrl: "https://n.com", spaceType: "core" });

      const oldTs = Date.now() - 35 * 24 * 60 * 60 * 1000;
      const recentTs = Date.now();

      metricRepo.insert({ nodeId, metricName: "cpu", value: 1, unit: "%", timestamp: oldTs });
      metricRepo.insert({ nodeId, metricName: "cpu", value: 2, unit: "%", timestamp: recentTs });

      const pruned = database.pruneMetrics(30);
      expect(pruned).toBe(1);

      const remaining = metricRepo.query({ nodeId });
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.value).toBe(2);
    });
  });
});

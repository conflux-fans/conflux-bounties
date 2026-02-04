import { AlertEngine } from "./AlertEngine";
import type { AlertRepository, AlertRuleRow, AlertRow } from "../database/AlertRepository";
import type { NodeRow } from "../database/NodeRepository";
import type { IAlertChannel, AlertPayload } from "./channels/IAlertChannel";
import type { ProbeResult } from "../collector/IProbe";

/** Minimal mock AlertRepository */
function mockAlertRepo(rules: AlertRuleRow[] = []): AlertRepository {
  const alerts: AlertRow[] = [];
  let counter = 0;

  return {
    findEnabledRules: jest.fn(() => rules),
    createAlert: jest.fn((alert) => {
      const id = `alert-${++counter}`;
      alerts.push({
        id,
        rule_id: alert.ruleId,
        node_id: alert.nodeId,
        metric: alert.metric,
        value: alert.value,
        threshold: alert.threshold,
        severity: alert.severity,
        message: alert.message,
        acknowledged: 0,
        resolved_at: null,
        created_at: new Date().toISOString(),
      });
      return id;
    }),
    findAlerts: jest.fn(() => alerts),
  } as unknown as AlertRepository;
}

/** Mock alert channel */
function mockChannel(name: string): IAlertChannel & { payloads: AlertPayload[] } {
  const payloads: AlertPayload[] = [];
  return {
    name,
    send: jest.fn(async (payload: AlertPayload) => {
      payloads.push(payload);
    }),
    payloads,
  };
}

function makeRule(overrides: Partial<AlertRuleRow> = {}): AlertRuleRow {
  return {
    id: "rule-1",
    name: "High Latency",
    metric: "rpc_latency",
    condition: "gt",
    threshold: 3000,
    severity: "warning",
    cooldown_ms: 300_000,
    channels: '["console"]',
    enabled: 1,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeProbeResult(overrides: Partial<ProbeResult> = {}): ProbeResult {
  return {
    nodeId: "node-1",
    metricName: "rpc_latency",
    value: 5000,
    unit: "ms",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("AlertEngine", () => {
  let nodeMap: Map<string, NodeRow>;

  beforeEach(() => {
    nodeMap = new Map([
      [
        "node-1",
        {
          id: "node-1",
          name: "Test Node",
          rpc_url: "https://test.com",
          space_type: "core" as const,
          enabled: 1,
          created_at: new Date().toISOString(),
        },
      ],
    ]);
  });

  it("fires an alert when a rule condition is triggered", async () => {
    const rule = makeRule();
    const repo = mockAlertRepo([rule]);
    const engine = new AlertEngine(repo, nodeMap);

    const channel = mockChannel("console");
    engine.registerChannel(channel);

    await engine.processMetrics([makeProbeResult({ value: 5000 })]);

    expect(repo.createAlert).toHaveBeenCalledTimes(1);
    expect(channel.payloads).toHaveLength(1);
    expect(channel.payloads[0]!.value).toBe(5000);
  });

  it("does not fire when condition is not met", async () => {
    const rule = makeRule();
    const repo = mockAlertRepo([rule]);
    const engine = new AlertEngine(repo, nodeMap);

    const channel = mockChannel("console");
    engine.registerChannel(channel);

    await engine.processMetrics([makeProbeResult({ value: 100 })]);

    expect(repo.createAlert).not.toHaveBeenCalled();
    expect(channel.payloads).toHaveLength(0);
  });

  it("respects cooldown — does not fire again within cooldown period", async () => {
    const rule = makeRule({ cooldown_ms: 60_000 });
    const repo = mockAlertRepo([rule]);
    const engine = new AlertEngine(repo, nodeMap);

    const channel = mockChannel("console");
    engine.registerChannel(channel);

    await engine.processMetrics([makeProbeResult({ value: 5000 })]);
    await engine.processMetrics([makeProbeResult({ value: 6000 })]);

    /** Only one alert should have been created despite two high values */
    expect(repo.createAlert).toHaveBeenCalledTimes(1);
  });

  it("suppresses alerts in maintenance mode", async () => {
    const rule = makeRule();
    const repo = mockAlertRepo([rule]);
    const engine = new AlertEngine(repo, nodeMap);
    engine.maintenanceMode = true;

    await engine.processMetrics([makeProbeResult({ value: 5000 })]);

    expect(repo.createAlert).not.toHaveBeenCalled();
  });

  it("calls onAlert callback when alert triggers", async () => {
    const rule = makeRule();
    const repo = mockAlertRepo([rule]);
    const engine = new AlertEngine(repo, nodeMap);

    const channel = mockChannel("console");
    engine.registerChannel(channel);

    const onAlert = jest.fn();
    engine.onAlert = onAlert;

    await engine.processMetrics([makeProbeResult({ value: 5000 })]);

    expect(onAlert).toHaveBeenCalledWith("triggered", expect.objectContaining({
      nodeName: "Test Node",
      value: 5000,
    }));
  });

  it("resolves alert when condition is no longer met", async () => {
    const rule = makeRule();
    const repo = mockAlertRepo([rule]);
    const engine = new AlertEngine(repo, nodeMap);

    const channel = mockChannel("console");
    engine.registerChannel(channel);

    const onAlert = jest.fn();
    engine.onAlert = onAlert;

    /** Trigger first */
    await engine.processMetrics([makeProbeResult({ value: 5000 })]);
    /** Then resolve */
    await engine.processMetrics([makeProbeResult({ value: 100 })]);

    expect(onAlert).toHaveBeenCalledWith("resolved", expect.objectContaining({
      value: 100,
    }));
  });

  it("matches consecutive_failures rules only against _error metrics", async () => {
    const rule = makeRule({
      id: "cf-rule",
      condition: "consecutive_failures",
      metric: "rpc_latency",
      threshold: 3,
    });
    const repo = mockAlertRepo([rule]);
    const engine = new AlertEngine(repo, nodeMap);

    const channel = mockChannel("console");
    engine.registerChannel(channel);

    /** Normal rpc_latency metric should NOT match a consecutive_failures rule */
    await engine.processMetrics([
      makeProbeResult({ metricName: "rpc_latency", value: 5000 }),
    ]);
    expect(repo.createAlert).not.toHaveBeenCalled();

    /** The _error metric SHOULD match */
    await engine.processMetrics([
      makeProbeResult({ metricName: "rpc_latency_error", value: 5 }),
    ]);
    expect(repo.createAlert).toHaveBeenCalledTimes(1);
  });

  it("skips processing when no rules exist", async () => {
    const repo = mockAlertRepo([]);
    const engine = new AlertEngine(repo, nodeMap);

    /** Should not throw */
    await engine.processMetrics([makeProbeResult()]);
    expect(repo.createAlert).not.toHaveBeenCalled();
  });

  it("handles unknown channel names gracefully", async () => {
    const rule = makeRule({ channels: '["nonexistent"]' });
    const repo = mockAlertRepo([rule]);
    const engine = new AlertEngine(repo, nodeMap);

    /** Should not throw — just logs a warning */
    await engine.processMetrics([makeProbeResult({ value: 5000 })]);
    expect(repo.createAlert).toHaveBeenCalledTimes(1);
  });
});

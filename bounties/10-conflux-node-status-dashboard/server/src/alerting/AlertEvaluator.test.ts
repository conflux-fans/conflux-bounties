import { AlertEvaluator } from "./AlertEvaluator";
import type { AlertRuleRow } from "../database/AlertRepository";

/** Helper to create a minimal rule row */
function makeRule(overrides: Partial<AlertRuleRow> = {}): AlertRuleRow {
  return {
    id: "rule-1",
    name: "Test Rule",
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

describe("AlertEvaluator", () => {
  const evaluator = new AlertEvaluator();

  describe("gt (greater than)", () => {
    const rule = makeRule({ condition: "gt", threshold: 3000 });

    it("triggers when value > threshold", () => {
      const result = evaluator.evaluate(rule, 5000);
      expect(result.triggered).toBe(true);
      expect(result.message).toContain("5000");
      expect(result.message).toContain("3000");
    });

    it("does not trigger when value <= threshold", () => {
      expect(evaluator.evaluate(rule, 3000).triggered).toBe(false);
      expect(evaluator.evaluate(rule, 2000).triggered).toBe(false);
    });
  });

  describe("lt (less than)", () => {
    const rule = makeRule({ condition: "lt", metric: "peer_count", threshold: 5 });

    it("triggers when value < threshold", () => {
      const result = evaluator.evaluate(rule, 2);
      expect(result.triggered).toBe(true);
    });

    it("does not trigger when value >= threshold", () => {
      expect(evaluator.evaluate(rule, 5).triggered).toBe(false);
      expect(evaluator.evaluate(rule, 10).triggered).toBe(false);
    });
  });

  describe("lag", () => {
    const rule = makeRule({ condition: "lag", metric: "sync_lag", threshold: 100 });

    it("triggers when lag > threshold", () => {
      const result = evaluator.evaluate(rule, 150);
      expect(result.triggered).toBe(true);
      expect(result.message).toContain("sync lag");
    });

    it("does not trigger when lag <= threshold", () => {
      expect(evaluator.evaluate(rule, 100).triggered).toBe(false);
      expect(evaluator.evaluate(rule, 50).triggered).toBe(false);
    });
  });

  describe("consecutive_failures", () => {
    const rule = makeRule({
      condition: "consecutive_failures",
      metric: "rpc_latency",
      threshold: 3,
    });

    it("triggers when failure count >= threshold", () => {
      expect(evaluator.evaluate(rule, 3).triggered).toBe(true);
      expect(evaluator.evaluate(rule, 5).triggered).toBe(true);
    });

    it("does not trigger when failure count < threshold", () => {
      expect(evaluator.evaluate(rule, 2).triggered).toBe(false);
      expect(evaluator.evaluate(rule, 0).triggered).toBe(false);
    });
  });

  describe("unknown condition", () => {
    it("returns triggered: false for unknown conditions", () => {
      const rule = makeRule({ condition: "unknown_op" as never });
      const result = evaluator.evaluate(rule, 100);
      expect(result.triggered).toBe(false);
      expect(result.message).toContain("Unknown condition");
    });
  });
});

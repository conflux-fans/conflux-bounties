import type { AlertRuleRow } from "../database/AlertRepository";
import type { Condition } from "../config/schemas";

/**
 * Result of evaluating an alert rule against a metric value.
 */
export interface EvaluationResult {
  triggered: boolean;
  message: string;
}

/**
 * Evaluates alert conditions against metric values.
 * Supports: gt, lt, lag, consecutive_failures.
 */
export class AlertEvaluator {
  /**
   * Evaluate whether a rule's condition is met for a given metric value.
   * For 'consecutive_failures', the value should be the failure count.
   */
  evaluate(rule: AlertRuleRow, value: number): EvaluationResult {
    const condition = rule.condition as Condition;

    switch (condition) {
      case "gt":
        return {
          triggered: value > rule.threshold,
          message: `${rule.name}: ${rule.metric} = ${value} > ${rule.threshold}`,
        };

      case "lt":
        return {
          triggered: value < rule.threshold,
          message: `${rule.name}: ${rule.metric} = ${value} < ${rule.threshold}`,
        };

      case "lag":
        return {
          triggered: value > rule.threshold,
          message: `${rule.name}: sync lag = ${value} blocks (threshold: ${rule.threshold})`,
        };

      case "consecutive_failures":
        return {
          triggered: value >= rule.threshold,
          message: `${rule.name}: ${value} consecutive failures (threshold: ${rule.threshold})`,
        };

      default:
        return { triggered: false, message: `Unknown condition: ${condition}` };
    }
  }
}

import type { AlertRuleRow } from "../database/AlertRepository";
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
export declare class AlertEvaluator {
    /**
     * Evaluate whether a rule's condition is met for a given metric value.
     * For 'consecutive_failures', the value should be the failure count.
     */
    evaluate(rule: AlertRuleRow, value: number): EvaluationResult;
}
//# sourceMappingURL=AlertEvaluator.d.ts.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertEvaluator = void 0;
/**
 * Evaluates alert conditions against metric values.
 * Supports: gt, lt, lag, consecutive_failures.
 */
class AlertEvaluator {
    /**
     * Evaluate whether a rule's condition is met for a given metric value.
     * For 'consecutive_failures', the value should be the failure count.
     */
    evaluate(rule, value) {
        const condition = rule.condition;
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
exports.AlertEvaluator = AlertEvaluator;
//# sourceMappingURL=AlertEvaluator.js.map
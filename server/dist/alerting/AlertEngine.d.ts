import type { AlertRepository } from "../database/AlertRepository";
import type { NodeRow } from "../database/NodeRepository";
import type { IAlertChannel, AlertPayload } from "./channels/IAlertChannel";
import type { ProbeResult } from "../collector/IProbe";
/**
 * Callback invoked when an alert is triggered or resolved.
 * Used to broadcast alert events via WebSocket.
 */
export type OnAlertCallback = (type: "triggered" | "resolved", payload: AlertPayload) => void;
/**
 * Core alerting engine.
 * Evaluates metric results against alert rules, tracks active alerts,
 * enforces cooldowns, respects maintenance mode, and dispatches notifications.
 */
export declare class AlertEngine {
    private readonly alertRepo;
    private readonly nodeMap;
    private readonly logger;
    private readonly evaluator;
    private readonly channels;
    /**
     * Tracks active (unresolved) alerts by a composite key of ruleId:nodeId.
     * Stores the timestamp when the alert was last fired (for cooldown).
     */
    private readonly activeAlerts;
    /** Whether maintenance mode is active (suppresses all alerts) */
    maintenanceMode: boolean;
    /** Optional callback for real-time alert events */
    onAlert?: OnAlertCallback;
    constructor(alertRepo: AlertRepository, nodeMap: Map<string, NodeRow>);
    /** Register a notification channel */
    registerChannel(channel: IAlertChannel): void;
    /**
     * Process a batch of metric results from the collector.
     * Evaluates each metric against all matching alert rules.
     */
    processMetrics(results: ProbeResult[]): Promise<void>;
    /** Evaluate a single rule against a metric result */
    private evaluateRule;
    /** Send alert payload to the specified channels */
    private dispatchToChannels;
}
//# sourceMappingURL=AlertEngine.d.ts.map
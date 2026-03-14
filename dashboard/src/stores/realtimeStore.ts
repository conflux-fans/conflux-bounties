import { create } from "zustand";
import type { MetricsUpdate, AlertEvent } from "../api/types";

/**
 * Store for real-time data pushed via WebSocket.
 * Holds the latest metric snapshot per node and recent alert events.
 */
interface RealtimeState {
  /** Latest metric values keyed by `nodeId:metricName` */
  latestMetrics: Map<string, { value: number; unit: string; timestamp: number }>;

  /** Most recent alert events (kept in memory, max 50) */
  recentAlertEvents: AlertEvent[];

  /** Whether the WebSocket is connected */
  connected: boolean;

  /** Push a batch of metric updates from WebSocket */
  pushMetrics: (update: MetricsUpdate) => void;

  /** Push an alert event */
  pushAlertEvent: (event: AlertEvent) => void;

  /** Set connection status */
  setConnected: (v: boolean) => void;

  /** Get a specific metric value for a node */
  getMetric: (
    nodeId: string,
    metricName: string
  ) => { value: number; unit: string; timestamp: number } | undefined;
}

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  latestMetrics: new Map(),
  recentAlertEvents: [],
  connected: false,

  pushMetrics: (update) =>
    set((state) => {
      const next = new Map(state.latestMetrics);
      for (const m of update.metrics) {
        next.set(`${update.nodeId}:${m.metricName}`, {
          value: m.value,
          unit: m.unit,
          timestamp: m.timestamp,
        });
      }
      return { latestMetrics: next };
    }),

  pushAlertEvent: (event) =>
    set((state) => ({
      recentAlertEvents: [event, ...state.recentAlertEvents].slice(0, 50),
    })),

  setConnected: (connected) => set({ connected }),

  getMetric: (nodeId, metricName) =>
    get().latestMetrics.get(`${nodeId}:${metricName}`),
}));

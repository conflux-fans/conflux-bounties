import type {
  Node,
  MetricRow,
  Alert,
  AlertRule,
  Health,
  CreateNodeBody,
} from "./types";

const BASE = "/api/v1";

/** Generic fetch wrapper with error handling */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as Record<string, string>).error ?? `HTTP ${res.status}`
    );
  }

  /** Handle 204 No Content */
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/* ───────── Nodes ───────── */

export function fetchNodes(): Promise<Node[]> {
  return request<Node[]>(`${BASE}/nodes`);
}

export function fetchNode(id: string): Promise<Node> {
  return request<Node>(`${BASE}/nodes/${id}`);
}

export function createNode(body: CreateNodeBody): Promise<Node> {
  return request<Node>(`${BASE}/nodes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateNode(
  id: string,
  body: Partial<CreateNodeBody>
): Promise<Node> {
  return request<Node>(`${BASE}/nodes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteNode(id: string): Promise<void> {
  return request<void>(`${BASE}/nodes/${id}`, { method: "DELETE" });
}

/* ───────── Metrics ───────── */

export function fetchMetrics(params: {
  nodeId: string;
  metricName?: string;
  from?: number;
  to?: number;
  limit?: number;
}): Promise<MetricRow[]> {
  const qs = new URLSearchParams();
  qs.set("nodeId", params.nodeId);
  if (params.metricName) qs.set("metricName", params.metricName);
  if (params.from) qs.set("from", String(params.from));
  if (params.to) qs.set("to", String(params.to));
  if (params.limit) qs.set("limit", String(params.limit));
  return request<MetricRow[]>(`${BASE}/metrics?${qs}`);
}

export function fetchLatestMetrics(nodeId: string): Promise<MetricRow[]> {
  return request<MetricRow[]>(`${BASE}/metrics/latest/${nodeId}`);
}

export function fetchMetricNames(nodeId: string): Promise<string[]> {
  return request<string[]>(`${BASE}/metrics/names/${nodeId}`);
}

/** Build CSV export URL (opened in a new tab / download) */
export function buildCsvExportUrl(params: {
  nodeId: string;
  metricName?: string;
  from?: number;
  to?: number;
}): string {
  const qs = new URLSearchParams();
  qs.set("nodeId", params.nodeId);
  if (params.metricName) qs.set("metricName", params.metricName);
  if (params.from) qs.set("from", String(params.from));
  if (params.to) qs.set("to", String(params.to));
  return `${BASE}/metrics/export?${qs}`;
}

/* ───────── Alerts ───────── */

export function fetchAlerts(params?: {
  nodeId?: string;
  unresolved?: boolean;
  limit?: number;
}): Promise<Alert[]> {
  const qs = new URLSearchParams();
  if (params?.nodeId) qs.set("nodeId", params.nodeId);
  if (params?.unresolved) qs.set("unresolved", "true");
  if (params?.limit) qs.set("limit", String(params.limit));
  return request<Alert[]>(`${BASE}/alerts?${qs}`);
}

export function acknowledgeAlert(id: string): Promise<void> {
  return request<void>(`${BASE}/alerts/${id}/acknowledge`, {
    method: "POST",
  });
}

export function resolveAlert(id: string): Promise<void> {
  return request<void>(`${BASE}/alerts/${id}/resolve`, { method: "POST" });
}

export function fetchAlertRules(): Promise<AlertRule[]> {
  return request<AlertRule[]>(`${BASE}/alerts/rules`);
}

/* ───────── Health ───────── */

export function fetchHealth(): Promise<Health> {
  return request<Health>("/health");
}

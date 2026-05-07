/**
 * Lightweight Prometheus-compatible metrics collector.
 * No external dependencies — outputs text/plain in Prometheus exposition format.
 *
 * Tracks:
 * - x402_http_requests_total{method, path, status} — counter
 * - x402_http_request_duration_ms{method, path} — histogram (buckets: 10, 50, 100, 250, 500, 1000, 5000)
 * - x402_payments_total{endpoint, status} — counter (settled, failed, expired, refunded)
 * - x402_payment_amount_total{endpoint} — counter (sum of settled amounts in token units)
 * - x402_invoices_created_total — counter
 * - x402_facilitator_gas_saved — counter (pre-validation rejections that avoided gas spend)
 */

interface CounterEntry {
  labels: Record<string, string>;
  value: number;
}

class Counter {
  private name: string;
  private help: string;
  private entries: CounterEntry[] = [];

  constructor(name: string, help: string) {
    this.name = name;
    this.help = help;
  }

  inc(labels: Record<string, string>, amount = 1) {
    const existing = this.entries.find(
      (e) => Object.keys(labels).every((k) => e.labels[k] === labels[k]) &&
             Object.keys(e.labels).length === Object.keys(labels).length
    );
    if (existing) {
      existing.value += amount;
    } else {
      this.entries.push({ labels, value: amount });
    }
  }

  serialize(): string {
    if (this.entries.length === 0) return "";
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const entry of this.entries) {
      const labelStr = Object.entries(entry.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      lines.push(`${this.name}{${labelStr}} ${entry.value}`);
    }
    return lines.join("\n");
  }
}

class Histogram {
  private name: string;
  private help: string;
  private buckets: number[];
  private entries = new Map<string, { counts: number[]; sum: number; count: number }>();

  constructor(name: string, help: string, buckets: number[]) {
    this.name = name;
    this.help = help;
    this.buckets = buckets.sort((a, b) => a - b);
  }

  observe(labels: Record<string, string>, value: number) {
    const key = JSON.stringify(labels);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { counts: new Array(this.buckets.length).fill(0), sum: 0, count: 0 };
      this.entries.set(key, entry);
    }
    entry.sum += value;
    entry.count++;
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) entry.counts[i]++;
    }
  }

  serialize(): string {
    if (this.entries.size === 0) return "";
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const [key, entry] of this.entries) {
      const labels = JSON.parse(key) as Record<string, string>;
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      const prefix = labelStr ? `${labelStr},` : "";
      for (let i = 0; i < this.buckets.length; i++) {
        lines.push(`${this.name}_bucket{${prefix}le="${this.buckets[i]}"} ${entry.counts[i]}`);
      }
      lines.push(`${this.name}_bucket{${prefix}le="+Inf"} ${entry.count}`);
      lines.push(`${this.name}_sum{${labelStr}} ${entry.sum}`);
      lines.push(`${this.name}_count{${labelStr}} ${entry.count}`);
    }
    return lines.join("\n");
  }
}

// Global metrics instances
export const httpRequestsTotal = new Counter(
  "x402_http_requests_total",
  "Total HTTP requests by method, path, and status code"
);

export const httpRequestDuration = new Histogram(
  "x402_http_request_duration_ms",
  "HTTP request duration in milliseconds",
  [10, 50, 100, 250, 500, 1000, 5000]
);

export const paymentsTotal = new Counter(
  "x402_payments_total",
  "Total payment operations by endpoint and status"
);

export const paymentAmountTotal = new Counter(
  "x402_payment_amount_total",
  "Total settled payment amount in token smallest units"
);

export const invoicesCreatedTotal = new Counter(
  "x402_invoices_created_total",
  "Total invoices created"
);

export const facilitatorGasSaved = new Counter(
  "x402_facilitator_gas_saved_total",
  "Requests rejected by off-chain pre-validation (gas saved)"
);

/** Serialize all metrics in Prometheus exposition format. */
export function serializeMetrics(): string {
  return [
    httpRequestsTotal.serialize(),
    httpRequestDuration.serialize(),
    paymentsTotal.serialize(),
    paymentAmountTotal.serialize(),
    invoicesCreatedTotal.serialize(),
    facilitatorGasSaved.serialize(),
  ]
    .filter(Boolean)
    .join("\n\n") + "\n";
}

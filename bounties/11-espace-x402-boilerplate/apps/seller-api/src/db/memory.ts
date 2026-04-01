/**
 * In-memory storage fallback for local dev without Postgres.
 * Mimics the SQL tagged template interface used by the `postgres` package.
 */

interface Row {
  [key: string]: unknown;
}

const store = {
  invoices: new Map<string, Row>(),
  endpoint_pricing: new Map<string, Row>(),
  usage_logs: [] as Row[],
  api_keys: new Map<string, Row>(),
  disputes: new Map<string, Row>(),
};

// Seed default pricing
store.endpoint_pricing.set("/data/premium", {
  endpoint: "/data/premium",
  price: "100000000000000000",
  token: "0x0000000000000000000000000000000000000000",
  description: "Premium data feed",
  tier: "premium",
});
store.endpoint_pricing.set("/compute/simulate", {
  endpoint: "/compute/simulate",
  price: "500000000000000000",
  token: "0x0000000000000000000000000000000000000000",
  description: "Compute simulation",
  tier: "premium",
});

export function getStore() {
  return store;
}

export function findPricing(endpoint: string): Row | undefined {
  return store.endpoint_pricing.get(endpoint);
}

export function upsertPricing(endpoint: string, data: Row) {
  store.endpoint_pricing.set(endpoint, { endpoint, ...data });
}

export function createInvoice(invoice: Row) {
  store.invoices.set(invoice.id as string, {
    ...invoice,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export function getInvoice(id: string): Row | undefined {
  return store.invoices.get(id);
}

export function updateInvoice(id: string, updates: Partial<Row>) {
  const existing = store.invoices.get(id);
  if (existing) {
    store.invoices.set(id, { ...existing, ...updates, updated_at: new Date().toISOString() });
  }
}

export function listInvoices(opts?: { status?: string; limit?: number }): Row[] {
  let results = Array.from(store.invoices.values());
  if (opts?.status) results = results.filter((r) => r.status === opts.status);
  results.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return results.slice(0, opts?.limit ?? 50);
}

export function getAllPricing(): Row[] {
  return Array.from(store.endpoint_pricing.values());
}

export function createDispute(dispute: Row) {
  store.disputes.set(dispute.id as string, {
    ...dispute,
    created_at: new Date().toISOString(),
  });
}

export function getDispute(id: string): Row | undefined {
  return store.disputes.get(id);
}

export function updateDispute(id: string, updates: Partial<Row>) {
  const existing = store.disputes.get(id);
  if (existing) {
    store.disputes.set(id, { ...existing, ...updates });
  }
}

export function listDisputes(opts?: { status?: string }): Row[] {
  let results = Array.from(store.disputes.values());
  if (opts?.status) results = results.filter((r) => r.status === opts.status);
  results.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return results;
}

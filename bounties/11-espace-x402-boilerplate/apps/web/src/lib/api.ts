const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || "";

export function adminHeaders(): Record<string, string> {
  return ADMIN_KEY ? { "x-admin-key": ADMIN_KEY } : {};
}

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit & { invoiceId?: string; payer?: string }
): Promise<{ data?: T; paymentRequired?: PaymentChallenge; error?: string; status: number }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(path.startsWith("/admin") ? adminHeaders() : {}),
    ...(options?.headers as Record<string, string>),
  };

  if (options?.invoiceId) {
    headers["x-payment-invoice-id"] = options.invoiceId;
  }
  if (options?.payer) {
    headers["x-payment-payer"] = options.payer;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 402) {
    const body = await res.json();
    return {
      status: 402,
      paymentRequired: {
        amount: res.headers.get("x-payment-amount") || body["x-payment-amount"],
        token: res.headers.get("x-payment-token") || body["x-payment-token"],
        nonce: res.headers.get("x-payment-nonce") || body["x-payment-nonce"],
        expiry: Number(res.headers.get("x-payment-expiry") || body["x-payment-expiry"]),
        endpoint: res.headers.get("x-payment-endpoint") || body["x-payment-endpoint"],
        invoiceId: res.headers.get("x-payment-invoice-id") || body["x-payment-invoice-id"],
        description: res.headers.get("x-payment-description") || body["x-payment-description"],
        recipient: res.headers.get("x-payment-recipient") || body["x-payment-recipient"],
        verifierAddress: res.headers.get("x-payment-verifier") || body["x-payment-verifier"],
      },
    };
  }

  const data = await res.json();
  if (!res.ok) return { error: data.error || "Request failed", status: res.status };
  return { data: data.data ?? data, status: res.status };
}

export interface PaymentChallenge {
  amount: string;
  token: string;
  nonce: string;
  expiry: number;
  endpoint: string;
  invoiceId: string;
  description?: string;
  recipient?: string;
  verifierAddress?: string;
}

export async function submitDispute(invoiceId: string, requester: string, reason: string) {
  const res = await fetch(`${API_BASE}/disputes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceId, requester, reason }),
  });
  return res.json();
}

export async function fetchDisputes(status?: string) {
  const qs = status ? `?status=${status}` : "";
  const res = await fetch(`${API_BASE}/disputes${qs}`, {
    headers: adminHeaders(),
  });
  return res.json();
}

export async function resolveDispute(id: string, resolution: "approved" | "rejected", adminNote?: string) {
  const res = await fetch(`${API_BASE}/disputes/${id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify({ resolution, adminNote }),
  });
  return res.json();
}

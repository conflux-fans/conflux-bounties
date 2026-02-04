const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

/**
 * Typed fetch wrapper for the analytics API.
 * Appends query params, handles errors, and returns parsed JSON.
 */
export async function apiFetch<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url.toString());

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `API error: ${res.status}`);
  }

  return res.json();
}

/**
 * POST wrapper for create operations (shares, webhooks).
 */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `API error: ${res.status}`);
  }

  return res.json();
}

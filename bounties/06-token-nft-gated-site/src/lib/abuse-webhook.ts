export function notifyAbuseWebhook(payload: Record<string, unknown>): void {
  const url = process.env.ABUSE_WEBHOOK_URL?.trim();
  if (!url) return;
  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "06-token-nft-gated-site",
        at: new Date().toISOString(),
        ...payload,
      }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

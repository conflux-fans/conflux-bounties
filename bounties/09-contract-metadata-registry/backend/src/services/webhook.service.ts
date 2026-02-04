import { env } from "../config/env";

export class WebhookService {
  /**
   * Send a POST notification to the configured webhook URL when metadata is approved.
   */
  async notifyApproval(contractAddress: string, cid: string): Promise<void> {
    if (!env.WEBHOOK_URL) return;

    try {
      const res = await fetch(env.WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "metadata.approved",
          contractAddress,
          cid,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        console.error(`Webhook notification failed (${res.status})`);
      }
    } catch (err) {
      console.error("Webhook notification error:", err);
    }
  }
}

export const webhookService = new WebhookService();

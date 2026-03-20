import { notifyAbuseWebhook } from "@/lib/abuse-webhook";

describe("abuse-webhook", () => {
  const prev = process.env.ABUSE_WEBHOOK_URL;
  afterEach(() => {
    process.env.ABUSE_WEBHOOK_URL = prev;
  });

  it("no-ops when URL unset", () => {
    delete process.env.ABUSE_WEBHOOK_URL;
    expect(() => notifyAbuseWebhook({ test: 1 })).not.toThrow();
  });
});

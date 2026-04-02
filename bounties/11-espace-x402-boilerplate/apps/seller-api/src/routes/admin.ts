import { Hono } from "hono";
import { sql } from "../db/index.js";
import { config } from "../lib/config.js";

export const adminRoutes = new Hono();

/** Log an admin action to the audit_logs table (fire-and-forget). */
function audit(action: string, entity: string, entityId: string | null, details: unknown) {
  sql`INSERT INTO audit_logs (action, entity, entity_id, details) VALUES (${action}, ${entity}, ${entityId}, ${JSON.stringify(details)})`.catch(() => {});
}

// Get all endpoint pricing
adminRoutes.get("/pricing", async (c) => {
  const pricing = await sql`SELECT * FROM endpoint_pricing ORDER BY endpoint`;
  return c.json({ pricing });
});

// Update endpoint pricing
adminRoutes.put("/pricing/:endpoint{.+}", async (c) => {
  const endpoint = "/" + c.req.param("endpoint");
  const body = await c.req.json();

  // Validate price is a positive integer string (smallest token units)
  if (!body.price || !/^\d+$/.test(String(body.price)) || BigInt(body.price) <= 0n) {
    return c.json({ error: "Invalid price: must be a positive integer string (token smallest units)" }, 400);
  }

  // Validate escrow_duration if provided (0 = instant release, max 30 days = 2592000s)
  const escrowDuration = body.escrow_duration != null ? Number(body.escrow_duration) : null;
  if (escrowDuration != null && (isNaN(escrowDuration) || escrowDuration < 0 || escrowDuration > 2592000)) {
    return c.json({ error: "Invalid escrow_duration: must be 0-2592000 seconds (0 = instant, max 30 days)" }, 400);
  }

  await sql`
    INSERT INTO endpoint_pricing (endpoint, price, token, description, tier, escrow_duration)
    VALUES (${endpoint}, ${body.price}, ${body.token || config.tokenAddress}, ${body.description || ''}, ${body.tier || 'premium'}, ${escrowDuration})
    ON CONFLICT (endpoint) DO UPDATE SET
      price = ${body.price},
      description = COALESCE(${body.description}, endpoint_pricing.description),
      tier = COALESCE(${body.tier}, endpoint_pricing.tier),
      token = COALESCE(${body.token}, endpoint_pricing.token),
      escrow_duration = COALESCE(${escrowDuration}, endpoint_pricing.escrow_duration)
  `;

  audit("update_pricing", "endpoint_pricing", endpoint, { price: body.price, token: body.token, tier: body.tier, escrow_duration: escrowDuration });
  return c.json({ success: true, endpoint, price: body.price, escrow_duration: escrowDuration });
});

// Analytics: usage summary
adminRoutes.get("/analytics", async (c) => {
  const [totalRequests] = await sql`SELECT COUNT(*) as count FROM usage_logs`;
  const [totalRevenue] = await sql`
    SELECT COALESCE(SUM(amount::numeric), 0) as total FROM invoices WHERE status = 'paid'
  `;
  const endpointStats = await sql`
    SELECT endpoint, COUNT(*) as requests,
           COUNT(CASE WHEN status_code = 200 THEN 1 END) as successful,
           AVG(response_time_ms) as avg_response_ms
    FROM usage_logs
    GROUP BY endpoint
    ORDER BY requests DESC
  `;

  return c.json({
    totalRequests: totalRequests.count,
    totalRevenue: totalRevenue.total,
    endpointStats,
  });
});

// Export usage data as CSV
adminRoutes.get("/analytics/export", async (c) => {
  const invoices = await sql`
    SELECT id, endpoint, amount, token, status, payer, tx_hash, created_at
    FROM invoices ORDER BY created_at DESC
  `;

  // Escape CSV fields to prevent injection (=, +, -, @, \t, \r can trigger formula execution)
  function escapeCsvField(value: string): string {
    if (!value) return '""';
    const needsQuoting = /[,"\r\n]/.test(value) || /^[=+\-@\t\r]/.test(value);
    if (needsQuoting) {
      // Prefix formula-triggering characters with a single quote inside the quoted field
      let escaped = value.replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(escaped)) {
        escaped = "'" + escaped;
      }
      return `"${escaped}"`;
    }
    return value;
  }

  const header = "id,endpoint,amount,token,status,payer,tx_hash,created_at";
  const rows = invoices.map(
    (i) =>
      [i.id, i.endpoint, i.amount, i.token, i.status, i.payer || "", i.tx_hash || "", i.created_at]
        .map((f) => escapeCsvField(String(f)))
        .join(",")
  );
  const csv = [header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="x402-usage-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});

// API key management
adminRoutes.get("/keys", async (c) => {
  const keys = await sql`SELECT id, label, owner_id, rate_limit, enabled, created_at FROM api_keys`;
  return c.json({ keys });
});

adminRoutes.post("/keys", async (c) => {
  const body = await c.req.json();
  const key = crypto.randomUUID();
  const [created] = await sql`
    INSERT INTO api_keys (key, label, owner_id, rate_limit)
    VALUES (${key}, ${body.label}, ${body.ownerId}, ${body.rateLimit || 60})
    RETURNING id, key, label, owner_id, rate_limit, enabled, created_at
  `;
  audit("create_key", "api_keys", created.id, { label: body.label, ownerId: body.ownerId });
  return c.json({ apiKey: created }, 201);
});

// ─── Agent Controls ───

// Get agent status (paused/active) — publicly accessible so agents can self-check
adminRoutes.get("/agent/:address/status", async (c) => {
  const address = c.req.param("address").toLowerCase();
  const [control] = await sql`SELECT * FROM agent_controls WHERE agent_address = ${address}`;
  return c.json({
    address,
    paused: control?.paused ?? false,
    pausedAt: control?.paused_at ?? null,
    reason: control?.reason ?? null,
  });
});

// Pause agent spending
adminRoutes.post("/agent/:address/pause", async (c) => {
  const address = c.req.param("address").toLowerCase();
  const body = await c.req.json().catch(() => ({}));
  await sql`
    INSERT INTO agent_controls (agent_address, paused, paused_at, paused_by, reason)
    VALUES (${address}, TRUE, NOW(), 'admin', ${body.reason || null})
    ON CONFLICT (agent_address) DO UPDATE SET
      paused = TRUE, paused_at = NOW(), paused_by = 'admin', reason = ${body.reason || null}
  `;
  audit("pause_agent", "agent_controls", address, { reason: body.reason });
  return c.json({ success: true, address, paused: true });
});

// Resume agent spending
adminRoutes.post("/agent/:address/resume", async (c) => {
  const address = c.req.param("address").toLowerCase();
  await sql`
    INSERT INTO agent_controls (agent_address, paused)
    VALUES (${address}, FALSE)
    ON CONFLICT (agent_address) DO UPDATE SET
      paused = FALSE, paused_at = NULL, paused_by = NULL, reason = NULL
  `;
  audit("resume_agent", "agent_controls", address, {});
  return c.json({ success: true, address, paused: false });
});

adminRoutes.patch("/keys/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await sql`
    UPDATE api_keys SET
      enabled = COALESCE(${body.enabled ?? null}, enabled),
      rate_limit = COALESCE(${body.rateLimit ?? null}, rate_limit)
    WHERE id = ${id}
  `;
  audit("update_key", "api_keys", id, { enabled: body.enabled, rateLimit: body.rateLimit });
  return c.json({ success: true });
});

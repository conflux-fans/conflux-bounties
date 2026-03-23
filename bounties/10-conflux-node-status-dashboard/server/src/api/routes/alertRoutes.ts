import { Router } from "express";
import { z } from "zod";
import type { AlertRepository } from "../../database/AlertRepository";
import { ConditionSchema, SeveritySchema, ChannelTypeSchema } from "../../config/schemas";

/** Schema for creating an alert rule */
const CreateAlertRuleSchema = z.object({
  name: z.string().min(1),
  metric: z.string().min(1),
  condition: ConditionSchema,
  threshold: z.number(),
  severity: SeveritySchema,
  cooldownMs: z.number().int().positive().default(300_000),
  channels: z.array(ChannelTypeSchema).min(1),
});

/**
 * Build Express router for /api/v1/alerts endpoints.
 * Provides alert rule CRUD, alert listing, and acknowledgment.
 */
export function alertRoutes(alertRepo: AlertRepository): Router {
  const router = Router();

  /* ───────── Alert Rules ───────── */

  /** GET /api/v1/alerts/rules — list all alert rules */
  router.get("/rules", (_req, res) => {
    const rules = alertRepo.findAllRules();
    res.json(rules);
  });

  /** POST /api/v1/alerts/rules — create an alert rule */
  router.post("/rules", (req, res) => {
    const body = CreateAlertRuleSchema.parse(req.body);
    const id = alertRepo.createRule(body);
    res.status(201).json({ id });
  });

  /** DELETE /api/v1/alerts/rules/:id — delete an alert rule */
  router.delete("/rules/:id", (req, res) => {
    const deleted = alertRepo.deleteRule(req.params.id!);
    if (!deleted) {
      res.status(404).json({ error: "Alert rule not found" });
      return;
    }
    res.status(204).end();
  });

  /* ───────── Triggered Alerts ───────── */

  /** GET /api/v1/alerts — list triggered alerts */
  router.get("/", (req, res) => {
    const nodeId = req.query.nodeId as string | undefined;
    const unresolvedOnly = req.query.unresolved === "true";
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const alerts = alertRepo.findAlerts({ nodeId, unresolvedOnly, limit });
    res.json(alerts);
  });

  /** POST /api/v1/alerts/:id/acknowledge — acknowledge an alert */
  router.post("/:id/acknowledge", (req, res) => {
    const ack = alertRepo.acknowledge(req.params.id!);
    if (!ack) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    res.json({ acknowledged: true });
  });

  /** POST /api/v1/alerts/:id/resolve — resolve an alert */
  router.post("/:id/resolve", (req, res) => {
    const resolved = alertRepo.resolve(req.params.id!);
    if (!resolved) {
      res.status(404).json({ error: "Alert not found" });
      return;
    }
    res.json({ resolved: true });
  });

  /** GET /api/v1/alerts/counts — unresolved alert counts per node */
  router.get("/counts", (_req, res) => {
    const counts = alertRepo.getUnresolvedCounts();
    res.json(counts);
  });

  return router;
}

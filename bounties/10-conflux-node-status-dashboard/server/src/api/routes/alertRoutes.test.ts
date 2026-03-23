import express from "express";
import request from "supertest";
import { Database } from "../../database/Database";
import { NodeRepository } from "../../database/NodeRepository";
import { AlertRepository } from "../../database/AlertRepository";
import { alertRoutes } from "./alertRoutes";
import { errorHandler } from "../middleware/errorHandler";
import path from "path";
import fs from "fs";
import os from "os";

describe("alertRoutes", () => {
  let app: express.Express;
  let database: Database;
  let nodeRepo: NodeRepository;
  let alertRepo: AlertRepository;
  let dbPath: string;
  let nodeId: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-alerts-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    database = new Database(dbPath);
    database.migrate();
    nodeRepo = new NodeRepository(database.db);
    alertRepo = new AlertRepository(database.db);

    nodeId = nodeRepo.create({ name: "N1", rpcUrl: "https://n1.com", spaceType: "core" });

    app = express();
    app.use(express.json());
    app.use("/api/v1/alerts", alertRoutes(alertRepo));
    app.use(errorHandler);
  });

  afterEach(() => {
    database.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      try { fs.unlinkSync(dbPath + suffix); } catch { /* ignore */ }
    }
  });

  /* ───────── Alert Rules ───────── */

  it("POST /api/v1/alerts/rules — creates a rule", async () => {
    const res = await request(app)
      .post("/api/v1/alerts/rules")
      .send({
        name: "High CPU",
        metric: "cpu_usage",
        condition: "gt",
        threshold: 90,
        severity: "critical",
        cooldownMs: 300_000,
        channels: ["console"],
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it("GET /api/v1/alerts/rules — lists rules", async () => {
    alertRepo.createRule({
      name: "R1",
      metric: "cpu",
      condition: "gt",
      threshold: 90,
      severity: "warning",
      cooldownMs: 300_000,
      channels: ["console"],
    });

    const res = await request(app).get("/api/v1/alerts/rules");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("DELETE /api/v1/alerts/rules/:id — deletes a rule", async () => {
    const id = alertRepo.createRule({
      name: "ToDelete",
      metric: "cpu",
      condition: "gt",
      threshold: 90,
      severity: "warning",
      cooldownMs: 300_000,
      channels: ["console"],
    });

    const res = await request(app).delete(`/api/v1/alerts/rules/${id}`);
    expect(res.status).toBe(204);
  });

  /* ───────── Triggered Alerts ───────── */

  it("GET /api/v1/alerts — lists triggered alerts", async () => {
    alertRepo.createAlert({
      ruleId: "r1",
      nodeId,
      metric: "cpu",
      value: 95,
      threshold: 90,
      severity: "critical",
      message: "High CPU",
    });

    const res = await request(app).get("/api/v1/alerts");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].value).toBe(95);
  });

  it("GET /api/v1/alerts?unresolved=true — filters unresolved only", async () => {
    const a1 = alertRepo.createAlert({
      ruleId: "r1", nodeId, metric: "m1", value: 1, threshold: 0, severity: "warning", message: "a",
    });
    alertRepo.createAlert({
      ruleId: "r1", nodeId, metric: "m2", value: 2, threshold: 0, severity: "warning", message: "b",
    });
    alertRepo.resolve(a1);

    const res = await request(app).get("/api/v1/alerts?unresolved=true");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].metric).toBe("m2");
  });

  it("POST /api/v1/alerts/:id/acknowledge — acknowledges", async () => {
    const id = alertRepo.createAlert({
      ruleId: "r1", nodeId, metric: "m", value: 1, threshold: 0, severity: "warning", message: "x",
    });

    const res = await request(app).post(`/api/v1/alerts/${id}/acknowledge`);
    expect(res.status).toBe(200);
    expect(res.body.acknowledged).toBe(true);
  });

  it("POST /api/v1/alerts/:id/resolve — resolves", async () => {
    const id = alertRepo.createAlert({
      ruleId: "r1", nodeId, metric: "m", value: 1, threshold: 0, severity: "warning", message: "x",
    });

    const res = await request(app).post(`/api/v1/alerts/${id}/resolve`);
    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(true);
  });

  it("GET /api/v1/alerts/counts — returns unresolved counts", async () => {
    alertRepo.createAlert({
      ruleId: "r1", nodeId, metric: "m1", value: 1, threshold: 0, severity: "warning", message: "a",
    });
    alertRepo.createAlert({
      ruleId: "r1", nodeId, metric: "m2", value: 2, threshold: 0, severity: "warning", message: "b",
    });

    const res = await request(app).get("/api/v1/alerts/counts");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].count).toBe(2);
  });
});

import express from "express";
import request from "supertest";
import { Database } from "../../database/Database";
import { NodeRepository } from "../../database/NodeRepository";
import { nodeRoutes } from "./nodeRoutes";
import { errorHandler } from "../middleware/errorHandler";
import path from "path";
import fs from "fs";
import os from "os";

describe("nodeRoutes", () => {
  let app: express.Express;
  let database: Database;
  let nodeRepo: NodeRepository;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-routes-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    database = new Database(dbPath);
    database.migrate();
    nodeRepo = new NodeRepository(database.db);

    app = express();
    app.use(express.json());
    app.use("/api/v1/nodes", nodeRoutes(nodeRepo));
    app.use(errorHandler);
  });

  afterEach(() => {
    database.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      try { fs.unlinkSync(dbPath + suffix); } catch { /* ignore */ }
    }
  });

  it("GET /api/v1/nodes — returns empty list initially", async () => {
    const res = await request(app).get("/api/v1/nodes");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("POST /api/v1/nodes — creates a node", async () => {
    const res = await request(app)
      .post("/api/v1/nodes")
      .send({ name: "Test", rpcUrl: "https://test.com", spaceType: "core" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test");
    expect(res.body.rpc_url).toBe("https://test.com");
    expect(res.body.space_type).toBe("core");
    expect(res.body.id).toBeDefined();
  });

  it("POST /api/v1/nodes — rejects invalid body", async () => {
    const res = await request(app)
      .post("/api/v1/nodes")
      .send({ name: "" });

    expect(res.status).toBe(400);
  });

  it("GET /api/v1/nodes/:id — returns a single node", async () => {
    const id = nodeRepo.create({ name: "N1", rpcUrl: "https://n1.com", spaceType: "espace" });
    const res = await request(app).get(`/api/v1/nodes/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.name).toBe("N1");
  });

  it("GET /api/v1/nodes/:id — returns 404 for missing node", async () => {
    const res = await request(app).get("/api/v1/nodes/nonexistent");
    expect(res.status).toBe(404);
  });

  it("PATCH /api/v1/nodes/:id — updates a node", async () => {
    const id = nodeRepo.create({ name: "Old", rpcUrl: "https://old.com", spaceType: "core" });
    const res = await request(app)
      .patch(`/api/v1/nodes/${id}`)
      .send({ name: "Updated" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated");
  });

  it("DELETE /api/v1/nodes/:id — deletes a node", async () => {
    const id = nodeRepo.create({ name: "Temp", rpcUrl: "https://temp.com", spaceType: "core" });
    const res = await request(app).delete(`/api/v1/nodes/${id}`);

    expect(res.status).toBe(204);

    const check = await request(app).get(`/api/v1/nodes/${id}`);
    expect(check.status).toBe(404);
  });

  it("DELETE /api/v1/nodes/:id — returns 404 for missing node", async () => {
    const res = await request(app).delete("/api/v1/nodes/nonexistent");
    expect(res.status).toBe(404);
  });
});

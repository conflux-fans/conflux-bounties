import { Router } from "express";
import { z } from "zod";
import type { NodeRepository } from "../../database/NodeRepository";
import { SpaceTypeSchema } from "../../config/schemas";

/** Zod schema for creating/updating a node */
const CreateNodeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  rpcUrl: z.string().url("Must be a valid URL"),
  spaceType: SpaceTypeSchema,
  enabled: z.boolean().optional().default(true),
});

const UpdateNodeSchema = CreateNodeSchema.partial();

/**
 * Build Express router for /api/v1/nodes endpoints.
 * Provides CRUD operations on monitored nodes.
 */
export function nodeRoutes(nodeRepo: NodeRepository): Router {
  const router = Router();

  /** GET /api/v1/nodes — list all nodes */
  router.get("/", (_req, res) => {
    const nodes = nodeRepo.findAll();
    res.json(nodes);
  });

  /** GET /api/v1/nodes/:id — get a single node */
  router.get("/:id", (req, res) => {
    const node = nodeRepo.findById(req.params.id!);
    if (!node) {
      res.status(404).json({ error: "Node not found" });
      return;
    }
    res.json(node);
  });

  /** POST /api/v1/nodes — create a new node */
  router.post("/", (req, res) => {
    const body = CreateNodeSchema.parse(req.body);
    const id = nodeRepo.create(body);
    const node = nodeRepo.findById(id);
    res.status(201).json(node);
  });

  /** PATCH /api/v1/nodes/:id — update a node */
  router.patch("/:id", (req, res) => {
    const fields = UpdateNodeSchema.parse(req.body);
    const updated = nodeRepo.update(req.params.id!, fields);
    if (!updated) {
      res.status(404).json({ error: "Node not found" });
      return;
    }
    const node = nodeRepo.findById(req.params.id!);
    res.json(node);
  });

  /** DELETE /api/v1/nodes/:id — delete a node */
  router.delete("/:id", (req, res) => {
    const deleted = nodeRepo.delete(req.params.id!);
    if (!deleted) {
      res.status(404).json({ error: "Node not found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}

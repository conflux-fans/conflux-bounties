import { Router } from "express";
import type { AlertRepository } from "../../database/AlertRepository";
/**
 * Build Express router for /api/v1/alerts endpoints.
 * Provides alert rule CRUD, alert listing, and acknowledgment.
 */
export declare function alertRoutes(alertRepo: AlertRepository): Router;
//# sourceMappingURL=alertRoutes.d.ts.map
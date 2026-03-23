import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Logger } from "../../utils/Logger";

const logger = new Logger("ErrorHandler");

/**
 * Global Express error handler.
 * Catches thrown errors and returns structured JSON responses.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  /** Zod validation errors → 400 */
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation error",
      details: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({ error: "Internal server error" });
}

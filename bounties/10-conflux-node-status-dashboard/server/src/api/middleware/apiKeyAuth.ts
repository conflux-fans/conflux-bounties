import type { Request, Response, NextFunction } from "express";

/**
 * Express middleware that validates API key from the x-api-key header.
 * If no API keys are configured (dev mode), all requests are allowed through.
 */
export function apiKeyAuth(validKeys: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    /** Skip auth if no keys are configured */
    if (validKeys.length === 0) {
      next();
      return;
    }

    const key = req.header("x-api-key");

    if (!key || !validKeys.includes(key)) {
      res.status(401).json({ error: "Invalid or missing API key" });
      return;
    }

    next();
  };
}

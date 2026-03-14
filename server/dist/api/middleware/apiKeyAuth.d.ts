import type { Request, Response, NextFunction } from "express";
/**
 * Express middleware that validates API key from the x-api-key header.
 * If no API keys are configured (dev mode), all requests are allowed through.
 */
export declare function apiKeyAuth(validKeys: string[]): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=apiKeyAuth.d.ts.map
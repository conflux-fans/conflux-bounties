/**
 * Minimal injectable logger interface for the automation module.
 *
 * The SDK ships with NO logging dependency. Consumers can pass any compatible
 * logger (pino, winston, console wrapper …) or omit it to get silent behaviour.
 */
export interface AutomationLogger {
  info(msg: string | object, ...args: unknown[]): void;
  warn(msg: string | object, ...args: unknown[]): void;
  debug(msg: string | object, ...args: unknown[]): void;
  error(msg: string | object, ...args: unknown[]): void;
}

/** Default no-op logger — used when no logger is supplied. */
export const noopLogger: AutomationLogger = {
  info: () => {},
  warn: () => {},
  debug: () => {},
  error: () => {},
};

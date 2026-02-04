/**
 * Lightweight structured logger.
 * Outputs JSON in production, pretty-printed in development.
 */
export class Logger {
  constructor(private readonly context: string) {}

  /** Log an informational message */
  info(message: string, data?: Record<string, unknown>): void {
    this.log("INFO", message, data);
  }

  /** Log a warning message */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log("WARN", message, data);
  }

  /** Log an error message */
  error(message: string, data?: Record<string, unknown>): void {
    this.log("ERROR", message, data);
  }

  /** Log a debug message (only in development) */
  debug(message: string, data?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== "production") {
      this.log("DEBUG", message, data);
    }
  }

  private log(
    level: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
      ...data,
    };

    const output = JSON.stringify(entry);

    if (level === "ERROR") {
      console.error(output);
    } else if (level === "WARN") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
}

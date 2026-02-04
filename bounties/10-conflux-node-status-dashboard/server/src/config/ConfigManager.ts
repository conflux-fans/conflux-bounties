import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import {
  AppConfigSchema,
  EnvSchema,
  type AppConfig,
  type EnvConfig,
} from "./schemas";

/**
 * Manages application configuration from environment variables
 * and an optional JSON config file.
 */
export class ConfigManager {
  public readonly env: EnvConfig;
  public config: AppConfig;

  constructor(envPath?: string) {
    dotenv.config({ path: envPath });
    this.env = EnvSchema.parse(process.env);
    this.config = this.loadConfigFile();
  }

  /** Load and validate config.json from project root */
  private loadConfigFile(): AppConfig {
    const candidates = [
      path.resolve(process.cwd(), "config.json"),
      path.resolve(process.cwd(), "../config.json"),
      path.resolve(__dirname, "../../config.json"),
      path.resolve(__dirname, "../../../config.json"),
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        return AppConfigSchema.parse(JSON.parse(raw));
      }
    }

    /** Fall back to default config built from env vars */
    return AppConfigSchema.parse({
      nodes: this.buildNodesFromEnv(),
      pollingIntervalMs: this.env.METRIC_INTERVAL_MS,
      retentionDays: this.env.RETENTION_DAYS,
    });
  }

  /** Build node list from comma-separated env vars */
  private buildNodesFromEnv(): Array<{
    name: string;
    rpcUrl: string;
    spaceType: string;
  }> {
    const nodes: Array<{ name: string; rpcUrl: string; spaceType: string }> = [];

    const coreUrls = this.env.CONFLUX_CORE_RPC_URLS.split(",").filter(Boolean);
    coreUrls.forEach((url, i) => {
      nodes.push({
        name: `Core Node ${i + 1}`,
        rpcUrl: url.trim(),
        spaceType: "core",
      });
    });

    const espaceUrls = this.env.CONFLUX_ESPACE_RPC_URLS.split(",").filter(Boolean);
    espaceUrls.forEach((url, i) => {
      nodes.push({
        name: `eSpace Node ${i + 1}`,
        rpcUrl: url.trim(),
        spaceType: "espace",
      });
    });

    return nodes;
  }

  /** Get parsed API keys as an array */
  get apiKeys(): string[] {
    return this.env.API_KEYS.split(",").filter(Boolean);
  }

  /** Check if the app is in development mode */
  get isDev(): boolean {
    return this.env.NODE_ENV === "development";
  }
}

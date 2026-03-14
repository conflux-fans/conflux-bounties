import { type AppConfig, type EnvConfig } from "./schemas";
/**
 * Manages application configuration from environment variables
 * and an optional JSON config file.
 */
export declare class ConfigManager {
    readonly env: EnvConfig;
    config: AppConfig;
    constructor(envPath?: string);
    /** Load and validate config.json from project root */
    private loadConfigFile;
    /** Build node list from comma-separated env vars */
    private buildNodesFromEnv;
    /** Get parsed API keys as an array */
    get apiKeys(): string[];
    /** Check if the app is in development mode */
    get isDev(): boolean;
}
//# sourceMappingURL=ConfigManager.d.ts.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const schemas_1 = require("./schemas");
/**
 * Manages application configuration from environment variables
 * and an optional JSON config file.
 */
class ConfigManager {
    env;
    config;
    constructor(envPath) {
        dotenv_1.default.config({ path: envPath });
        this.env = schemas_1.EnvSchema.parse(process.env);
        this.config = this.loadConfigFile();
    }
    /** Load and validate config.json from project root */
    loadConfigFile() {
        const candidates = [
            path_1.default.resolve(process.cwd(), "config.json"),
            path_1.default.resolve(process.cwd(), "../config.json"),
            path_1.default.resolve(__dirname, "../../config.json"),
            path_1.default.resolve(__dirname, "../../../config.json"),
        ];
        for (const filePath of candidates) {
            if (fs_1.default.existsSync(filePath)) {
                const raw = fs_1.default.readFileSync(filePath, "utf-8");
                return schemas_1.AppConfigSchema.parse(JSON.parse(raw));
            }
        }
        /** Fall back to default config built from env vars */
        return schemas_1.AppConfigSchema.parse({
            nodes: this.buildNodesFromEnv(),
            pollingIntervalMs: this.env.METRIC_INTERVAL_MS,
            retentionDays: this.env.RETENTION_DAYS,
        });
    }
    /** Build node list from comma-separated env vars */
    buildNodesFromEnv() {
        const nodes = [];
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
    get apiKeys() {
        return this.env.API_KEYS.split(",").filter(Boolean);
    }
    /** Check if the app is in development mode */
    get isDev() {
        return this.env.NODE_ENV === "development";
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=ConfigManager.js.map
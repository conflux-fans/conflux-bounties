"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Application = void 0;
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const Logger_1 = require("./utils/Logger");
const ConfigManager_1 = require("./config/ConfigManager");
const Database_1 = require("./database/Database");
const NodeRepository_1 = require("./database/NodeRepository");
const MetricRepository_1 = require("./database/MetricRepository");
const AlertRepository_1 = require("./database/AlertRepository");
const RpcClientFactory_1 = require("./rpc/RpcClientFactory");
const collector_1 = require("./collector");
const alerting_1 = require("./alerting");
const SocketManager_1 = require("./api/websocket/SocketManager");
const nodeRoutes_1 = require("./api/routes/nodeRoutes");
const metricRoutes_1 = require("./api/routes/metricRoutes");
const alertRoutes_1 = require("./api/routes/alertRoutes");
const apiKeyAuth_1 = require("./api/middleware/apiKeyAuth");
const errorHandler_1 = require("./api/middleware/errorHandler");
/**
 * Main application orchestrator.
 * Wires together config, database, collector, alerting, API, and WebSocket.
 */
class Application {
    logger = new Logger_1.Logger("Application");
    configManager;
    database;
    nodeRepo;
    metricRepo;
    alertRepo;
    rpcFactory;
    probeRegistry;
    probeScheduler;
    alertEngine;
    app;
    httpServer;
    socketManager;
    /** In-memory map of nodeId → NodeRow for quick lookups */
    nodeMap = new Map();
    /** Handle for the daily pruning interval */
    pruneInterval;
    constructor() {
        /** 1. Configuration */
        this.configManager = new ConfigManager_1.ConfigManager();
        const { env, config } = this.configManager;
        /** 2. Database */
        this.database = new Database_1.Database(env.DATABASE_PATH);
        this.database.migrate();
        this.nodeRepo = new NodeRepository_1.NodeRepository(this.database.db);
        this.metricRepo = new MetricRepository_1.MetricRepository(this.database.db);
        this.alertRepo = new AlertRepository_1.AlertRepository(this.database.db);
        /** 3. RPC client factory */
        this.rpcFactory = new RpcClientFactory_1.RpcClientFactory();
        /** 4. Probe registry — register all built-in probes */
        this.probeRegistry = new collector_1.ProbeRegistry();
        this.probeRegistry.register(new collector_1.SyncStatusProbe(this.rpcFactory));
        this.probeRegistry.register(new collector_1.BlockHeightProbe(this.rpcFactory));
        this.probeRegistry.register(new collector_1.GasPriceProbe(this.rpcFactory));
        this.probeRegistry.register(new collector_1.PeerCountProbe(this.rpcFactory));
        this.probeRegistry.register(new collector_1.PendingTxProbe(this.rpcFactory));
        this.probeRegistry.register(new collector_1.RpcLatencyProbe(this.rpcFactory));
        this.probeRegistry.register(new collector_1.SystemStatsProbe());
        this.probeRegistry.register(new collector_1.BlockDetailProbe(this.rpcFactory));
        /** 5. Express + HTTP server */
        this.app = (0, express_1.default)();
        this.httpServer = http_1.default.createServer(this.app);
        /** 6. Socket.IO */
        this.socketManager = new SocketManager_1.SocketManager(this.httpServer);
        /** 7. Probe scheduler — feeds results to DB, WS, and alert engine */
        this.probeScheduler = new collector_1.ProbeScheduler(this.probeRegistry, config.pollingIntervalMs, (results) => this.handleMetrics(results));
        /** 8. Alert engine */
        this.alertEngine = new alerting_1.AlertEngine(this.alertRepo, this.nodeMap);
        this.alertEngine.maintenanceMode = config.maintenanceMode;
        this.alertEngine.onAlert = (type, payload) => {
            this.socketManager.broadcastAlert(type, payload);
        };
        /** Register alert channels */
        this.alertEngine.registerChannel(new alerting_1.ConsoleChannel());
        if (env.ALERT_SLACK_WEBHOOK) {
            this.alertEngine.registerChannel(new alerting_1.SlackChannel(env.ALERT_SLACK_WEBHOOK));
        }
        if (env.SMTP_HOST) {
            this.alertEngine.registerChannel(new alerting_1.EmailChannel({
                host: env.SMTP_HOST,
                port: env.SMTP_PORT,
                user: env.SMTP_USER,
                pass: env.SMTP_PASS,
                from: env.SMTP_FROM,
                to: env.ALERT_EMAIL_TO,
            }));
        }
        if (env.ALERT_WEBHOOK_URL) {
            this.alertEngine.registerChannel(new alerting_1.WebhookChannel(env.ALERT_WEBHOOK_URL));
        }
        /** 9. Setup Express middleware and routes */
        this.setupMiddleware();
        this.setupRoutes();
    }
    /** Configure Express middleware stack */
    setupMiddleware() {
        this.app.use((0, cors_1.default)());
        this.app.use(express_1.default.json());
        /** Rate limiting: 200 requests per minute per IP */
        this.app.use((0, express_rate_limit_1.default)({
            windowMs: 60_000,
            max: 200,
            standardHeaders: true,
            legacyHeaders: false,
        }));
        /** API key auth (skipped if no keys configured) */
        this.app.use("/api", (0, apiKeyAuth_1.apiKeyAuth)(this.configManager.apiKeys));
    }
    /** Mount API routes */
    setupRoutes() {
        this.app.use("/api/v1/nodes", (0, nodeRoutes_1.nodeRoutes)(this.nodeRepo));
        this.app.use("/api/v1/metrics", (0, metricRoutes_1.metricRoutes)(this.metricRepo, this.nodeRepo));
        this.app.use("/api/v1/alerts", (0, alertRoutes_1.alertRoutes)(this.alertRepo));
        /** Health check */
        this.app.get("/health", (_req, res) => {
            res.json({
                status: "ok",
                uptime: process.uptime(),
                activeNodes: this.probeScheduler.getActiveNodeIds().length,
                connections: this.socketManager.getConnectionCount(),
            });
        });
        /** Error handler must be last */
        this.app.use(errorHandler_1.errorHandler);
    }
    /**
     * Handle incoming metric results from the probe scheduler.
     * Stores to DB, broadcasts via WebSocket, and feeds to alert engine.
     */
    handleMetrics(results) {
        /** Store in database */
        this.metricRepo.insertBatch(results);
        /** Group by nodeId for WebSocket broadcast */
        const byNode = new Map();
        for (const r of results) {
            let arr = byNode.get(r.nodeId);
            if (!arr) {
                arr = [];
                byNode.set(r.nodeId, arr);
            }
            arr.push({
                metricName: r.metricName,
                value: r.value,
                unit: r.unit,
                timestamp: r.timestamp,
            });
        }
        for (const [nodeId, metrics] of byNode) {
            this.socketManager.broadcastMetrics(nodeId, metrics);
        }
        /** Feed to alert engine */
        this.alertEngine.processMetrics(results).catch((err) => {
            this.logger.error("Alert processing failed", {
                error: err instanceof Error ? err.message : String(err),
            });
        });
    }
    /** Seed initial nodes from config and start polling */
    async seedAndStartPolling() {
        const { config, env } = this.configManager;
        /** Seed demo data if SEED_DEMO is set */
        if (env.SEED_DEMO === "true" || env.SEED_DEMO === "1") {
            await this.seedDemoData();
            return;
        }
        /** Seed nodes from config if none exist in DB */
        const existingNodes = this.nodeRepo.findAll();
        if (existingNodes.length === 0 && config.nodes.length > 0) {
            this.logger.info(`Seeding ${config.nodes.length} nodes from config`);
            for (const n of config.nodes) {
                this.nodeRepo.create({
                    name: n.name,
                    rpcUrl: n.rpcUrl,
                    spaceType: n.spaceType,
                    enabled: n.enabled,
                });
            }
        }
        /** Seed alert rules from config if none exist */
        const existingRules = this.alertRepo.findAllRules();
        if (existingRules.length === 0 && config.alertRules.length > 0) {
            this.logger.info(`Seeding ${config.alertRules.length} alert rules from config`);
            for (const r of config.alertRules) {
                this.alertRepo.createRule({
                    name: r.name,
                    metric: r.metric,
                    condition: r.condition,
                    threshold: r.threshold,
                    severity: r.severity,
                    cooldownMs: r.cooldownMs,
                    channels: r.channels,
                });
            }
        }
        /** Build nodeMap and start polling for enabled nodes */
        const enabledNodes = this.nodeRepo.findEnabled();
        for (const node of enabledNodes) {
            this.nodeMap.set(node.id, node);
            this.probeScheduler.startNode(node);
        }
        this.logger.info(`Started polling for ${enabledNodes.length} nodes`);
    }
    /** Seed demo data for the Docker demo */
    async seedDemoData() {
        this.logger.info("Seeding demo data...");
        /** Create demo nodes */
        const demoNodes = [
            { name: "Conflux Core Mainnet", rpcUrl: "https://main.confluxrpc.com", spaceType: "core", enabled: true },
            { name: "Conflux eSpace Mainnet", rpcUrl: "https://evm.confluxrpc.com", spaceType: "espace", enabled: true },
            { name: "Conflux Core Testnet", rpcUrl: "https://test.confluxrpc.com", spaceType: "core", enabled: true },
            { name: "Conflux eSpace Testnet", rpcUrl: "https://evmtestnet.confluxrpc.com", spaceType: "espace", enabled: true },
        ];
        for (const n of demoNodes) {
            const nodeId = this.nodeRepo.create(n);
            const node = this.nodeRepo.findById(nodeId);
            if (node) {
                this.nodeMap.set(node.id, node);
            }
        }
        /** Generate 24h of simulated metrics */
        const now = Date.now();
        const points = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 5) {
                const timestamp = Math.floor((now - (24 * 60 - h * 60 - m) * 60 * 1000) / 1000);
                for (const node of this.nodeRepo.findAll()) {
                    /** Random but realistic values */
                    points.push({
                        nodeId: node.id,
                        metricName: "block_height",
                        value: 10000000 + h * 1000 + Math.floor(Math.random() * 100),
                        unit: "",
                        timestamp,
                    });
                    points.push({
                        nodeId: node.id,
                        metricName: "peer_count",
                        value: 20 + Math.floor(Math.random() * 30),
                        unit: "",
                        timestamp,
                    });
                    points.push({
                        nodeId: node.id,
                        metricName: "rpc_latency",
                        value: 100 + Math.random() * 200,
                        unit: "ms",
                        timestamp,
                    });
                    points.push({
                        nodeId: node.id,
                        metricName: "gas_price_gwei",
                        value: 0.1 + Math.random() * 0.5,
                        unit: "gwei",
                        timestamp,
                    });
                    points.push({
                        nodeId: node.id,
                        metricName: "cpu_usage",
                        value: 10 + Math.random() * 40,
                        unit: "%",
                        timestamp,
                    });
                    points.push({
                        nodeId: node.id,
                        metricName: "memory_usage",
                        value: 30 + Math.random() * 30,
                        unit: "%",
                        timestamp,
                    });
                    points.push({
                        nodeId: node.id,
                        metricName: "disk_usage",
                        value: 40 + Math.random() * 20,
                        unit: "%",
                        timestamp,
                    });
                }
            }
        }
        this.metricRepo.insertBatch(points);
        this.logger.info(`Seeded ${points.length} demo metric points for ${demoNodes.length} nodes`);
        /** Start polling for enabled nodes */
        const enabledNodes = this.nodeRepo.findEnabled();
        for (const node of enabledNodes) {
            this.probeScheduler.startNode(node);
        }
        this.logger.info("Demo data seeding complete");
    }
    /** Start the server */
    async start() {
        const port = this.configManager.env.PORT;
        await this.seedAndStartPolling();
        /** Schedule daily metric pruning */
        this.pruneInterval = setInterval(() => this.database.pruneMetrics(this.configManager.config.retentionDays), 24 * 60 * 60 * 1000);
        this.httpServer.listen(port, () => {
            this.logger.info(`Server listening on port ${port}`);
            this.logger.info(`Probes: ${this.probeRegistry.names().join(", ")}`);
        });
    }
    /** Graceful shutdown */
    async stop() {
        this.logger.info("Shutting down...");
        if (this.pruneInterval)
            clearInterval(this.pruneInterval);
        this.probeScheduler.stopAll();
        this.socketManager.io.close();
        this.httpServer.close();
        this.database.close();
        this.logger.info("Shutdown complete");
    }
}
exports.Application = Application;
//# sourceMappingURL=Application.js.map
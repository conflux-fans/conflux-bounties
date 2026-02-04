import http from "http";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { Logger } from "./utils/Logger";
import { ConfigManager } from "./config/ConfigManager";
import { Database } from "./database/Database";
import { NodeRepository, type NodeRow } from "./database/NodeRepository";
import { MetricRepository } from "./database/MetricRepository";
import { AlertRepository } from "./database/AlertRepository";
import { RpcClientFactory } from "./rpc/RpcClientFactory";
import {
  ProbeRegistry,
  ProbeScheduler,
  SyncStatusProbe,
  BlockHeightProbe,
  GasPriceProbe,
  PeerCountProbe,
  PendingTxProbe,
  RpcLatencyProbe,
  SystemStatsProbe,
  BlockDetailProbe,
} from "./collector";
import {
  AlertEngine,
  ConsoleChannel,
  SlackChannel,
  EmailChannel,
  WebhookChannel,
} from "./alerting";
import { SocketManager } from "./api/websocket/SocketManager";
import { nodeRoutes } from "./api/routes/nodeRoutes";
import { metricRoutes } from "./api/routes/metricRoutes";
import { alertRoutes } from "./api/routes/alertRoutes";
import { apiKeyAuth } from "./api/middleware/apiKeyAuth";
import { errorHandler } from "./api/middleware/errorHandler";

/**
 * Main application orchestrator.
 * Wires together config, database, collector, alerting, API, and WebSocket.
 */
export class Application {
  private readonly logger = new Logger("Application");
  private readonly configManager: ConfigManager;
  private readonly database: Database;
  private readonly nodeRepo: NodeRepository;
  private readonly metricRepo: MetricRepository;
  private readonly alertRepo: AlertRepository;
  private readonly rpcFactory: RpcClientFactory;
  private readonly probeRegistry: ProbeRegistry;
  private readonly probeScheduler: ProbeScheduler;
  private readonly alertEngine: AlertEngine;
  private readonly app: express.Application;
  private readonly httpServer: http.Server;
  private readonly socketManager: SocketManager;

  /** In-memory map of nodeId → NodeRow for quick lookups */
  private readonly nodeMap = new Map<string, NodeRow>();

  /** Handle for the daily pruning interval */
  private pruneInterval?: ReturnType<typeof setInterval>;

  constructor() {
    /** 1. Configuration */
    this.configManager = new ConfigManager();
    const { env, config } = this.configManager;

    /** 2. Database */
    this.database = new Database(env.DATABASE_PATH);
    this.database.migrate();
    this.nodeRepo = new NodeRepository(this.database.db);
    this.metricRepo = new MetricRepository(this.database.db);
    this.alertRepo = new AlertRepository(this.database.db);

    /** 3. RPC client factory */
    this.rpcFactory = new RpcClientFactory();

    /** 4. Probe registry — register all built-in probes */
    this.probeRegistry = new ProbeRegistry();
    this.probeRegistry.register(new SyncStatusProbe(this.rpcFactory));
    this.probeRegistry.register(new BlockHeightProbe(this.rpcFactory));
    this.probeRegistry.register(new GasPriceProbe(this.rpcFactory));
    this.probeRegistry.register(new PeerCountProbe(this.rpcFactory));
    this.probeRegistry.register(new PendingTxProbe(this.rpcFactory));
    this.probeRegistry.register(new RpcLatencyProbe(this.rpcFactory));
    this.probeRegistry.register(new SystemStatsProbe());
    this.probeRegistry.register(new BlockDetailProbe(this.rpcFactory));

    /** 5. Express + HTTP server */
    this.app = express();
    this.httpServer = http.createServer(this.app);

    /** 6. Socket.IO */
    this.socketManager = new SocketManager(this.httpServer);

    /** 7. Probe scheduler — feeds results to DB, WS, and alert engine */
    this.probeScheduler = new ProbeScheduler(
      this.probeRegistry,
      config.pollingIntervalMs,
      (results) => this.handleMetrics(results)
    );

    /** 8. Alert engine */
    this.alertEngine = new AlertEngine(this.alertRepo, this.nodeMap);
    this.alertEngine.maintenanceMode = config.maintenanceMode;
    this.alertEngine.onAlert = (type, payload) => {
      this.socketManager.broadcastAlert(type, payload);
    };

    /** Register alert channels */
    this.alertEngine.registerChannel(new ConsoleChannel());
    if (env.ALERT_SLACK_WEBHOOK) {
      this.alertEngine.registerChannel(new SlackChannel(env.ALERT_SLACK_WEBHOOK));
    }
    if (env.SMTP_HOST) {
      this.alertEngine.registerChannel(
        new EmailChannel({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
          from: env.SMTP_FROM,
          to: env.ALERT_EMAIL_TO,
        })
      );
    }
    if (env.ALERT_WEBHOOK_URL) {
      this.alertEngine.registerChannel(new WebhookChannel(env.ALERT_WEBHOOK_URL));
    }

    /** 9. Setup Express middleware and routes */
    this.setupMiddleware();
    this.setupRoutes();
  }

  /** Configure Express middleware stack */
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());

    /** Rate limiting: 200 requests per minute per IP */
    this.app.use(
      rateLimit({
        windowMs: 60_000,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false,
      })
    );

    /** API key auth (skipped if no keys configured) */
    this.app.use("/api", apiKeyAuth(this.configManager.apiKeys));
  }

  /** Mount API routes */
  private setupRoutes(): void {
    this.app.use("/api/v1/nodes", nodeRoutes(this.nodeRepo));
    this.app.use("/api/v1/metrics", metricRoutes(this.metricRepo));
    this.app.use("/api/v1/alerts", alertRoutes(this.alertRepo));

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
    this.app.use(errorHandler);
  }

  /**
   * Handle incoming metric results from the probe scheduler.
   * Stores to DB, broadcasts via WebSocket, and feeds to alert engine.
   */
  private handleMetrics(
    results: Array<{
      nodeId: string;
      metricName: string;
      value: number;
      unit: string;
      timestamp: number;
    }>
  ): void {
    /** Store in database */
    this.metricRepo.insertBatch(results);

    /** Group by nodeId for WebSocket broadcast */
    const byNode = new Map<
      string,
      Array<{ metricName: string; value: number; unit: string; timestamp: number }>
    >();
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
  private async seedAndStartPolling(): Promise<void> {
    const { config } = this.configManager;

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

  /** Start the server */
  async start(): Promise<void> {
    const port = this.configManager.env.PORT;

    await this.seedAndStartPolling();

    /** Schedule daily metric pruning */
    this.pruneInterval = setInterval(
      () => this.database.pruneMetrics(this.configManager.config.retentionDays),
      24 * 60 * 60 * 1000
    );

    this.httpServer.listen(port, () => {
      this.logger.info(`Server listening on port ${port}`);
      this.logger.info(
        `Probes: ${this.probeRegistry.names().join(", ")}`
      );
    });
  }

  /** Graceful shutdown */
  async stop(): Promise<void> {
    this.logger.info("Shutting down...");

    if (this.pruneInterval) clearInterval(this.pruneInterval);
    this.probeScheduler.stopAll();
    this.socketManager.io.close();
    this.httpServer.close();
    this.database.close();

    this.logger.info("Shutdown complete");
  }
}

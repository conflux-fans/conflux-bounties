/**
 * Main application orchestrator.
 * Wires together config, database, collector, alerting, API, and WebSocket.
 */
export declare class Application {
    private readonly logger;
    private readonly configManager;
    private readonly database;
    private readonly nodeRepo;
    private readonly metricRepo;
    private readonly alertRepo;
    private readonly rpcFactory;
    private readonly probeRegistry;
    private readonly probeScheduler;
    private readonly alertEngine;
    private readonly app;
    private readonly httpServer;
    private readonly socketManager;
    /** In-memory map of nodeId → NodeRow for quick lookups */
    private readonly nodeMap;
    /** Handle for the daily pruning interval */
    private pruneInterval?;
    constructor();
    /** Configure Express middleware stack */
    private setupMiddleware;
    /** Mount API routes */
    private setupRoutes;
    /**
     * Handle incoming metric results from the probe scheduler.
     * Stores to DB, broadcasts via WebSocket, and feeds to alert engine.
     */
    private handleMetrics;
    /** Seed initial nodes from config and start polling */
    private seedAndStartPolling;
    /** Seed demo data for the Docker demo */
    private seedDemoData;
    /** Start the server */
    start(): Promise<void>;
    /** Graceful shutdown */
    stop(): Promise<void>;
}
//# sourceMappingURL=Application.d.ts.map
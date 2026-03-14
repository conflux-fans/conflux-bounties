import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
/**
 * Manages Socket.IO server lifecycle.
 * Clients join rooms per node (e.g. "node:<id>") to receive only relevant updates.
 * Broadcasts: "metrics:update", "alert:triggered", "alert:resolved".
 */
export declare class SocketManager {
    private readonly logger;
    readonly io: SocketServer;
    constructor(httpServer: HttpServer);
    /** Broadcast metric updates to the node's room and the "all" room */
    broadcastMetrics(nodeId: string, metrics: Array<{
        metricName: string;
        value: number;
        unit: string;
        timestamp: number;
    }>): void;
    /** Broadcast an alert event to all connected clients */
    broadcastAlert(type: "triggered" | "resolved", payload: unknown): void;
    /** Get the count of connected clients */
    getConnectionCount(): number;
}
//# sourceMappingURL=SocketManager.d.ts.map
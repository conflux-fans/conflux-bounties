"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketManager = void 0;
const socket_io_1 = require("socket.io");
const Logger_1 = require("../../utils/Logger");
/**
 * Manages Socket.IO server lifecycle.
 * Clients join rooms per node (e.g. "node:<id>") to receive only relevant updates.
 * Broadcasts: "metrics:update", "alert:triggered", "alert:resolved".
 */
class SocketManager {
    logger = new Logger_1.Logger("SocketManager");
    io;
    constructor(httpServer) {
        this.io = new socket_io_1.Server(httpServer, {
            cors: { origin: "*", methods: ["GET", "POST"] },
            pingInterval: 10_000,
            pingTimeout: 5_000,
        });
        this.io.on("connection", (socket) => {
            this.logger.info("Client connected", { socketId: socket.id });
            /** Client subscribes to a specific node's updates */
            socket.on("subscribe", (nodeId) => {
                const room = `node:${nodeId}`;
                socket.join(room);
                this.logger.debug(`Socket ${socket.id} joined room ${room}`);
            });
            /** Client unsubscribes from a node */
            socket.on("unsubscribe", (nodeId) => {
                const room = `node:${nodeId}`;
                socket.leave(room);
                this.logger.debug(`Socket ${socket.id} left room ${room}`);
            });
            /** Subscribe to all nodes */
            socket.on("subscribe:all", () => {
                socket.join("all");
                this.logger.debug(`Socket ${socket.id} joined room all`);
            });
            socket.on("disconnect", () => {
                this.logger.debug("Client disconnected", { socketId: socket.id });
            });
        });
    }
    /** Broadcast metric updates to the node's room and the "all" room */
    broadcastMetrics(nodeId, metrics) {
        const payload = { nodeId, metrics };
        this.io.to(`node:${nodeId}`).emit("metrics:update", payload);
        this.io.to("all").emit("metrics:update", payload);
    }
    /** Broadcast an alert event to all connected clients */
    broadcastAlert(type, payload) {
        this.io.emit(`alert:${type}`, payload);
    }
    /** Get the count of connected clients */
    getConnectionCount() {
        return this.io.engine.clientsCount;
    }
}
exports.SocketManager = SocketManager;
//# sourceMappingURL=SocketManager.js.map
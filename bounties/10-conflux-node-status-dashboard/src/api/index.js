"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const static_1 = __importDefault(require("@fastify/static"));
const collector_js_1 = require("./collector.js");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const CONFIG_PATH = process.env.CONFIG_PATH || path.resolve('config/nodes.yaml');
const DB_PATH = process.env.DB_PATH || path.resolve('data/metrics.db');
const PORT = parseInt(process.env.PORT || '3001', 10);
async function main() {
    const { nodes, alerts: alertRules } = (0, collector_js_1.loadConfig)(CONFIG_PATH);
    const db = new collector_js_1.MetricsDB(DB_PATH);
    const app = (0, fastify_1.default)({ logger: false });
    await app.register(websocket_1.default);
    const wsClients = new Set();
    app.get('/ws', { websocket: true }, (socket) => {
        wsClients.add(socket);
        socket.on('close', () => wsClients.delete(socket));
    });
    app.get('/api/nodes', async () => nodes);
    app.get('/api/alerts', async () => db.getRecentAlerts(100));
    app.get('/api/metrics/:nodeId', async (req) => {
        const since = parseInt(req.query.since || String(Date.now() - 86400000), 10);
        return db.getMetrics(req.params.nodeId, since);
    });
    app.get('/api/metrics/:nodeId/latest', async (req) => {
        return db.getLatestMetrics(req.params.nodeId);
    });
    app.get('/api/export/:nodeId', async (req, reply) => {
        const since = parseInt(req.query.since || String(Date.now() - 86400000), 10);
        const csv = db.exportCSV(req.params.nodeId, since);
        reply.type('text/csv').send(csv);
    });
    // Serve frontend if built
    const frontendDir = path.resolve('frontend/dist');
    if (fs.existsSync(frontendDir)) {
        await app.register(static_1.default, { root: frontendDir, prefix: '/' });
    }
    const activeAlerts = new Map();
    async function collect() {
        for (const node of nodes) {
            const interval = (node.pollInterval || 10) * 1000;
            let lastRun = 0;
            const poll = async () => {
                const now = Date.now();
                if (now - lastRun < interval)
                    return;
                lastRun = now;
                try {
                    const [status, peers, sysM] = await Promise.all([
                        (0, collector_js_1.probeConfluxNode)(node), (0, collector_js_1.probePeerCount)(node.rpcUrl), (0, collector_js_1.probeSystemMetrics)(node.id),
                    ]);
                    status.peerCount = peers;
                    db.insertMetrics(status, sysM);
                    const events = (0, collector_js_1.checkAlerts)(alertRules, status, sysM);
                    for (const event of events) {
                        const lastTriggered = activeAlerts.get(event.ruleId) || 0;
                        const rule = alertRules.find(r => r.id === event.ruleId);
                        const cooldown = rule?.cooldown || 300;
                        if (now - lastTriggered >= cooldown * 1000) {
                            db.insertAlert(event);
                            activeAlerts.set(event.ruleId, now);
                            await (0, collector_js_1.sendAlert)(event, rule?.webhookUrl);
                            const msg = JSON.stringify({ type: 'alert', data: event });
                            for (const c of wsClients) {
                                try {
                                    c.send(msg);
                                }
                                catch {
                                    wsClients.delete(c);
                                }
                            }
                        }
                    }
                    const latest = { ...status, ...sysM };
                    const msg = JSON.stringify({ type: 'metrics', data: latest });
                    for (const c of wsClients) {
                        try {
                            c.send(msg);
                        }
                        catch {
                            wsClients.delete(c);
                        }
                    }
                }
                catch (e) {
                    console.error(`Error collecting from ${node.id}:`, e.message);
                }
            };
            poll();
            setInterval(poll, 5000);
        }
    }
    collect();
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Conflux Dashboard API running on http://0.0.0.0:${PORT}`);
}
main().catch(console.error);

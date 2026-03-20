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
exports.MetricsDB = void 0;
exports.probeConfluxNode = probeConfluxNode;
exports.probePeerCount = probePeerCount;
exports.probeSystemMetrics = probeSystemMetrics;
exports.checkAlerts = checkAlerts;
exports.sendAlert = sendAlert;
exports.loadConfig = loadConfig;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const sys = __importStar(require("systeminformation"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml_1 = require("yaml");
async function probeConfluxNode(config) {
    const start = Date.now();
    try {
        const resp = await fetch(config.rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'cfx_getStatus', params: [], id: 1 }),
        });
        const latency = Date.now() - start;
        const json = await resp.json();
        const r = json.result || {};
        return {
            nodeId: config.id, timestamp: Date.now(),
            bestEpoch: r.bestEpochNumber || '0',
            latestCheckpoint: r.latestCheckpoint || '0',
            latestConfirmed: r.latestConfirmed || '0',
            blockNumber: r.blockNumber || '0',
            pendingTxCount: parseInt(r.pendingTransactions || '0', 10),
            peerCount: 0, rpcLatency: latency,
            chainId: r.chainId || '0', gasPrice: r.gasPrice || '0',
        };
    }
    catch {
        return {
            nodeId: config.id, timestamp: Date.now(),
            bestEpoch: '0', latestCheckpoint: '0', latestConfirmed: '0',
            blockNumber: '0', pendingTxCount: 0, peerCount: 0,
            rpcLatency: -1, chainId: '0', gasPrice: '0',
        };
    }
}
async function probePeerCount(rpcUrl) {
    try {
        const resp = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'cfx_nodePeers', params: [], id: 2 }),
        });
        const json = await resp.json();
        return Array.isArray(json.result) ? json.result.length : 0;
    }
    catch {
        return 0;
    }
}
async function probeSystemMetrics(nodeId) {
    const [cpu, mem, disks] = await Promise.all([
        sys.currentLoad(), sys.mem(), sys.fsSize(),
    ]);
    const d = disks.find(d => d.mount === '/') || disks[0];
    return {
        nodeId, timestamp: Date.now(),
        cpuUsage: Math.round(cpu.currentLoad * 100) / 100,
        memoryUsage: mem.active, memoryTotal: mem.total,
        diskUsage: d ? d.used : 0, diskTotal: d ? d.size : 0,
    };
}
function checkAlerts(rules, status, sysM) {
    const events = [];
    const now = Date.now();
    for (const rule of rules) {
        if (!rule.enabled || rule.nodeId !== status.nodeId)
            continue;
        let value = 0;
        switch (rule.metric) {
            case 'peerCount':
                value = status.peerCount;
                break;
            case 'rpcLatency':
                value = status.rpcLatency;
                break;
            case 'cpuUsage':
                value = sysM.cpuUsage;
                break;
            case 'memoryUsage':
                value = sysM.memoryTotal ? (sysM.memoryUsage / sysM.memoryTotal) * 100 : 0;
                break;
            case 'diskUsage':
                value = sysM.diskTotal ? (sysM.diskUsage / sysM.diskTotal) * 100 : 0;
                break;
            default: continue;
        }
        const triggered = (rule.operator === 'gt' && value > rule.threshold) ||
            (rule.operator === 'lt' && value < rule.threshold) ||
            (rule.operator === 'eq' && value === rule.threshold);
        if (triggered) {
            events.push({
                id: `${rule.id}-${now}`, ruleId: rule.id, nodeId: rule.nodeId,
                metric: rule.metric, value, threshold: rule.threshold,
                severity: rule.severity, timestamp: now,
                message: `[${rule.severity.toUpperCase()}] ${rule.nodeId}: ${rule.metric}=${value} (threshold: ${rule.operator}${rule.threshold})`,
            });
        }
    }
    return events;
}
async function sendAlert(alert, webhookUrl) {
    if (!webhookUrl)
        return;
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: alert.message, alert }),
        });
    }
    catch { /* ignore */ }
}
class MetricsDB {
    db;
    constructor(dbPath) {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        this.db = new better_sqlite3_1.default(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS conflux_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL, timestamp INTEGER NOT NULL,
        best_epoch TEXT, block_number TEXT, peer_count INTEGER,
        rpc_latency REAL, pending_tx INTEGER, gas_price TEXT,
        cpu_usage REAL, memory_usage REAL, memory_total REAL,
        disk_usage REAL, disk_total REAL
      );
      CREATE INDEX IF NOT EXISTS idx_node_ts ON conflux_metrics(node_id, timestamp);
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY, rule_id TEXT, node_id TEXT,
        metric TEXT, value REAL, threshold REAL, severity TEXT,
        timestamp INTEGER, message TEXT
      );
    `);
    }
    insertMetrics(s, m) {
        this.db.prepare(`INSERT INTO conflux_metrics (node_id,timestamp,best_epoch,block_number,peer_count,rpc_latency,pending_tx,gas_price,cpu_usage,memory_usage,memory_total,disk_usage,disk_total)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(s.nodeId, s.timestamp, s.bestEpoch, s.blockNumber, s.peerCount, s.rpcLatency, s.pendingTxCount, s.gasPrice, m.cpuUsage, m.memoryUsage, m.memoryTotal, m.diskUsage, m.diskTotal);
    }
    insertAlert(e) {
        this.db.prepare(`INSERT OR IGNORE INTO alerts (id,rule_id,node_id,metric,value,threshold,severity,timestamp,message) VALUES (?,?,?,?,?,?,?,?,?)`)
            .run(e.id, e.ruleId, e.nodeId, e.metric, e.value, e.threshold, e.severity, e.timestamp, e.message);
    }
    getMetrics(nodeId, since) {
        return this.db.prepare(`SELECT * FROM conflux_metrics WHERE node_id=? AND timestamp>=? ORDER BY timestamp ASC`).all(nodeId, since);
    }
    getLatestMetrics(nodeId) {
        return this.db.prepare(`SELECT * FROM conflux_metrics WHERE node_id=? ORDER BY timestamp DESC LIMIT 1`).get(nodeId);
    }
    getRecentAlerts(limit = 100) {
        return this.db.prepare(`SELECT * FROM alerts ORDER BY timestamp DESC LIMIT ?`).all(limit);
    }
    exportCSV(nodeId, since) {
        const rows = this.getMetrics(nodeId, since);
        const header = 'timestamp,node_id,best_epoch,block_number,peer_count,rpc_latency,pending_tx,cpu_usage,memory_pct,disk_pct';
        const lines = rows.map(r => {
            const memPct = r.memory_total ? ((r.memory_usage / r.memory_total) * 100).toFixed(2) : '0';
            const diskPct = r.disk_total ? ((r.disk_usage / r.disk_total) * 100).toFixed(2) : '0';
            return `${r.timestamp},${r.node_id},${r.best_epoch},${r.block_number},${r.peer_count},${r.rpc_latency},${r.pending_tx},${r.cpu_usage},${memPct},${diskPct}`;
        });
        return [header, ...lines].join('\n');
    }
}
exports.MetricsDB = MetricsDB;
function loadConfig(configPath) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    if (configPath.endsWith('.json'))
        return JSON.parse(raw);
    return (0, yaml_1.parse)(raw);
}

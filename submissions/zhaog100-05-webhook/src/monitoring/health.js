/**
 * Monitoring - Winston logger and health check system
 */
const winston = require('winston')

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
    return `${timestamp} ${level}: ${message}${metaStr}`
  })
)

function createLogger (level = 'info') {
  return winston.createLogger({
    level,
    format: logFormat,
    transports: [
      new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 5 * 1024 * 1024, maxFiles: 5 }),
      new winston.transports.File({ filename: 'logs/combined.log', maxsize: 10 * 1024 * 1024, maxFiles: 10 })
    ]
  })
}

function addConsoleTransport (logger) {
  logger.add(new winston.transports.Console({ format: consoleFormat }))
  return logger
}

class HealthMonitor {
  constructor (queueManager, eventListener, webhookSender) {
    this.queue = queueManager
    this.listener = eventListener
    this.sender = webhookSender
    this.startTime = Date.now()
  }

  getStatus () {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000)
    const queueStats = this.queue ? this.queue.getStats() : null
    const senderStats = this.sender ? this.sender.getStats() : null

    return {
      status: 'ok',
      uptime,
      uptimeHuman: this._formatUptime(uptime),
      queue: queueStats,
      sender: senderStats,
      timestamp: new Date().toISOString()
    }
  }

  _formatUptime (seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}h ${m}m ${s}s`
  }
}

module.exports = { createLogger, addConsoleTransport, HealthMonitor }

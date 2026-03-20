/**
 * Config Manager - Loads, validates, and hot-reloads configuration
 */
const fs = require('fs')
const path = require('path')
const { EventEmitter } = require('events')

const DEFAULT_CONFIG = {
  network: {
    rpcUrl: process.env.CONFLUX_RPC_URL || 'https://evm.confluxrpc.com',
    chainId: parseInt(process.env.CONFLUX_CHAIN_ID, 10) || 1030,
    startBlock: 0
  },
  subscriptions: [],
  options: {
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS, 10) || 3,
    retryDelay: parseInt(process.env.RETRY_DELAY, 10) || 1000,
    maxConcurrentWebhooks: parseInt(process.env.MAX_CONCURRENT, 10) || 10,
    webhookTimeout: parseInt(process.env.WEBHOOK_TIMEOUT, 10) || 30000,
    pollInterval: parseInt(process.env.POLL_INTERVAL, 10) || 2000,
    batchSize: parseInt(process.env.BATCH_SIZE, 10) || 1000
  },
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || '0.0.0.0'
  }
}

class ConfigManager extends EventEmitter {
  constructor (configPath) {
    super()
    this.configPath = configPath
    this.config = { ...DEFAULT_CONFIG }
    this._watcher = null
  }

  load () {
    if (!this.configPath || !fs.existsSync(this.configPath)) {
      return this.config
    }

    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8')
      const userConfig = JSON.parse(raw)

      // Deep merge
      this.config = this._deepMerge(this.config, userConfig)
      this.validate()
      this.emit('reload', this.config)
      return this.config
    } catch (err) {
      throw new Error(`Config load failed: ${err.message}`)
    }
  }

  validate () {
    const { network, subscriptions, options } = this.config

    if (!network.rpcUrl) throw new Error('network.rpcUrl is required')
    if (typeof network.chainId !== 'number') throw new Error('network.chainId must be a number')

    if (!Array.isArray(subscriptions)) throw new Error('subscriptions must be an array')

    for (const sub of subscriptions) {
      if (!sub.id) throw new Error('Each subscription needs an id')
      if (!sub.contract) throw new Error(`Subscription "${sub.id}" missing contract address`)
      if (!Array.isArray(sub.events) || sub.events.length === 0) {
        throw new Error(`Subscription "${sub.id}" needs at least one event`)
      }
      if (!Array.isArray(sub.webhooks) || sub.webhooks.length === 0) {
        throw new Error(`Subscription "${sub.id}" needs at least one webhook`)
      }
      for (const wh of sub.webhooks) {
        if (!wh.url) throw new Error(`Webhook in "${sub.id}" missing url`)
        if (!['zapier', 'make', 'n8n', 'generic'].includes(wh.format || 'generic')) {
          throw new Error(`Unknown format "${wh.format}" in "${sub.id}"`)
        }
      }
    }

    if (options.retryAttempts < 0) throw new Error('retryAttempts must be >= 0')
    if (options.retryDelay < 0) throw new Error('retryDelay must be >= 0')
    if (options.maxConcurrentWebhooks < 1) throw new Error('maxConcurrentWebhooks must be >= 1')

    return true
  }

  startWatch () {
    if (!this.configPath || this._watcher) return
    this._watcher = fs.watch(this.configPath, (event) => {
      if (event === 'change') {
        try {
          this.load()
        } catch (err) {
          this.emit('error', err)
        }
      }
    })
  }

  stopWatch () {
    if (this._watcher) {
      this._watcher.close()
      this._watcher = null
    }
  }

  _deepMerge (target, source) {
    const result = { ...target }
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(target[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }
    return result
  }
}

module.exports = { ConfigManager, DEFAULT_CONFIG }

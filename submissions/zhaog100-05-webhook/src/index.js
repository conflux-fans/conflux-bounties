/**
 * Conflux Webhook Relay - Main entry point
 */
require('dotenv').config()
const Fastify = require('fastify')
const { ethers } = require('ethers')
const { ConfigManager } = require('./config/manager')
const { EventListener } = require('./listeners/event-listener')
const { WebhookSender } = require('./senders/webhook-sender')
const { TemplateEngine } = require('./templates/engine')
const { QueueManager } = require('./queue/manager')
const { createLogger, addConsoleTransport, HealthMonitor } = require('./monitoring/health')

async function main () {
  const configPath = process.env.CONFIG_FILE || './config/events.json'
  const logLevel = process.env.LOG_LEVEL || 'info'

  // Logger
  const logger = createLogger(logLevel)
  addConsoleTransport(logger)

  logger.info('🚀 Conflux Webhook Relay starting...')

  // Config
  const configManager = new ConfigManager(configPath)
  const config = configManager.load()
  configManager.startWatch()
  logger.info({ subscriptions: config.subscriptions.length }, 'Configuration loaded')

  // Provider
  const provider = new ethers.JsonRpcProvider(config.network.rpcUrl, config.network.chainId, {
    staticNetwork: true
  })
  const providerWrapper = { provider, ethers }

  // Core components
  const eventListener = new EventListener(config, providerWrapper)
  const webhookSender = new WebhookSender(config.options)
  const templateEngine = new TemplateEngine()
  const queueManager = new QueueManager(process.env.DATABASE_URL?.replace('postgresql://', '')).init()
  const healthMonitor = new HealthMonitor(queueManager, eventListener, webhookSender)

  // Event → Queue → Send pipeline
  eventListener.on('event', (event) => {
    logger.info({ subscriptionId: event.subscriptionId, event: event.event, txHash: event.transactionHash }, 'Event detected')

    for (const webhook of config.subscriptions.find(s => s.id === event.subscriptionId)?.webhooks || []) {
      const payload = templateEngine.format(event, webhook.format || 'generic')
      queueManager.enqueue({
        subscriptionId: event.subscriptionId,
        eventName: event.event,
        webhookUrl: webhook.url,
        format: webhook.format || 'generic',
        payload,
        maxAttempts: config.options.retryAttempts,
        headers: webhook.headers,
        secret: webhook.secret
      })
    }
  })

  eventListener.on('error', (err) => {
    logger.error(err, 'Event listener error')
  })

  // Queue processor loop
  async function processQueue () {
    const items = queueManager.getNext(config.options.maxConcurrentWebhooks)
    for (const item of items) {
      queueManager.markProcessing(item.id)
      queueManager.incrementAttempts(item.id)

      const result = await webhookSender.send(
        { url: item.webhook_url, format: item.format },
        JSON.parse(item.payload)
      )

      if (result.success) {
        queueManager.markSucceeded(item.id)
        logger.info({ id: item.id, url: item.webhook_url }, 'Webhook delivered')
      } else {
        queueManager.markFailed(item.id, result.error)
        logger.warn({ id: item.id, url: item.webhook_url, error: result.error }, 'Webhook delivery failed')
      }
    }

    setTimeout(processQueue, 2000)
  }

  // Fastify server
  const fastify = Fastify({ logger: false })

  fastify.get('/health', async () => healthMonitor.getStatus())

  fastify.get('/stats', async () => ({
    queue: queueManager.getStats(),
    sender: webhookSender.getStats(),
    recent: queueManager.getRecent(20)
  }))

  fastify.get('/subscriptions', async () => config.subscriptions.map(s => ({
    id: s.id,
    contract: s.contract,
    events: s.events,
    webhookCount: s.webhooks.length
  })))

  // Start
  await fastify.listen({ port: config.server.port, host: config.server.host })
  logger.info({ port: config.server.port }, 'API server listening')

  // Start event monitoring (polling mode for reliability)
  await eventListener.startPolling()
  logger.info('Event listener started (polling mode)')

  // Start queue processor
  processQueue()
  logger.info('Queue processor started')

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...')
    eventListener.stop()
    queueManager.close()
    await fastify.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

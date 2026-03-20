const { ConfigManager, DEFAULT_CONFIG } = require('../src/config/manager')
const { TemplateEngine, formatters } = require('../src/templates/engine')
const { QueueManager, QUEUE_STATES } = require('../src/queue/manager')

// --- ConfigManager Tests ---
describe('ConfigManager', () => {
  test('should load default config when no file exists', () => {
    const cm = new ConfigManager('/nonexistent/path.json')
    const config = cm.load()
    expect(config.network.rpcUrl).toBe(DEFAULT_CONFIG.network.rpcUrl)
    expect(config.options.retryAttempts).toBe(3)
  })

  test('should load and merge config from file', () => {
    const fs = require('fs')
    const tmpFile = '/tmp/test-config-' + Date.now() + '.json'
    fs.writeFileSync(tmpFile, JSON.stringify({
      network: { rpcUrl: 'https://test.rpc' },
      subscriptions: [{
        id: 'test',
        contract: '0x123',
        events: ['Transfer'],
        webhooks: [{ url: 'https://example.com', format: 'zapier' }]
      }]
    }))

    const cm = new ConfigManager(tmpFile)
    const config = cm.load()
    expect(config.network.rpcUrl).toBe('https://test.rpc')
    expect(config.subscriptions).toHaveLength(1)
    expect(config.options.retryAttempts).toBe(3) // merged from defaults
    fs.unlinkSync(tmpFile)
  })

  test('should validate required fields', () => {
    const cm = new ConfigManager(null)
    expect(() => cm.validate()).toThrow()
  })

  test('should validate subscription structure', () => {
    const cm = new ConfigManager(null)
    cm.config.subscriptions = [{ id: 'bad', contract: '0x123', events: [], webhooks: [] }]
    expect(() => cm.validate()).toThrow('at least one event')
  })

  test('should reject unknown webhook format', () => {
    const cm = new ConfigManager(null)
    cm.config.subscriptions = [{
      id: 'bad', contract: '0x123', events: ['Transfer'],
      webhooks: [{ url: 'https://example.com', format: 'unknown' }]
    }]
    expect(() => cm.validate()).toThrow('Unknown format')
  })

  test('should emit reload on load', (done) => {
    const fs = require('fs')
    const tmpFile = '/tmp/test-config-reload-' + Date.now() + '.json'
    fs.writeFileSync(tmpFile, JSON.stringify({
      network: { rpcUrl: 'https://test.rpc' },
      subscriptions: [{
        id: 'test', contract: '0x123', events: ['Transfer'],
        webhooks: [{ url: 'https://example.com', format: 'generic' }]
      }]
    }))

    const cm = new ConfigManager(tmpFile)
    cm.on('reload', () => done())
    cm.load()
    fs.unlinkSync(tmpFile)
  })

  test('deep merge should work correctly', () => {
    const cm = new ConfigManager(null)
    const result = cm._deepMerge({ a: { b: 1, c: 2 } }, { a: { b: 10 } })
    expect(result.a.b).toBe(10)
    expect(result.a.c).toBe(2)
  })
})

// --- TemplateEngine Tests ---
describe('TemplateEngine', () => {
  const engine = new TemplateEngine()
  const sampleEvent = {
    subscriptionId: 'test-sub',
    event: 'Transfer',
    contract: '0xABC',
    blockNumber: 12345,
    transactionHash: '0xDEAD',
    logIndex: 0,
    timestamp: '2025-01-01T00:00:00Z',
    data: { from: '0x111', to: '0x222', value: '100' }
  }

  test('should format zapier payload', () => {
    const result = engine.format(sampleEvent, 'zapier')
    expect(result.event).toBe('Transfer')
    expect(result.contract).toBe('0xABC')
    expect(result.blockNumber).toBe(12345)
    expect(result.data.from).toBe('0x111')
  })

  test('should format make.com payload', () => {
    const result = engine.format(sampleEvent, 'make')
    expect(result.eventType).toBe('Transfer')
    expect(result.contractAddress).toBe('0xABC')
    expect(result.block.number).toBe(12345)
    expect(result.eventData.from).toBe('0x111')
  })

  test('should format n8n payload with pairedItem', () => {
    const result = engine.format(sampleEvent, 'n8n')
    expect(result.json.event).toBe('Transfer')
    expect(result.pairedItem).toEqual({ item: 0 })
  })

  test('should format generic payload with id', () => {
    const result = engine.format(sampleEvent, 'generic')
    expect(result.id).toContain('0xDEAD')
    expect(result.type).toBe('blockchain.event')
    expect(result.source).toBe('conflux-espace-webhook-relay')
  })

  test('should throw on unknown format', () => {
    expect(() => engine.format(sampleEvent, 'slack')).toThrow('Unknown format')
  })

  test('should list supported formats', () => {
    const formats = engine.getSupportedFormats()
    expect(formats).toContain('zapier')
    expect(formats).toContain('make')
    expect(formats).toContain('n8n')
    expect(formats).toContain('generic')
  })
})

// --- QueueManager Tests ---
describe('QueueManager', () => {
  let queue

  beforeEach(() => {
    queue = new QueueManager('/tmp/test-queue-' + Date.now() + '.db').init()
  })

  afterEach(() => {
    queue.close()
  })

  test('should enqueue and retrieve items', () => {
    const id = queue.enqueue({
      subscriptionId: 'sub1',
      eventName: 'Transfer',
      webhookUrl: 'https://example.com',
      format: 'zapier',
      payload: { test: true }
    })
    expect(id).toBeTruthy()

    const items = queue.getNext()
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe(id)
    expect(items[0].status).toBe('pending')
  })

  test('should mark items as processing', () => {
    const id = queue.enqueue({
      subscriptionId: 'sub1', eventName: 'Transfer',
      webhookUrl: 'https://example.com', format: 'generic', payload: {}
    })
    queue.markProcessing(id)
    const items = queue.getNext()
    expect(items).toHaveLength(0) // processing items not returned
  })

  test('should mark succeeded and track stats', () => {
    const id = queue.enqueue({
      subscriptionId: 'sub1', eventName: 'Transfer',
      webhookUrl: 'https://example.com', format: 'generic', payload: {}
    })
    queue.markProcessing(id)
    queue.markSucceeded(id)

    const stats = queue.getStats()
    expect(stats.succeeded).toBe(1)
  })

  test('should retry failed items up to max attempts', () => {
    const id = queue.enqueue({
      subscriptionId: 'sub1', eventName: 'Transfer',
      webhookUrl: 'https://example.com', format: 'generic',
      payload: {}, maxAttempts: 2
    })

    // First failure
    queue.markProcessing(id)
    queue.incrementAttempts(id)
    queue.markFailed(id, 'timeout')

    // Should be available for retry
    const items = queue.getNext()
    expect(items).toHaveLength(1)

    // Second failure (max reached)
    queue.markProcessing(id)
    queue.incrementAttempts(id)
    queue.markFailed(id, 'timeout')

    // Should NOT be available anymore
    const items2 = queue.getNext()
    expect(items2).toHaveLength(0)

    const stats = queue.getStats()
    expect(stats.failed).toBe(1)
  })

  test('should return recent deliveries', () => {
    queue.enqueue({
      subscriptionId: 'sub1', eventName: 'Transfer',
      webhookUrl: 'https://example.com', format: 'zapier', payload: { a: 1 }
    })
    queue.enqueue({
      subscriptionId: 'sub2', eventName: 'Approval',
      webhookUrl: 'https://other.com', format: 'n8n', payload: { b: 2 }
    })
    const recent = queue.getRecent()
    expect(recent).toHaveLength(2)
  })

  test('should initialize with valid stats', () => {
    const stats = queue.getStats()
    expect(stats.pending).toBe(0)
    expect(stats.succeeded).toBe(0)
    expect(stats.failed).toBe(0)
  })
})

// --- WebhookSender Tests ---
describe('WebhookSender', () => {
  const { WebhookSender } = require('../src/senders/webhook-sender')

  test('should track stats', () => {
    const sender = new WebhookSender({ retryAttempts: 0 })
    const stats = sender.getStats()
    expect(stats.sent).toBe(0)
    expect(stats.succeeded).toBe(0)
    expect(stats.failed).toBe(0)
  })

  test('should reset stats', () => {
    const sender = new WebhookSender()
    sender.resetStats()
    const stats = sender.getStats()
    expect(stats.sent).toBe(0)
  })

  test('should accept constructor options', () => {
    const sender = new WebhookSender({
      retryAttempts: 5,
      retryDelay: 2000,
      webhookTimeout: 60000,
      maxConcurrentWebhooks: 20
    })
    expect(sender.retryAttempts).toBe(5)
    expect(sender.retryDelay).toBe(2000)
    expect(sender.timeout).toBe(60000)
    expect(sender.maxConcurrent).toBe(20)
  })
})

// --- HealthMonitor Tests ---
describe('HealthMonitor', () => {
  const { HealthMonitor } = require('../src/monitoring/health')

  test('should return status with uptime', () => {
    const monitor = new HealthMonitor(null, null, null)
    const status = monitor.getStatus()
    expect(status.status).toBe('ok')
    expect(status.uptime).toBeGreaterThanOrEqual(0)
    expect(status.timestamp).toBeTruthy()
  })

  test('should include queue stats if available', () => {
    const mockQueue = { getStats: () => ({ pending: 5, succeeded: 10 }) }
    const monitor = new HealthMonitor(mockQueue, null, null)
    const status = monitor.getStatus()
    expect(status.queue.pending).toBe(5)
    expect(status.queue.succeeded).toBe(10)
  })
})

// --- QUEUE_STATES Tests ---
describe('QUEUE_STATES', () => {
  test('should have all required states', () => {
    expect(QUEUE_STATES.PENDING).toBe('pending')
    expect(QUEUE_STATES.PROCESSING).toBe('processing')
    expect(QUEUE_STATES.SUCCEEDED).toBe('succeeded')
    expect(QUEUE_STATES.FAILED).toBe('failed')
  })
})

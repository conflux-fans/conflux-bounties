/**
 * Webhook Sender - Delivers webhooks with retry logic and rate limiting
 */
const axios = require('axios')
const Bottleneck = require('bottleneck')

class WebhookSender {
  constructor (options = {}) {
    this.retryAttempts = options.retryAttempts || 3
    this.retryDelay = options.retryDelay || 1000
    this.timeout = options.webhookTimeout || 30000
    this.maxConcurrent = options.maxConcurrentWebhooks || 10

    this.limiter = new Bottleneck({
      maxConcurrent: this.maxConcurrent,
      minTime: 100
    })

    this.stats = {
      sent: 0,
      succeeded: 0,
      failed: 0,
      retried: 0
    }
  }

  async send (webhookConfig, payload) {
    const { url, format, headers, secret } = webhookConfig
    const formattedPayload = payload // Already formatted by template engine

    let lastError = null

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await this.limiter.schedule(() => this._doSend(url, formattedPayload, headers, secret, format))
        this.stats.succeeded++
        this.stats.sent++
        return { success: true, status: result.status, attempt, url }
      } catch (err) {
        lastError = err
        this.stats.retried++

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt) + Math.random() * 500
          await this._sleep(delay)
        }
      }
    }

    this.stats.failed++
    this.stats.sent++
    return { success: false, error: lastError?.message, url, attempts: this.retryAttempts + 1 }
  }

  async _doSend (url, payload, customHeaders, secret, format) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Format': format || 'generic',
      'X-Conflux-Relay': 'true',
      ...(customHeaders || {})
    }

    if (secret) {
      headers['X-Webhook-Signature'] = this._sign(payload, secret)
    }

    const response = await axios.post(url, payload, {
      headers,
      timeout: this.timeout,
      validateStatus: () => true // Accept any status
    })

    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response
  }

  _sign (payload, secret) {
    const crypto = require('crypto')
    return 'sha256=' + crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')
  }

  _sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getStats () {
    return { ...this.stats }
  }

  resetStats () {
    this.stats = { sent: 0, succeeded: 0, failed: 0, retried: 0 }
  }
}

module.exports = { WebhookSender }

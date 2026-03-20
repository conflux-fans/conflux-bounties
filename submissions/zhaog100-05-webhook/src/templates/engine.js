/**
 * Template Engine - Formats event data for different platforms
 */

const formatters = {
  zapier (event) {
    return {
      event: event.event,
      contract: event.contract,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: event.timestamp,
      data: event.data
    }
  },

  make (event) {
    return {
      eventType: event.event,
      contractAddress: event.contract,
      block: {
        number: event.blockNumber,
        timestamp: event.timestamp
      },
      transaction: {
        hash: event.transactionHash
      },
      eventData: event.data
    }
  },

  n8n (event) {
    return {
      json: {
        event: event.event,
        contract: event.contract,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: event.timestamp,
        data: event.data
      },
      pairedItem: { item: 0 }
    }
  },

  generic (event) {
    return {
      id: `wh_${event.transactionHash}_${event.logIndex}`,
      type: 'blockchain.event',
      source: 'conflux-espace-webhook-relay',
      subscriptionId: event.subscriptionId,
      event: event.event,
      contract: event.contract,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: event.timestamp,
      data: event.data
    }
  }
}

class TemplateEngine {
  format (event, format = 'generic') {
    const formatter = formatters[format]
    if (!formatter) {
      throw new Error(`Unknown format: ${format}. Supported: ${Object.keys(formatters).join(', ')}`)
    }
    return formatter(event)
  }

  getSupportedFormats () {
    return Object.keys(formatters)
  }
}

module.exports = { TemplateEngine, formatters }

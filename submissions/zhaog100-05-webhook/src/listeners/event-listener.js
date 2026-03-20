/**
 * Event Listener - Subscribes to eSpace contract events using ethers.js
 */
const { EventEmitter } = require('events')

class EventListener extends EventEmitter {
  constructor (config, provider) {
    super()
    this.config = config
    this.provider = provider
    this.listeners = new Map() // subId => cleanup fn
  }

  async start () {
    const { subscriptions } = this.config

    for (const sub of subscriptions) {
      await this._subscribe(sub)
    }

    this.emit('started', { count: subscriptions.length })
  }

  async _subscribe (sub) {
    const contract = new this.provider.ethers.Contract(
      sub.contract,
      this._buildABI(sub.events),
      this.provider.provider
    )

    for (const eventName of sub.events) {
      const filter = contract.filters[eventName]()

      // If there are indexed filters, apply them
      if (sub.filters) {
        const filterArgs = Object.entries(sub.filters)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, v]) => v)
        contract.removeAllListeners(eventName)
        contract.on(eventName, (...args) => {
          const event = args[args.length - 1] // last arg is the Log
          this._handleEvent(sub, eventName, event, contract.interface)
        })
      } else {
        contract.on(eventName, (...args) => {
          const event = args[args.length - 1]
          this._handleEvent(sub, eventName, event, contract.interface)
        })
      }
    }

    this.listeners.set(sub.id, () => {
      contract.removeAllListeners()
    })
  }

  async startPolling () {
    const { subscriptions, options } = this.config

    for (const sub of subscriptions) {
      this._pollSubscription(sub, options).catch(err => {
        this.emit('error', { subscription: sub.id, error: err.message })
      })
    }
  }

  async _pollSubscription (sub, options) {
    let fromBlock = sub.startBlock || options.pollFromBlock || 0
    const batchSize = options.batchSize || 1000
    const interval = options.pollInterval || 2000

    const contract = new this.provider.ethers.Contract(
      sub.contract,
      this._buildABI(sub.events),
      this.provider.provider
    )

    const poll = async () => {
      try {
        const currentBlock = await this.provider.provider.getBlockNumber()
        const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock)

        if (fromBlock <= toBlock) {
          for (const eventName of sub.events) {
            const filter = contract.filters[eventName]()
            const logs = await contract.queryFilter(filter, fromBlock, toBlock)

            for (const log of logs) {
              const decoded = contract.interface.parseLog({ topics: log.topics, data: log.data })
              this._emitEvent(sub, eventName, log, decoded)
            }
          }
          fromBlock = toBlock + 1
        }
      } catch (err) {
        this.emit('error', { subscription: sub.id, error: err.message })
      }

      await this._sleep(interval)
      this._pollTimeouts[sub.id] = setTimeout(poll, 0)
    }

    poll()
  }

  _handleEvent (sub, eventName, log, iface) {
    let decoded
    try {
      decoded = iface.parseLog({ topics: log.topics, data: log.data })
    } catch {
      decoded = null
    }
    this._emitEvent(sub, eventName, log, decoded)
  }

  _emitEvent (sub, eventName, log, decoded) {
    const data = {
      subscriptionId: sub.id,
      event: eventName,
      contract: sub.contract,
      blockNumber: Number(log.blockNumber),
      transactionHash: log.transactionHash,
      logIndex: log.index,
      timestamp: new Date().toISOString(),
      data: decoded ? this._decodeArgs(decoded.args, decoded.eventFragment) : {},
      raw: log
    }

    // Apply filters
    if (sub.filters && !this._matchesFilters(data.data, sub.filters)) {
      return
    }

    this.emit('event', data)
  }

  _matchesFilters (data, filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (data[key] && data[key].toLowerCase() !== value.toLowerCase()) {
        return false
      }
    }
    return true
  }

  _decodeArgs (args, fragment) {
    const result = {}
    if (fragment && fragment.inputs) {
      for (let i = 0; i < fragment.inputs.length; i++) {
        const name = fragment.inputs[i].name || `arg${i}`
        result[name] = args[i] !== undefined ? String(args[i]) : null
      }
    }
    return result
  }

  _buildABI (eventNames) {
    // Minimal ABI with just the needed events
    return eventNames.map(name => ({
      type: 'event',
      name,
      inputs: [
        { indexed: true, name: 'arg0', type: 'address' },
        { indexed: true, name: 'arg1', type: 'address' },
        { indexed: false, name: 'arg2', type: 'uint256' }
      ]
    }))
  }

  _sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  stop () {
    for (const [, cleanup] of this.listeners) {
      if (typeof cleanup === 'function') cleanup()
    }
    this.listeners.clear()

    if (this._pollTimeouts) {
      for (const tid of Object.values(this._pollTimeouts)) {
        clearTimeout(tid)
      }
    }
    this.emit('stopped')
  }
}

module.exports = { EventListener }

# Bounty #05: Webhook Relay for On-chain Events

## Overview

**Reward**: $1,000

**Difficulty**: 🟢 Small

**Timeline**: 2-3 weeks

**Type**: Infrastructure, Event Monitoring, Webhook System

## Problem Statement

Developers and applications need real-time notifications when specific events occur on Conflux eSpace contracts, but setting up event monitoring infrastructure is complex and time-consuming. There's a need for a simple, configurable service that can listen for blockchain events and relay them to external systems via webhooks.

## Solution Overview

Develop a backend listener service that subscribes to specific eSpace contract events and sends formatted webhook payloads to configurable URLs when events match specified criteria. The service should include templates for popular automation platforms and provide comprehensive configuration options.

## Core Features

### 1. Event Monitoring

- Subscribe to specific contract events on Conflux eSpace
- Real-time event detection and processing
- Support for multiple contracts and event types simultaneously
- Configurable event filtering and matching criteria

### 2. Webhook Delivery

- HTTP POST webhook delivery to configurable URLs
- Retry logic with exponential backoff
- Webhook authentication and security headers
- Delivery confirmation and status tracking

### 3. Automation Platform Templates

- Pre-built templates for Zapier integration
- [Make.com](http://make.com/) (Integromat) webhook format support
- n8n workflow templates and examples
- Generic webhook format for custom integrations

### 4. Configuration Management

- JSON config file for event subscriptions
- Web UI for configuration management (optional)
- Environment variable configuration
- Hot reload of configuration changes

### 5. Monitoring and Logging

- Comprehensive event and delivery logging
- Error tracking and debugging information
- Performance metrics and statistics
- Health check endpoints

## Technical Requirements

### Architecture

- **Backend**: **Node Fastify** listener (optimal for webhook performance)
- **Automation**: **n8n** self-host instance for UI mapping and webhook templates
- **Database**: **Postgres** queue table for reliable delivery
- **Blockchain Integration**: **ethers.js** for event listening
- **Alternative**: Same with **LangChain** webhook tools for transformations (Python)
- **Monitoring**: Structured logging with Winston

### Core Components

1. **Event Listener**: Blockchain event monitoring and filtering
2. **Webhook Sender**: HTTP webhook delivery with retry logic
3. **Config Manager**: Configuration loading and validation
4. **Queue Manager**: Webhook delivery queue and processing
5. **Template Engine**: Automation platform payload formatting
6. **Monitoring System**: Logging, metrics, and health checks

### Event Sources

- Smart contract events via event logs
- Block events and transaction monitoring
- Account balance changes (optional)
- Custom event filtering and aggregation

## Deliverables

### 1. Event Monitoring System

- [ ]  Contract event listener implementation
- [ ]  Real-time event detection and processing
- [ ]  Configurable event filtering and matching
- [ ]  Support for multiple contract monitoring

### 2. Webhook Delivery Engine

- [ ]  HTTP webhook delivery with authentication
- [ ]  Retry logic with exponential backoff
- [ ]  Delivery confirmation and status tracking
- [ ]  Rate limiting and throttling options

### 3. Automation Platform Templates

- [ ]  Zapier webhook format and examples
- [ ]  [Make.com](http://make.com/) integration templates
- [ ]  n8n workflow examples and setup
- [ ]  Generic webhook format documentation

### 4. Configuration System

- [ ]  JSON configuration file format
- [ ]  Environment variable configuration
- [ ]  Configuration validation and error handling
- [ ]  Hot reload capability for config changes

### 5. Monitoring and Operations

- [ ]  Comprehensive logging and error tracking
- [ ]  Performance metrics and statistics
- [ ]  Health check and status endpoints
- [ ]  Docker deployment and scaling support

### 6. Documentation and Testing

- [ ]  Setup and deployment instructions
- [ ]  Configuration guide with examples
- [ ]  Integration tutorials for each platform
- [ ]  Unit and integration tests (80%+ coverage)

## Acceptance Criteria

### Functional Requirements

- ✅ Successfully monitors and detects contract events in real-time
- ✅ Delivers webhooks to configured URLs with proper formatting
- ✅ Implements retry logic for failed webhook deliveries
- ✅ Supports Zapier, [Make.com](http://make.com/), and n8n integration templates
- ✅ Provides configurable event filtering and matching
- ✅ Includes comprehensive logging and monitoring

### Technical Requirements

- ✅ Connects to Conflux eSpace mainnet and testnet
- ✅ Handles multiple contract subscriptions simultaneously
- ✅ Implements proper error handling and recovery
- ✅ Provides health check and monitoring endpoints
- ✅ Docker deployment ready

### Quality Requirements

- ✅ 80% minimum test coverage
- ✅ Clean, documented code with proper error handling
- ✅ Performance optimized for high event volume
- ✅ Comprehensive configuration validation
- ✅ Production-ready logging and monitoring

## Configuration Examples

### JSON Configuration

```json
{
  "network": {
    "rpcUrl": "<https://evm.confluxrpc.com>",
    "chainId": 1030
  },
  "subscriptions": [
    {
      "id": "token-transfers",
      "contract": "0x123...",
      "events": ["Transfer"],
      "filters": {
        "from": "0x456..."
      },
      "webhooks": [
        {
          "url": "<https://hooks.zapier.com/hooks/catch/123/abc>",
          "format": "zapier",
          "headers": {
            "Authorization": "Bearer token123"
          }
        }
      ]
    }
  ],
  "options": {
    "retryAttempts": 3,
    "retryDelay": 1000,
    "maxConcurrentWebhooks": 10
  }
}

```

### Environment Variables

```
CONFLUX_RPC_URL=https://evm.confluxrpc.com
DATABASE_URL=postgresql://localhost/webhook_relay
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
CONFIG_FILE=./config/events.json
WEBHOOK_TIMEOUT=30000

```

## Webhook Payload Examples

### Zapier Format

```json
{
  "event": "Transfer",
  "contract": "0x123...",
  "blockNumber": 12345,
  "transactionHash": "0xabc...",
  "timestamp": "2025-01-01T12:00:00Z",
  "data": {
    "from": "0x456...",
    "to": "0x789...",
    "value": "1000000000000000000"
  }
}

```

### [Make.com](http://make.com/) Format

```json
{
  "eventType": "Transfer",
  "contractAddress": "0x123...",
  "block": {
    "number": 12345,
    "timestamp": "2025-01-01T12:00:00Z"
  },
  "transaction": {
    "hash": "0xabc...",
    "from": "0x456...",
    "to": "0x789..."
  },
  "eventData": {
    "from": "0x456...",
    "to": "0x789...",
    "value": "1000000000000000000"
  }
}

```

### n8n Format

```json
{
  "trigger": "conflux_event",
  "event": {
    "name": "Transfer",
    "signature": "Transfer(address,address,uint256)",
    "contract": "0x123...",
    "blockNumber": 12345,
    "transactionHash": "0xabc...",
    "logIndex": 0,
    "removed": false
  },
  "data": {
    "from": "0x456...",
    "to": "0x789...",
    "value": "1000000000000000000"
  },
  "metadata": {
    "timestamp": "2025-01-01T12:00:00Z",
    "network": "conflux-espace"
  }
}

```

## Integration Examples

### Zapier Setup

1. Create new Zap with "Webhooks by Zapier" trigger
2. Set trigger to "Catch Hook"
3. Configure webhook relay to send to Zapier URL
4. Map event data to desired actions

### [Make.com](http://make.com/) Setup

1. Create new scenario with HTTP "Watch for webhooks"
2. Copy webhook URL to relay configuration
3. Set up data parsing and routing
4. Connect to desired output modules

### n8n Setup

1. Add "Webhook" trigger node to workflow
2. Configure HTTP method and authentication
3. Connect to processing and action nodes
4. Deploy workflow and use URL in relay config

## Technical Specifications

### Database Schema

```sql
-- Event subscriptions
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  event_signature VARCHAR(200) NOT NULL,
  filters JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Webhook endpoints
CREATE TABLE webhooks (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER REFERENCES subscriptions(id),
  url VARCHAR(500) NOT NULL,
  format VARCHAR(50) NOT NULL,
  headers JSONB,
  retry_attempts INTEGER DEFAULT 3,
  timeout INTEGER DEFAULT 30000
);

-- Event delivery log
CREATE TABLE deliveries (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER REFERENCES subscriptions(id),
  webhook_id INTEGER REFERENCES webhooks(id),
  event_data JSONB NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'pending' | 'success' | 'failed'
  attempts INTEGER DEFAULT 0,
  last_attempt TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

```

### Project Structure

```
src/
├── listeners/
│   ├── event-listener.ts     # Main event monitoring
│   ├── contract-monitor.ts   # Contract-specific monitoring
│   └── filter-engine.ts     # Event filtering logic
├── webhooks/
│   ├── sender.ts            # Webhook delivery
│   ├── templates.ts         # Platform-specific formatting
│   └── retry-queue.ts       # Retry logic and queuing
├── config/
│   ├── loader.ts            # Configuration loading
│   ├── validator.ts         # Config validation
│   └── watcher.ts           # Hot reload functionality
├── monitoring/
│   ├── logger.ts            # Structured logging
│   ├── metrics.ts           # Performance metrics
│   └── health.ts            # Health check endpoints
└── templates/
    ├── zapier.json          # Zapier integration template
    ├── make.json            # Make.com template
    └── n8n.json             # n8n workflow template

```

## Bonus Features (Optional)

### Advanced Features

- WebSocket support for real-time notifications
- Event aggregation and batching options
- Custom webhook authentication methods
- Multi-network support (Core Space + eSpace)

### Enhanced Monitoring

- Dashboard for event and delivery monitoring
- Alert system for failed deliveries
- Performance analytics and reporting
- Event replay and debugging tools

### Integration Enhancements

- Additional automation platform templates
- GraphQL webhook support
- Custom payload transformation rules
- Webhook signature verification

## Evaluation Criteria

### Code Quality (25%)

- Clean, maintainable TypeScript/Python code
- Proper error handling and logging
- Comprehensive test coverage
- Performance optimization

### Functionality (35%)

- Reliable event monitoring and detection
- Robust webhook delivery with retry logic
- Effective automation platform integration
- Configuration management quality

### Documentation (25%)

- Clear setup and deployment instructions
- Comprehensive integration guides
- Configuration examples and templates
- API documentation

### Reliability (15%)

- Production-ready error handling
- Proper logging and monitoring
- Health check implementation
- Docker deployment readiness

## Resources

### Conflux Documentation

- [Conflux eSpace Guide](https://doc.confluxnetwork.org/docs/espace/)
- [Event Logs and Filtering](https://doc.confluxnetwork.org/docs/espace/DevelopmentGuide)
- [Conflux RPC Endpoints](https://doc.confluxnetwork.org/docs/espace/network-endpoints)

### Automation Platforms

- [Zapier Webhooks Documentation](https://zapier.com/help/create/code-webhooks/)
- [Make.com Webhooks Guide](https://www.make.com/en/help/modules/http)
- [n8n Webhook Documentation](https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.webhook/)

### Development Tools

- [ethers.js Documentation](https://docs.ethers.org/)
- [Express.js Documentation](https://expressjs.com/)
- [Winston Logging](https://github.com/winstonjs/winston)
- [Redis Documentation](https://redis.io/docs/)

---

**Ready to connect blockchain events to the world?** Comment `/claim` on the GitHub issue to get started!
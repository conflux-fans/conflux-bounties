# Make.com Integration Guide

## Setup

1. Create a new scenario in Make.com
2. Add a **Webhooks** module as the first step
3. Choose **Custom webhook**
4. Name it and copy the webhook URL
5. Add to `events.json`:
```json
{
  "url": "https://hook.make.com/YOUR_WEBHOOK_ID",
  "format": "make"
}
```

## Incoming Payload Format

```json
{
  "eventType": "Transfer",
  "contractAddress": "0x...",
  "block": {
    "number": 12345,
    "timestamp": "2025-01-01T12:00:00Z"
  },
  "transaction": {
    "hash": "0xabc..."
  },
  "eventData": {
    "from": "0x...",
    "to": "0x...",
    "value": "1000000000000000000"
  }
}
```

## Example Scenarios

- **Event → Telegram**: Send on-chain event notifications to a Telegram chat
- **Event → Airtable**: Log events to an Airtable base
- **Event → HTTP**: Forward to custom API endpoints

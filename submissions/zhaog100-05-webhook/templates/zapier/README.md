# Zapier Integration Guide

## Setup

1. Create a new Zap in Zapier
2. Choose **Webhooks by Zapier** as the trigger
3. Select **Catch Hook**
4. Copy the webhook URL
5. Add it to your `events.json`:
```json
{
  "url": "https://hooks.zapier.com/hooks/catch/YOUR_HOOK_ID/",
  "format": "zapier"
}
```

## Incoming Payload

When a Conflux event is detected, Zapier receives:

```json
{
  "event": "Transfer",
  "contract": "0x...",
  "blockNumber": 12345,
  "transactionHash": "0xabc...",
  "timestamp": "2025-01-01T12:00:00Z",
  "data": {
    "from": "0x...",
    "to": "0x...",
    "value": "1000000000000000000"
  }
}
```

## Example Actions

- **Send Email**: Forward event notifications to your inbox
- **Post to Slack**: Notify a channel about on-chain events
- **Update Google Sheets**: Log all transfers to a spreadsheet
- **Call Webhook**: Chain to another service

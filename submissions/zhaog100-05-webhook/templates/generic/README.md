# Generic Webhook Integration

For custom integrations, use the `generic` format (default).

## Payload

```json
{
  "id": "wh_0xabc_0",
  "type": "blockchain.event",
  "source": "conflux-espace-webhook-relay",
  "subscriptionId": "my-sub",
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

## Security Headers

If `secret` is configured, the relay sends:
- `X-Webhook-Signature: sha256=<hmac>`
- `X-Conflux-Relay: true`
- `X-Webhook-Format: generic`

Verify the signature using HMAC-SHA256 with your secret.

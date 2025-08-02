# Zapier Integration Guide

This guide shows you how to integrate the Conflux Webhook Relay System with Zapier to automate workflows based on blockchain events.

## Overview

Zapier is a popular automation platform that connects different apps and services. With the webhook relay system, you can trigger Zapier workflows (called "Zaps") when specific events occur on the Conflux blockchain.

## Setting Up Zapier Integration

### Step 1: Create a Zapier Account

1. Go to [zapier.com](https://zapier.com) and sign up for an account
2. Choose a plan that supports webhooks (available on free plan with limitations)

### Step 2: Create a New Zap

1. Click "Create Zap" in your Zapier dashboard
2. Choose "Webhooks by Zapier" as your trigger app
3. Select "Catch Hook" as the trigger event
4. Click "Continue"

### Step 3: Set Up the Webhook

1. Zapier will provide you with a webhook URL that looks like:
   ```
   https://hooks.zapier.com/hooks/catch/123456/abcdef/
   ```
2. Copy this URL - you'll need it for your webhook relay configuration

### Step 4: Configure Webhook Relay

Add the Zapier webhook to your `config.json`:

```json
{
  "subscriptions": [
    {
      "id": "token-transfers",
      "contractAddress": "0x14b2d3bc65e74dae1030eafd8ac30c533c976a9b",
      "eventSignature": "Transfer(address,address,uint256)",
      "filters": {},
      "webhooks": [
        {
          "id": "zapier-webhook",
          "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
          "format": "zapier",
          "headers": {
            "Content-Type": "application/json"
          },
          "timeout": 30000,
          "retryAttempts": 3
        }
      ]
    }
  ]
}
```

### Step 5: Test the Webhook

1. Restart your webhook relay system to load the new configuration
2. Wait for a blockchain event to occur, or trigger one manually
3. In Zapier, you should see a test request appear
4. Click "Test trigger" to verify the data structure

## Zapier Payload Format

The webhook relay system formats data specifically for Zapier compatibility:

```json
{
  "event_name": "Transfer",
  "contract_address": "0x14b2d3bc65e74dae1030eafd8ac30c533c976a9b",
  "block_number": 12345678,
  "transaction_hash": "0xabc123...",
  "log_index": 0,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "from": "0x1111111111111111111111111111111111111111",
  "to": "0x2222222222222222222222222222222222222222",
  "value": "1000000000000000000",
  "network": "conflux-espace",
  "chain_id": 1030
}
```

Key features of Zapier format:
- Field names use snake_case (Zapier convention)
- Event parameters are flattened to top level
- All values are strings for better compatibility
- Includes metadata like network and chain_id

## Common Use Cases

### 1. Large Token Transfer Alerts

Monitor for large token transfers and send notifications:

**Configuration:**
```json
{
  "subscriptions": [
    {
      "id": "large-transfers",
      "contractAddress": "0x14b2d3bc65e74dae1030eafd8ac30c533c976a9b",
      "eventSignature": "Transfer(address,address,uint256)",
      "filters": {
        "value": {
          "operator": "gt",
          "value": "1000000000000000000000"
        }
      },
      "webhooks": [
        {
          "id": "zapier-large-transfers",
          "url": "https://hooks.zapier.com/hooks/catch/123456/large-transfers/",
          "format": "zapier"
        }
      ]
    }
  ]
}
```

**Zapier Actions:**
- Send email notification
- Post to Slack channel
- Add row to Google Sheets
- Send SMS via Twilio

### 2. NFT Mint Tracking

Track NFT mints and update a database:

**Configuration:**
```json
{
  "subscriptions": [
    {
      "id": "nft-mints",
      "contractAddress": "0x1234567890123456789012345678901234567890",
      "eventSignature": "Transfer(address,address,uint256)",
      "filters": {
        "from": "0x0000000000000000000000000000000000000000"
      },
      "webhooks": [
        {
          "id": "zapier-nft-mints",
          "url": "https://hooks.zapier.com/hooks/catch/123456/nft-mints/",
          "format": "zapier"
        }
      ]
    }
  ]
}
```

**Zapier Actions:**
- Add to Airtable database
- Update Google Sheets
- Post to Discord
- Send webhook to another service

### 3. DeFi Swap Monitoring

Monitor DEX swaps and track trading activity:

**Configuration:**
```json
{
  "subscriptions": [
    {
      "id": "dex-swaps",
      "contractAddress": "0xabcdef1234567890abcdef1234567890abcdef12",
      "eventSignature": "Swap(address,uint256,uint256,uint256,uint256,address)",
      "filters": {},
      "webhooks": [
        {
          "id": "zapier-swaps",
          "url": "https://hooks.zapier.com/hooks/catch/123456/swaps/",
          "format": "zapier"
        }
      ]
    }
  ]
}
```

**Zapier Actions:**
- Log to trading spreadsheet
- Calculate portfolio changes
- Send price alerts
- Update dashboard

## Advanced Configuration

### Multiple Webhooks

You can send the same event to multiple Zapier workflows:

```json
{
  "webhooks": [
    {
      "id": "zapier-alerts",
      "url": "https://hooks.zapier.com/hooks/catch/123456/alerts/",
      "format": "zapier"
    },
    {
      "id": "zapier-logging",
      "url": "https://hooks.zapier.com/hooks/catch/123456/logging/",
      "format": "zapier"
    }
  ]
}
```

### Custom Headers

Add custom headers for identification or authentication:

```json
{
  "webhooks": [
    {
      "id": "zapier-webhook",
      "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
      "format": "zapier",
      "headers": {
        "Content-Type": "application/json",
        "X-Source": "conflux-webhook-relay",
        "X-Environment": "production"
      }
    }
  ]
}
```

### Retry Configuration

Configure retry behavior for failed deliveries:

```json
{
  "webhooks": [
    {
      "id": "zapier-webhook",
      "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
      "format": "zapier",
      "timeout": 30000,
      "retryAttempts": 5
    }
  ]
}
```

## Zapier Workflow Examples

### Example 1: Email Alert for Large Transfers

1. **Trigger**: Webhook (configured above)
2. **Filter**: Only if `value` > 1000000000000000000000
3. **Action**: Send Email
   - To: your-email@example.com
   - Subject: "Large Transfer Detected"
   - Body: "Transfer of {{value}} tokens from {{from}} to {{to}} in transaction {{transaction_hash}}"

### Example 2: Slack Notification for NFT Mints

1. **Trigger**: Webhook (configured above)
2. **Action**: Send Channel Message in Slack
   - Channel: #nft-alerts
   - Message: "🎨 New NFT minted! Token ID: {{to}} | Transaction: {{transaction_hash}}"

### Example 3: Google Sheets Logging

1. **Trigger**: Webhook (configured above)
2. **Action**: Create Spreadsheet Row in Google Sheets
   - Spreadsheet: "Blockchain Events"
   - Row data:
     - Column A: {{timestamp}}
     - Column B: {{event_name}}
     - Column C: {{contract_address}}
     - Column D: {{transaction_hash}}
     - Column E: {{from}}
     - Column F: {{to}}
     - Column G: {{value}}

## Testing and Debugging

### Test Your Webhook

1. Use Zapier's webhook testing tool
2. Send a test payload:
   ```bash
   curl -X POST https://hooks.zapier.com/hooks/catch/123456/abcdef/ \
     -H "Content-Type: application/json" \
     -d '{
       "event_name": "Transfer",
       "contract_address": "0x14b2d3bc65e74dae1030eafd8ac30c533c976a9b",
       "from": "0x1111111111111111111111111111111111111111",
       "to": "0x2222222222222222222222222222222222222222",
       "value": "1000000000000000000"
     }'
   ```

### Debug Failed Webhooks

1. Check Zapier's task history for errors
2. Review webhook relay logs:
   ```bash
   docker-compose logs webhook-relay | grep zapier
   ```
3. Verify webhook URL is correct
4. Check Zapier account limits

### Common Issues

**Webhook not triggering:**
- Verify the webhook URL is correct
- Check if the event matches your filters
- Ensure the webhook relay system is running

**Data not appearing correctly:**
- Check the payload format in Zapier's test data
- Verify field mappings in your Zap
- Review the event signature and parameters

**Rate limiting:**
- Zapier has rate limits on free plans
- Consider upgrading your Zapier plan
- Implement delays in your webhook configuration

## Best Practices

### 1. Use Descriptive Names

```json
{
  "id": "usdt-large-transfers-production",
  "webhooks": [
    {
      "id": "zapier-usdt-alerts-slack"
    }
  ]
}
```

### 2. Implement Proper Filtering

Filter events at the webhook relay level to reduce Zapier task usage:

```json
{
  "filters": {
    "value": {
      "operator": "gt",
      "value": "1000000000000000000"
    }
  }
}
```

### 3. Handle Errors Gracefully

Configure appropriate retry settings:

```json
{
  "webhooks": [
    {
      "timeout": 30000,
      "retryAttempts": 3
    }
  ]
}
```

### 4. Monitor Usage

- Track your Zapier task usage
- Monitor webhook delivery success rates
- Set up alerts for failed deliveries

### 5. Test Thoroughly

- Test with sample data first
- Verify all field mappings
- Test error scenarios
- Monitor for a few days before going live

## Limitations and Considerations

### Zapier Limitations

- **Task limits**: Free plans have monthly task limits
- **Execution time**: Zaps have execution time limits
- **Rate limits**: API calls are rate limited
- **Data retention**: Limited history on free plans

### Webhook Relay Considerations

- **Network reliability**: Ensure stable internet connection
- **Retry logic**: Configure appropriate retry settings
- **Monitoring**: Set up monitoring for failed deliveries
- **Scaling**: Consider multiple webhook endpoints for high volume

## Support and Resources

### Zapier Resources

- [Zapier Webhooks Documentation](https://zapier.com/help/create/code-webhooks/trigger-zaps-from-webhooks)
- [Zapier Community](https://community.zapier.com/)
- [Zapier Status Page](https://status.zapier.com/)

### Webhook Relay Resources

- Check application logs for delivery status
- Use health check endpoints to monitor system status
- Review configuration examples in the repository

### Getting Help

If you encounter issues:

1. Check the troubleshooting guide
2. Review Zapier's webhook documentation
3. Test with curl to isolate issues
4. Check both Zapier and webhook relay logs
5. Create an issue in the repository with detailed information
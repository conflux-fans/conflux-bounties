# Conflux Metadata Registry – SDK

A lightweight TypeScript client for wallets and explorers to fetch contract metadata from the Conflux Metadata Registry. Handles caching out of the box with ETag support.

## Install

```bash
npm install conflux-metadata-sdk
```

Or if you're working in the monorepo, link it directly:

```json
"conflux-metadata-sdk": "file:../sdk"
```

## Usage

```typescript
import { ConfluxMetadataClient } from 'conflux-metadata-sdk';

const client = new ConfluxMetadataClient({
  baseUrl: 'https://api.example.com/v1'
});

// Get the registry record (CID, checksum, version)
const record = await client.getMetadata('0xYourContractAddress');

// Get the full metadata (ABI, description, logo, tags, everything)
const full = await client.getMetadataFull('0xYourContractAddress');
if (full && 'data' in full) {
  console.log(full.data.name, full.data.abi);
  // Save full.etag for caching on the next call
}

// On the next call, pass the saved etag to avoid re-downloading
const cached = await client.getMetadataFull('0xYourContractAddress', {
  etag: savedEtag
});
if (cached?.notModified) {
  // Nothing changed — use your cached copy
}
```

## Caching

The API returns `Cache-Control` (5-minute TTL) and `ETag` headers on metadata endpoints. The SDK makes it easy to take advantage of this:

1. On the first call, `getMetadataFull` returns `{ data, etag }`
2. Store the `etag` value
3. On subsequent calls, pass it as `{ etag: savedEtag }`
4. If nothing changed, the result is `{ notModified: true }` — skip the download and use your cache

This keeps your integration fast and avoids unnecessary bandwidth.

## Without the SDK

You can also call the REST API directly:

- `GET /v1/metadata/:address` — registry record (CID, checksum, version)
- `GET /v1/metadata/:address/full` — full metadata JSON with caching headers

See the [API reference](../docs/api-reference.md) for complete documentation.

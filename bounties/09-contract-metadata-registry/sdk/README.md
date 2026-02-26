# Conflux Metadata Registry – SDK

Lightweight client for wallets and explorers to fetch contract metadata from the Conflux Metadata Registry API.

## Install

```bash
npm install conflux-metadata-sdk
```

Or link from monorepo: `"conflux-metadata-sdk": "file:../sdk"`.

## Usage

```ts
import { ConfluxMetadataClient } from 'conflux-metadata-sdk';

const client = new ConfluxMetadataClient({ baseUrl: 'https://api.example.com/v1' });

// Registry record (CID, checksum, version)
const record = await client.getMetadata('0x...');

// Full metadata (ABI, description, logo, etc.) – for display
const full = await client.getMetadataFull('0x...');
if (full && 'data' in full) {
  console.log(full.data.abi, full.data.description);
} else if (full?.notModified) {
  // Use your cached copy
}
```

## Caching guidance

- The API returns `Cache-Control` (e.g. `public, max-age=300`) and `ETag` on `GET /metadata/:address` and `GET /metadata/:address/full`.
- **Recommendation:** Cache full metadata for at least 5 minutes. Store the `ETag` and send `If-None-Match: <ETag>` on the next request; if the server returns `304 Not Modified`, reuse your cached copy.
- Example with `getMetadataFull`: pass the previous `etag`; if the result is `{ notModified: true }`, keep using your cached copy.

## REST examples

Without the SDK, use:

- `GET /v1/metadata/:address` – record (CID, checksum, version).
- `GET /v1/metadata/:address/full` – full metadata JSON (with cache headers).

See the main repo [API reference](../docs/api-reference.md) for full details.

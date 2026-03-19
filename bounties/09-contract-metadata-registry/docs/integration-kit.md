# Integration Kit

This guide is for wallet developers, explorer teams, and anyone building tools that want to pull metadata from the Conflux Contract Metadata Registry.

You have two options: use the SDK, or hit the REST API directly.

---

## Option 1: Use the SDK

The `sdk/` package gives you a small TypeScript client that handles fetching, error handling, and caching for you.

### Install

```bash
npm install conflux-metadata-sdk
```

Or if you're working within the monorepo:

```json
"conflux-metadata-sdk": "file:../sdk"
```

### Usage

```typescript
import { ConfluxMetadataClient } from 'conflux-metadata-sdk';

const client = new ConfluxMetadataClient({
  baseUrl: 'https://your-api.example.com/v1'
});

// Get the registry record (CID, checksum, version)
const record = await client.getMetadata('0xYourContractAddress');

// Get the full metadata (ABI, description, logo, everything)
const result = await client.getMetadataFull('0xYourContractAddress');
if (result && !('notModified' in result)) {
  console.log(result.data.name, result.data.abi);
  // Save result.etag for next time
}

// On subsequent calls, pass the etag to avoid re-downloading
const cached = await client.getMetadataFull('0xYourContractAddress', {
  etag: savedEtag
});
if (cached && 'notModified' in cached) {
  // Nothing changed — use your cached copy
}
```

See [sdk/README.md](../sdk/README.md) for more details.

---

## Option 2: Use the REST API directly

If you don't want the SDK dependency, the public API is straightforward:

| Endpoint | What you get |
|----------|-------------|
| `GET /v1/metadata/:address` | Registry record — CID, checksum, version, status |
| `GET /v1/metadata/:address/full` | Full metadata JSON — ABI, description, logo, tags, socials, compiler info |
| `GET /v1/metadata/?tag=...&q=...` | Search approved entries by tag or keyword |

See the [API reference](api-reference.md) for request/response details.

---

## Caching strategy

The API sets `Cache-Control` and `ETag` headers on metadata responses, so you don't have to re-download everything on every request:

1. **First request:** Fetch the metadata and store the `ETag` value from the response header.
2. **Subsequent requests:** Include `If-None-Match: <your-saved-ETag>` in the request header.
3. **If nothing changed:** The server responds with `304 Not Modified` — use your cached copy.
4. **If it changed:** You get the full `200` response with a new `ETag`.

The `Cache-Control` header is set to 5 minutes for registry records and 10 minutes (CDN) for full metadata, so you can also rely on standard HTTP caching.

---

## Quick test with curl

```bash
# Fetch the registry record
curl -i "https://your-api.example.com/v1/metadata/0xYourContractAddress"

# Fetch full metadata with conditional caching
curl -i -H 'If-None-Match: "0x...your-checksum..."' \
  "https://your-api.example.com/v1/metadata/0xYourContractAddress/full"
```

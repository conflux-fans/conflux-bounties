# Integration kit

**Lightweight SDK or REST examples for wallets/explorers to consume metadata (with caching guidance).**

---

## SDK

The `sdk/` package provides a small client for fetching registry records and full metadata.

- **Install:** `npm install conflux-metadata-sdk` or link from monorepo: `"conflux-metadata-sdk": "file:../sdk"`.
- **Usage:** See [sdk/README.md](../sdk/README.md).
- **Methods:** `getMetadata(address)` for record (CID, checksum, version); `getMetadataFull(address)` for full JSON with optional `etag` for conditional requests.

---

## REST API

Without the SDK, use the public API:

| Endpoint | Purpose |
| -------- | ------- |
| `GET /v1/metadata/:address` | Registry record (CID, checksum, version). Headers: `Cache-Control`, `ETag`. |
| `GET /v1/metadata/:address/full` | Full metadata JSON (ABI, description, logo, tags, etc.). Headers: `Cache-Control`, `ETag`. |
| `GET /v1/metadata/?tag=...&q=...` | List approved entries; filter by tag or search query. |

Full details: [API reference](api-reference.md).

---

## Caching guidance

- The API sets **Cache-Control** (e.g. `public, max-age=300`, or `s-maxage=600` on full metadata) and **ETag** (checksum).
- **Recommendation:** Cache full metadata for at least 5 minutes. Store the `ETag` and send **If-None-Match: &lt;ETag&gt;** on the next request; if the server returns **304 Not Modified**, reuse your cached copy.
- The SDK’s `getMetadataFull` accepts an optional `etag` and returns `{ notModified: true }` when the response is 304.

---

## Example (curl)

```bash
# Record only
curl -i "https://api.example.com/v1/metadata/0xYourContractAddress"

# Full metadata (with conditional request)
curl -i -H "If-None-Match: \"0x...checksum...\"" \
  "https://api.example.com/v1/metadata/0xYourContractAddress/full"
```

# API Reference

**Base URL:** `http://localhost:3000/v1` (or wherever you deploy the backend).

Everything returns JSON. CORS is enabled. Cache headers are set on public endpoints so consumers can avoid re-fetching unchanged data.

---

## Public metadata

These endpoints don't require authentication — they're meant for wallets, explorers, and anyone who wants to look up contract metadata.

### `GET /metadata`

Lists all approved metadata entries. You can filter by tag or search by name/description.

| Param | Type | Description |
|-------|------|-------------|
| `tag` | string | Filter by tag (exact match, e.g. `?tag=defi`) |
| `q` | string | Search in name and description (case-insensitive) |

**Response** `200` — Array of submission records with `contractAddress`, `cid`, `checksum`, `status`, `version`, `name`, `description`, `tagsJson`, etc.

---

### `GET /metadata/:address`

Returns the **registry record** for a specific contract — the CID, checksum, version, and status. This is the lightweight endpoint you'd use to resolve a CID or verify on-chain proof.

**Response** `200`

```json
{
  "contractAddress": "0x...",
  "version": 1,
  "cid": "Qm...",
  "checksum": "0x...",
  "status": "APPROVED"
}
```

**Response headers:**
- `Cache-Control: public, max-age=300`
- `ETag: "<checksum>"`

Returns `404` if the contract has no approved metadata.

---

### `GET /metadata/:address/full`

Returns the **full metadata payload** fetched from IPFS — ABI, description, logo, tags, compiler info, socials, and everything else. This is what wallets and explorers would call to display rich contract information.

The response merges the registry record fields with the full metadata JSON:

```json
{
  "contractAddress": "0x...",
  "version": 1,
  "cid": "Qm...",
  "checksum": "0x...",
  "name": "My Token",
  "description": "An ERC-20 on Conflux",
  "abi": [...],
  "logoUrl": "ipfs://Qm...",
  "tags": ["token", "erc20"],
  "compiler": { "version": "0.8.26" },
  "socials": { "github": "https://github.com/..." }
}
```

**Response headers:**
- `Cache-Control: public, max-age=300, s-maxage=600`
- `ETag: "<checksum>"`

**Caching tip:** Store the `ETag` value. On subsequent requests, send `If-None-Match: <ETag>` — if nothing has changed, you'll get a `304 Not Modified` and can reuse your cached copy.

**Errors:**
- `404` — no approved metadata for this contract
- `502` — couldn't reach the IPFS gateway

---

## Submissions

These endpoints power the creator submission flow — preparing metadata, finalizing submissions, and moderating them.

### `POST /submissions/prepare`

Validates the metadata against the schema, pins it to IPFS, and returns the CID and checksum. This doesn't create a database record yet — it's a "dry run" that gives you what you need for the on-chain transaction.

**Request body:**

```json
{
  "metadata": {
    "name": "My Token",
    "description": "An ERC-20 on Conflux",
    "abi": [...],
    "bytecodeHash": "0x...",
    "compiler": { "version": "0.8.26", "language": "Solidity" }
  }
}
```

The metadata must conform to the [metadata schema](./metadata-schema.md) and be under 50KB (configurable with `MAX_METADATA_KB`).

**Response** `200`

```json
{
  "cid": "QmSomeCID...",
  "checksum": "0xabc123..."
}
```

Returns `400` on validation errors or if the payload is too large.

---

### `POST /submissions/finalize`

Creates the actual submission record in the database and queues a verification job (bytecode check, ownership check, ConfluxScan). This endpoint is rate-limited per IP and per wallet.

**Duplicate handling:** If a submission with the same `contractAddress` + `cid` already exists, the API returns the existing `submissionId` without creating a duplicate. If you need to force a new record (e.g. for re-verification), pass `forceNew: true`.

**Request body:**

```json
{
  "contractAddress": "0x...",
  "cid": "QmSomeCID...",
  "checksum": "0xabc123...",
  "signature": "0x...",
  "submitter": "0xYourWallet",
  "metadata": { ... },
  "forceNew": false
}
```

**Response** `200`

```json
{
  "success": true,
  "submissionId": "uuid-here"
}
```

**Errors:**
- `400` — validation error or checksum mismatch
- `429` — rate limit exceeded (try again in a minute)

---

### `GET /submissions`

Lists submissions — useful for the admin dashboard or fetching version history for a specific contract.

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status: `PENDING`, `VERIFIED`, `APPROVED`, `REJECTED`, or comma-separated like `PENDING,VERIFIED` |
| `contractAddress` | string | Filter by contract address (returns version history, ordered by version descending) |

**Response** `200` — array of submission records.

---

### `POST /submissions/:id/approve`

Approves a submission. Updates its status to `APPROVED`, assigns a version number, writes to the moderation log, and fires the webhook.

When `MODERATOR_WALLET` is set in the backend config, the request must include a matching `moderatorAddress` — otherwise you'll get a `403`.

**Request body (optional):**

```json
{
  "txHash": "0x...",
  "version": 1,
  "moderatorAddress": "0x..."
}
```

Returns `404` if the submission doesn't exist, `403` if you're not the configured moderator.

---

### `POST /submissions/:id/reject`

Rejects a submission. Same moderator check as approve.

**Request body (optional):**

```json
{
  "reason": "Incomplete ABI",
  "moderatorAddress": "0x..."
}
```

---

## Assets

### `POST /assets/logo`

Uploads a logo image and pins it to IPFS. Send the file as `multipart/form-data`.

Allowed MIME types are configured with `ALLOWED_LOGO_MIME` (defaults to `image/png`, `image/jpeg`, `image/svg+xml`).

**Response** `200`

```json
{
  "cid": "Qm...",
  "url": "ipfs://Qm..."
}
```

Returns `400` if no file is provided or the MIME type isn't allowed.

---

## Environment

See the [README](../README.md) and `backend/.env.example` for the full list of environment variables.

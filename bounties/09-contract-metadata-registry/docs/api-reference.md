# API Reference

Base URL: `http://localhost:3000/v1` (or your deployed backend).

All public endpoints support CORS and return JSON. Cache headers are set where specified.

---

## Public metadata (no auth)

### GET /metadata

List approved metadata entries. Supports search and filter.

**Query**

| Param | Type   | Description                    |
|-------|--------|--------------------------------|
| `tag` | string | Filter by tag (exact match)   |
| `q`   | string | Search in name/description   |

**Response:** `200` – Array of submission records (contractAddress, cid, checksum, status, version, name, description, tagsJson, etc.).

---

### GET /metadata/:address

Get the **registry record** for a contract (CID, checksum, version). Use this for on-chain proof and to resolve the CID.

**Params**

- `address` – Contract address (0x-prefixed, 40 hex chars).

**Response:** `200`

- `contractAddress`, `version`, `cid`, `checksum`, `status`

**Headers**

- `Cache-Control: public, max-age=300`
- `ETag: "<checksum>"`

**Errors:** `404` – Metadata not found.

---

### GET /metadata/:address/full

Get **full metadata JSON** for a contract (resolved from IPFS). Intended for wallets and explorers. Response includes the record fields plus the full metadata payload (ABI, description, logo, tags, etc.).

**Params**

- `address` – Contract address (0x-prefixed).

**Response:** `200`

- `contractAddress`, `version`, `cid`, `checksum`, plus all metadata fields (abi, description, logoUrl, tags, website, socials, compiler, etc.).

**Headers**

- `Cache-Control: public, max-age=300, s-maxage=600`
- `ETag: "<checksum>"`

**Caching guidance (SDK / consumers):** Respect `Cache-Control` and `ETag`. Cache for at least 5 minutes; use conditional requests (`If-None-Match: <ETag>`) to avoid re-downloading unchanged metadata.

**Errors**

- `404` – No approved metadata for this contract.
- `502` – Failed to fetch from IPFS gateway.

---

## Submissions (creator flow)

### POST /submissions/prepare

Validate metadata, pin to IPFS, and compute checksum. Does not create a DB submission.

**Body (JSON)**

- `metadata` – Object conforming to the [metadata schema](./metadata-schema.md) (abi, bytecodeHash, compiler, description, etc.). Size must be &lt; 50KB (configurable via `MAX_METADATA_KB`).

**Response:** `200`

- `cid` – IPFS CID of the pinned metadata.
- `checksum` – Keccak256 of canonical JSON (for on-chain submission).

**Errors:** `400` – Validation error or metadata too large.

---

### POST /submissions/finalize

Create a submission record and enqueue verification (bytecode + ownership + ConfluxScan). Rate limited per IP and per wallet.

**Duplicate detection:** If a submission with the same `contractAddress` and `cid` already exists, the API returns the existing `submissionId` and does not create a duplicate (idempotent). To update metadata, submit with a new CID (new version). Use **manual override** `forceNew: true` to create a new submission record even when the same contract+CID exists (e.g. for re-verification or moderator override).

**Body (JSON)**

- `contractAddress` – Contract address.
- `cid` – CID from `/prepare`.
- `checksum` – Checksum from `/prepare`.
- `signature` – EIP-712 or wallet signature (for verification).
- `submitter` – (Optional) Submitter wallet address (for rate limiting and moderation log).
- `metadata` – Same metadata object as in `/prepare` (for verification job).
- `forceNew` – (Optional) If `true`, create a new submission even when same contract+CID exists (manual override).

**Response:** `200`

- `success: true`, `submissionId`. Optionally `message: 'Already exists'` when duplicate was detected and not overridden.

**Errors**

- `400` – Validation or checksum mismatch.
- `429` – Rate limit exceeded (per IP or per wallet).

---

### GET /submissions

List submissions (for admin/dashboard or version history). Filter by status and/or contract address.

**Query**

- `status` – Single status or comma-separated (e.g. `PENDING`, `PENDING,VERIFIED`).
- `contractAddress` – Filter by contract address (0x-prefixed, 40 hex chars). Returns version history for that contract, ordered by version/createdAt desc.

**Response:** `200` – Array of submission records.

---

### POST /submissions/:id/approve

Approve a submission (moderator). Updates status to `APPROVED`, assigns version, writes moderation log, and triggers webhook.

When `MODERATOR_WALLET` is set (and not zero), the request body must include `moderatorAddress` matching the configured wallet; otherwise returns `403`.

**Body (JSON, optional)**

- `txHash` – On-chain approval tx hash (for moderation log).
- `version` – Override version number (optional).
- `moderatorAddress` – Wallet address of the caller (required when `MODERATOR_WALLET` is configured).

**Response:** `200` – Updated submission.

**Errors:** `404` – Submission not found. `403` – Caller wallet does not match `MODERATOR_WALLET`.

---

### POST /submissions/:id/reject

Reject a submission (moderator). Updates status to `REJECTED` and writes moderation log.

When `MODERATOR_WALLET` is set (and not zero), the request body must include `moderatorAddress` matching the configured wallet; otherwise returns `403`.

**Body (JSON, optional)**

- `reason` – Rejection reason.
- `moderatorAddress` – Wallet address of the caller (required when `MODERATOR_WALLET` is configured).

**Response:** `200` – Updated submission.

**Errors:** `404` – Submission not found. `403` – Caller wallet does not match `MODERATOR_WALLET`.

---

## Assets

### POST /assets/logo

Upload a logo image for use in metadata. File is pinned to IPFS. Allowed MIME types are configured via `ALLOWED_LOGO_MIME` (default: `image/png`, `image/jpeg`, `image/svg+xml`).

**Body:** `multipart/form-data` with a file field.

**Response:** `200`

- `cid` – IPFS CID.
- `url` – `ipfs://<cid>` (use with IPFS gateway for display).

**Errors:** `400` – No file or unsupported MIME type.

---

## Environment

See [README](../README.md) and [.env.example](../backend/.env.example) for required env vars: `DATABASE_URL`, `REDIS_URL`, `CONFLUX_RPC_URL`, `REGISTRY_ADDRESS`, `PINATA_JWT`, `MODERATOR_WALLET`, `WEBHOOK_URL`, `MAX_METADATA_KB`, `ALLOWED_LOGO_MIME`, etc.

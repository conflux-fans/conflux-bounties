# Security, RBAC & Audit

This document describes how access control, rate limiting, and audit logging work across the registry.

---

## On-chain roles

The registry contract uses OpenZeppelin's **AccessControl** alongside **Ownable**. There are three roles:

| Role | Who has it | What they can do |
|------|-----------|-----------------|
| `DEFAULT_ADMIN_ROLE` | The deployer (initially) | Grant and revoke roles |
| `MODERATOR_ROLE` | Designated moderator address | Approve and reject pending metadata |
| `UPGRADER_ROLE` | The deployer (initially) | Authorize contract upgrades |

On top of these roles, each registered contract has its own **owner** — determined by calling `owner()` on the target contract. Only the owner (or an approved delegate) can submit or update metadata for that contract.

Delegates are managed on-chain via `addDelegate` and `removeDelegate`, and they can have an expiry date.

---

## Backend access control

### Moderator checks

The backend's approve/reject endpoints check the `MODERATOR_WALLET` environment variable. When it's set to a real address, the request body must include a `moderatorAddress` that matches — otherwise the endpoint returns `403`.

This is a lightweight guard. For production, you'd want to layer in proper authentication (JWT, API keys, etc.) and map it to the moderator identity.

### Rate limiting

Two layers of rate limiting protect the submission endpoints:

1. **Global rate limit** — `@fastify/rate-limit` caps all requests at 60/minute per IP
2. **Submission-specific limits** — the finalize endpoint tracks requests per IP *and* per wallet address using Redis, capped at `MAX_SUBMISSIONS_PER_WALLET_PER_MIN` (default: 10)

### Audit log

Every approve and reject action is recorded in the `ModerationLog` table:

| Field | What it stores |
|-------|---------------|
| `actor` | The moderator's wallet address |
| `action` | `APPROVE`, `REJECT`, or `OVERRIDE` |
| `target` | The submission ID |
| `details` | Extra context (e.g. the on-chain tx hash for approvals, rejection reason for rejects) |
| `timestamp` | When the action happened |

This gives you a complete trail for compliance and debugging.

---

## Minimal permissions

A few things to keep in mind when running this in production:

- **Contract:** Only `UPGRADER_ROLE` can upgrade the implementation. There are no other admin-level functions beyond standard role management.
- **Database:** Use a least-privilege database user. The backend only needs read/write access to its own tables — no admin permissions.
- **Pinata:** Scope your API token to pin/unpin operations only. Don't reuse tokens that have broader access.
- **Environment variables:** Keep `MODERATOR_WALLET`, `WEBHOOK_URL`, and `PINATA_JWT` restricted to trusted values. Don't commit `.env` files.

---

## Data integrity

- **Checksums:** Metadata JSON is canonicalized (keys sorted alphabetically), then hashed with keccak256. The checksum is stored on-chain alongside the CID, so anyone can verify the metadata hasn't been tampered with.
- **Bytecode verification:** The backend's verification queue compares the `bytecodeHash` in the metadata against the actual runtime bytecode on-chain. If they don't match, the submission is flagged as `FAILED`.
- **ConfluxScan check:** Optionally, the backend also checks the contract's verification status on ConfluxScan.
- **Caching headers:** The public API returns `ETag` and `Cache-Control` headers so consumers can cache safely and validate their cached copies.

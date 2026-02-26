# Security, RBAC & Audit

**Audit log of all actions; admin roles managed via RBAC.** Rate limiting (per wallet + per IP), minimal permissions.

---

## Roles (on-chain)

The registry contract uses OpenZeppelin **AccessControl** and **Ownable**:

| Role | Purpose |
|------|--------|
| `DEFAULT_ADMIN_ROLE` | Grant/revoke roles (e.g. moderator, upgrader). |
| `MODERATOR_ROLE` | Call `approve()` and `reject()` for pending metadata. |
| `UPGRADER_ROLE` | Authorize UUPS upgrades (new implementation). |
| Contract owner (per entry) | `transferOwnership`, `setResolver`, `addDelegate`/`removeDelegate` for that contract. |

Only contract owners (or approved delegates via EIP-712) can submit or update metadata. Only moderators can approve or reject.

---

## Backend RBAC & audit

- **Moderator:** Backend uses `MODERATOR_WALLET` for optional checks; approve/reject endpoints are intended to be protected (e.g. API key or auth middleware) so only moderators can call them. Extend with your own auth (JWT, API key, etc.) and map to moderator identity.
- **Audit log:** Every approve/reject is written to the `ModerationLog` table (actor, action, target, details, timestamp). Use this for compliance and debugging.
- **Rate limiting:** Global per-IP (e.g. 60 req/min via `@fastify/rate-limit`) and per-wallet submission limit (`MAX_SUBMISSIONS_PER_WALLET_PER_MIN`) to prevent abuse.

---

## Minimal permissions

- Registry contract: UUPS upgrade only by `UPGRADER_ROLE`; no arbitrary admin calls beyond role management.
- Backend: No broad DB or Redis admin; use least-privilege DB user and restrict `MODERATOR_WALLET` / webhook URLs to trusted values.
- IPFS: Pinata tokens should be scoped to pin/unpin only; avoid storing other secrets in the same env.

---

## Checksum & integrity

- Metadata JSON is canonicalized (sorted keys), then checksummed (Keccak256) and stored on-chain with the CID.
- Backend verifies bytecode hash against on-chain code and ConfluxScan (optional) before marking submission as VERIFIED.
- Public API returns `ETag` (checksum) and `Cache-Control` so consumers can validate and cache safely.

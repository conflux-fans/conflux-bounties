# Runbook: IPFS re-pin and verify

This runbook covers re-pinning metadata CIDs to IPFS and verifying checksums. Use it when ensuring redundancy or recovering from pin loss.

---

## Prerequisites

- Backend env configured: `DATABASE_URL`, `PINATA_JWT`, `PINATA_GATEWAY` (optional).
- From repo root, backend deps installed (`npm install` in `backend/` or at root with workspaces).

---

## CLI: re-pin by CID

Re-pin a single CID and optionally verify checksum against the database.

```bash
cd backend
npm run repin -- --cid <CID>
# Or: npx ts-node src/scripts/ipfs-repin.ts --cid <CID>
```

- Fetches content from `PINATA_GATEWAY` (or default gateway).
- Computes keccak256 of the response; if it does not match the stored checksum, prints a warning (remediation: fix metadata and resubmit, or update checksum in DB).
- Calls Pinata “pin by hash” for the given CID.
- Upserts `IpfsPin` in the DB (provider `pinata`, status `PINNED` or `FAILED`).

---

## CLI: re-pin by contract address

Re-pin the **latest approved** metadata for a contract:

```bash
npm run repin -- --address <0x...>
```

Re-pin a **specific version** for a contract:

```bash
npm run repin -- --address <0x...> --version <N>
```

The script resolves the CID and checksum from the database, then runs the same verify + re-pin logic as with `--cid`.

---

## Remediation

| Situation | Action |
|----------|--------|
| Checksum mismatch | Fix the metadata (or source of truth), re-upload to IPFS, then update submission/record with new CID and checksum; or correct the stored checksum in DB if the content on IPFS is correct. |
| Pin failed (network / Pinata) | Check `PINATA_JWT`, network, and Pinata dashboard; retry the CLI. |
| CID not in DB | Use `--cid` only when you already have the CID; otherwise use `--address` (and optional `--version`) so the script can look up CID/checksum from the DB. |

---

## Automation

To re-pin all approved CIDs periodically, you can:

1. Query the DB for distinct CIDs with status `APPROVED` (or from `IpfsPin`).
2. For each CID, run the same logic as the script (fetch → verify checksum → pin by hash → update `IpfsPin`).

Integrate this into a cron job or queue worker; keep the same checksum verification and Pinata calls as in `backend/src/scripts/ipfs-repin.ts`.

# Runbook: IPFS Re-pin & Verify

If a CID gets unpinned, a gateway goes down, or you just want to make sure your metadata is still safely pinned, this runbook walks you through re-pinning and verifying checksums.

---

## Before you start

Make sure you have:

- Backend dependencies installed (`npm install` in `backend/` or at the repo root)
- The backend `.env` configured with at least `DATABASE_URL` and `PINATA_JWT`
- Optionally `PINATA_GATEWAY` if you're using a custom gateway

---

## Re-pin a specific CID

If you know the CID you want to re-pin:

```bash
cd backend
npm run repin -- --cid QmYourCIDHere
```

What happens:
1. Fetches the content from the IPFS gateway
2. Computes a keccak256 checksum and compares it to what's stored in the database
3. If the checksum doesn't match, prints a warning (the content may have changed or the stored checksum might be wrong)
4. Re-pins the CID via Pinata
5. Updates the `IpfsPin` record in the database

---

## Re-pin by contract address

If you don't have the CID handy, you can look it up by contract address. This re-pins the **latest approved** version:

```bash
npm run repin -- --address 0xYourContractAddress
```

Or a specific version:

```bash
npm run repin -- --address 0xYourContractAddress --version 2
```

The script finds the matching submission in the database, grabs the CID and checksum, and runs the same verify + re-pin flow.

---

## What to do when things go wrong

| What happened | What to do |
|---------------|-----------|
| **Checksum mismatch** | The content on IPFS doesn't match the stored checksum. Either re-upload the correct metadata and update the submission with a new CID, or — if the IPFS content is actually correct — fix the checksum in the database. |
| **Pin failed** | Check your `PINATA_JWT` is valid, your network is working, and Pinata isn't having issues. Then retry. |
| **CID not in database** | Use `--cid` only when you already know the CID. Use `--address` to let the script look it up from the database. |

---

## Automating re-pins

If you want to periodically verify and re-pin everything:

1. Query the database for all distinct CIDs with status `APPROVED`
2. For each CID, run the same logic: fetch → verify checksum → pin by hash → update `IpfsPin`
3. Set this up as a cron job or integrate it into a queue worker

The core logic is all in `backend/src/scripts/ipfs-repin.ts` — you can import and reuse it.

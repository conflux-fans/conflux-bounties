# Troubleshooting Guide

This guide covers common issues you might encounter when setting up or using the Conflux Contract Metadata Registry, from environment misconfigurations to verification failures.

## 1. Environment & Setup (`env`)

**Symptom**: API endpoints return `500 Internal Server Error`, or the server crashes on startup.
**Cause**: Missing or incorrect environment variables.
**Fix**:
- **`PINATA_JWT`**: Submissions will fail to pin metadata to IPFS if this is missing or invalid. Ensure you copied it correctly from your Pinata dashboard.
- **`CONFLUX_RPC_URL`**: Used by both backend (for bytecode verification) and frontend. If missing, it defaults to public endpoints which may be rate-limited.
- **`MODERATOR_WALLET`**: If set, only this address can approve/reject submissions. Ensure it matches the wallet you connect in the admin dashboard. Set to empty or `0x00...00` to disable this check for local testing.

## 2. Database & Redis (`DB/Redis`)

**Symptom**: `PrismaClientInitializationError: Can't reach database server at localhost:5432`
**Fix**: Ensure your Postgres container is running (`docker compose up -d postgres`). Check that your `DATABASE_URL` matches the Postgres configuration.

**Symptom**: Rate limiting or Verification Queue isn't working / BullMQ throws Redis connection errors.
**Fix**: Ensure Redis is running (`docker compose up -d redis`). The backend defaults to `redis://localhost:6379`. If you changed the port, update the `REDIS_URL` in your `.env`.

**Symptom**: Output says `Table 'Submission' does not exist in the current database.`
**Fix**: You forgot to run migrations. Run `npx prisma migrate dev` in the `backend` folder.

## 3. Rate Limits

**Symptom**: Submission API returns `429 Rate limit exceeded...`
**Cause**: The API limits the number of submissions allowed per minute per IP address and per submitter wallet.
**Fix**:
- Wait a minute for the limit window to reset.
- To change the limit, adjust `MAX_SUBMISSIONS_PER_WALLET_PER_MIN` in your `backend/.env` file. Be aware Fastify also has a global IP rate limit plugin configured in `backend/src/app.ts` (default 60 req/min).

## 4. Validation & Verification

### "Checksum mismatch" on finalize
**Cause**: The metadata payload you sent to `/v1/submissions/finalize` does not match the payload sent to `/prepare`, or the checksum was altered.
**Fix**: The frontend should pass the exact `metadata`, `cid`, and `checksum` returned from the `prepare` step. Do not modify the metadata object between these two calls.

### "Bytecode hash mismatch" in verification logs
**Cause**: The keccak256 hash of the on-chain runtime bytecode does not match the `bytecodeHash` in your submitted metadata.
**Fix**: Ensure you compiled the exact same source code (with the same compiler version and optimizer settings) that was deployed on-chain.

### ConfluxScan Verification Failed
**Cause**: The verification job attempts to check if the contract is verified on ConfluxScan via their API.
**Fix**: 
- Ensure the contract is actually verified on ConfluxScan.
- Check `CONFLUXSCAN_API_KEY` in `backend/.env`. If you exceed their free API limits, the check might fail.

## 5. Wallet Issues

**Symptom**: "Signature mismatch" or verification fails.
**Cause**: The payload signed by the wallet doesn't match the payload the backend expects, or EIP-712 domain separators don't match.
**Fix**: Ensure the `chainId` and `verifyingContract` (the Registry Address) in the frontend's EIP-712 domain match exactly the network you are connected to.

**Symptom**: Wallet prompts for a signature but the user rejects it.
**Fix**: The frontend handles this gracefully, but if testing scripting/automation, ensure the script properly signs the structured data message.

## 6. Frontend–API Connection

**Symptom**: CORS errors in the browser console.
**Fix**: The backend allows `*` in development, but in production, ensure the Fastify CORS configuration only allows your frontend origin.

**Symptom**: Frontend fetching data from `http://localhost:3000` but getting connection refused.
**Fix**: Ensure the backend server is actually running (`npm run dev` in the `backend` folder). Also check `NEXT_PUBLIC_API_URL` in your `frontend/.env.local`. Ensure it's pointing to the correct port.

**Symptom**: Next.js server-side rendering (SSR) fails to load contract pages.
**Fix**: When Next.js runs on the server (e.g., inside Docker), `localhost:3000` might resolve to the frontend container itself instead of the backend container. In Docker, `NEXT_PUBLIC_API_URL` uses the browser-accessible URL (e.g., `http://localhost:3000`), but the Node.js SSR fetch might need a Docker internal hostname (e.g., `http://backend:3000`).

# Replay Protection & Post-Settlement Access Model

## Access Model: Pay-Once, Access-Until-Expiry

After a successful payment, the settled invoice grants the payer repeated access to the paid endpoint for the lifetime of the invoice record. This is a deliberate design choice:

- **One payment** settles one invoice.
- **Subsequent requests** to the same endpoint succeed as long as the caller presents both `x-payment-invoice-id` and `x-payment-payer` headers matching the settled invoice.
- **No call limit** is enforced per invoice. The payer may re-fetch the paid data multiple times.
- **Invoice records persist** in the database indefinitely (they are not deleted after first use).

This model fits the boilerplate's purpose as a reference implementation. Deployments that need stricter models (one-time access, call counting, or time-windowed subscriptions) can modify the x402 middleware to invalidate invoices after first use or track call counts per invoice.

## Replay Protection Layers

### 1. Payer Binding (`x-payment-payer` header)

Every settled invoice records the payer's address. When a client presents a paid invoice ID to access premium data, the server **requires** the `x-payment-payer` header and rejects the request if:

- The header is missing and the invoice has a stored payer → **403**
- The header does not match the stored payer (case-insensitive) → **403**

This prevents a third party who discovers an invoice ID from replaying it without the payer's address.

### 2. Nonce Binding (ARCH-1)

The ERC-3009 authorization nonce is derived deterministically from the invoice ID: `nonce = sha256(invoiceId)`. This binds the signed authorization to a specific invoice — a valid signature for invoice A cannot be replayed against invoice B.

### 3. On-Chain Nonce Uniqueness

The `X402PaymentVerifier` contract enforces nonce uniqueness. Once a nonce is used in a `settle()` call, the contract reverts any subsequent attempt with the same nonce, preventing double-settlement of the same authorization.

### 4. Invoice Expiry

Each invoice has an expiry timestamp (default: 5 minutes from creation). Settlement attempts after expiry return **410 Gone**. A BullMQ background job automatically marks expired invoices in the database.

### 5. Endpoint Scope

Invoices are scoped to a specific endpoint path. A paid invoice for `/data/premium` cannot be used to access `/data/instant` or any other endpoint — the middleware checks `invoice.endpoint === request.path`.

## Header Requirements Summary

| Scenario | Required Headers | Result |
|----------|-----------------|--------|
| First request (no payment) | None | 402 with challenge |
| Re-access after payment | `x-payment-invoice-id` + `x-payment-payer` | 200 (data) |
| Invoice ID without payer header | `x-payment-invoice-id` only | 403 |
| Wrong payer address | `x-payment-invoice-id` + wrong `x-payment-payer` | 403 |
| Invoice for different endpoint | `x-payment-invoice-id` + `x-payment-payer` | 402 (new challenge) |

## Escrow and Refund Timeline

After settlement, funds are held in the smart contract for a configurable escrow period (default: 24 hours, configurable 0s to 30 days per endpoint). During escrow:

- The **seller** can issue a refund via `verifier.refund(onchainInvoiceId)`.
- The **buyer** can submit a dispute, and if approved by an admin, the refund is triggered automatically.
- After escrow expires, anyone can call `verifier.release(onchainInvoiceId)` to transfer funds to the seller.

Once released, the payment is final and cannot be refunded.

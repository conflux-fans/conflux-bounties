# Threat model (short)

## Auth (SIWE)

- **Nonces** are single-use and expire; prevents replay of signed messages.
- **Session cookie** is `httpOnly`, `SameSite=Lax`, and `secure` in production.
- **JWT** is signed with `SESSION_SECRET`; **DB `Session`** row gates revocation and tracks expiry.
- **CSRF**: Login uses JSON `POST` + `SameSite` cookie (not cross-site form POST). For cookie-authenticated `multipart` admin upload, risk is lower for same-site admins; add CSRF tokens if you expose cookie auth to untrusted origins.

## Gating

- **Middleware** only checks cookie presence (Edge). **Real enforcement** is `getSession()` + `checkPathAccess()` on the server.
- **Signed download URLs** use `ASSET_SIGNING_SECRET` (or `SESSION_SECRET`) HMAC; short TTL; binds slug + wallet lowercased.

## Abuse

- **Rate limits** on nonce/login per **IP** and per **wallet** (after address is parsed).
- **AuthFailureLog** stores reasons + JSON `meta`; optional **`ABUSE_WEBHOOK_URL`** POST on failures.

## Storage

- **Admin uploads** are written under `storage/gated/uploads/` with slug validation.
- **Download** resolves paths under `storage/gated` only (normalized, no `..` escape).

## Production checklist

- Strong random `SESSION_SECRET` / `ASSET_SIGNING_SECRET`.
- HTTPS everywhere; set `NEXT_PUBLIC_APP_URL` for correct signed link origin.
- Postgres and Redis credentials; restrict network access.

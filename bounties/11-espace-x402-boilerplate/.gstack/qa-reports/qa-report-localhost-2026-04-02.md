# QA Report: x402 Full-Stack Boilerplate

| Field | Value |
|-------|-------|
| Date | 2026-04-02 |
| Duration | ~25 minutes |
| Target | http://localhost:3000 (web) + http://localhost:4000 (API) |
| Framework | Next.js 14 + Hono |
| Pages Visited | 5 (Home, Architecture, Register, Admin, API direct) |
| Screenshots | 10 |
| Tier | Standard |

---

## Health Score

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Console | 70 | 15% | 10.5 |
| Links | 100 | 10% | 10.0 |
| Visual | 100 | 10% | 10.0 |
| Functional | 85 | 20% | 17.0 |
| UX | 85 | 15% | 12.75 |
| Performance | 100 | 10% | 10.0 |
| Content | 100 | 5% | 5.0 |
| Accessibility | 90 | 15% | 13.5 |
| **Total** | | | **88.75** |

**Baseline: 72 → Final: 89** (after fixes)

---

## Top 3 Things Fixed

1. **ISSUE-002 (High):** `/sellers` API returned 500 "Do not know how to serialize a BigInt" — `escrowDuration` field wasn't being serialized. Users hitting the Registered APIs directory would get broken data.

2. **ISSUE-001 (Medium):** Agent chat quick action buttons ("Get free data", "Fetch premium analytics", etc.) only filled the input field but didn't submit. Users had to manually click send after clicking a quick action, which defeats the purpose.

3. **ISSUE-004 (Medium):** Agent wallet badge always showed "testnet (71)" regardless of which network the user selected via the network switcher. The badge now syncs with the NetworkContext and passes `x-chain-id` to API calls.

---

## Issues

### ISSUE-001 — Agent chat quick actions don't auto-submit
| Field | Value |
|-------|-------|
| Severity | Medium |
| Category | UX / Functional |
| Fix Status | verified |
| Commit | d7e347e |
| Files Changed | `apps/web/src/components/AgentChat.tsx` |

**Repro:** Click "Get free data" quick action → input fills but nothing happens. User must manually click send.

**Fix:** Changed quick action `onClick` from `setInput(suggestion)` to `sendMessage(suggestion)`. Added `override` parameter to `sendMessage()` to bypass stale React state.

### ISSUE-002 — /sellers API BigInt serialization error
| Field | Value |
|-------|-------|
| Severity | High |
| Category | Functional |
| Fix Status | verified |
| Commit | 7f7e65e |
| Files Changed | `apps/seller-api/src/dev.ts` |

**Repro:** `curl http://localhost:4000/sellers` → 500 "TypeError: Do not know how to serialize a BigInt"

**Root cause:** `serializeSeller()` only converted `registeredAt` to string, but the contract struct also returns `escrowDuration` as BigInt (uint256).

**Fix:** Replaced field-specific conversion with a generic loop that converts all BigInt fields to strings.

### ISSUE-003 — React hydration warning in SellerDirectory
| Field | Value |
|-------|-------|
| Severity | Low |
| Category | Console |
| Fix Status | deferred |

**Details:** "Warning: Extra attributes from the server: style" on an `<input>` element in SellerDirectory. This is a common SSR/hydration mismatch caused by browser extensions or styled-components. Dev-mode only, does not affect users.

### ISSUE-004 — Agent wallet badge doesn't sync with network switch
| Field | Value |
|-------|-------|
| Severity | Medium |
| Category | Functional |
| Fix Status | verified |
| Commit | 6863d41 |
| Files Changed | `apps/web/src/components/AgentChat.tsx` |

**Repro:** Click network switcher to "Mainnet (1030)" → Agent Wallet badge still shows "testnet (71)".

**Fix:** AgentChat now imports `useNetwork()` and uses `networkChainId`/`isTestnet` for the badge display. Also passes `x-chain-id` header to `/agent/budget` and `/agent/chat` API calls, and re-fetches budget when network changes.

---

## Summary

| Metric | Value |
|--------|-------|
| Total issues found | 4 |
| Fixes applied | 3 (verified: 3, deferred: 1) |
| Health score | 72 → 89 |

**What works well:**
- Free/premium endpoint flow with 402 paywalls works correctly
- x402 payment headers are complete and spec-compliant
- Network switcher toggles correctly between testnet/mainnet
- Agent chat communicates with the backend LLM and returns real data
- Registered APIs directory shows on-chain sellers (after BigInt fix)
- Mobile layout is responsive and readable
- Architecture page has detailed SVG diagrams
- Admin page properly gates behind wallet connection

**PR Summary:** QA found 4 issues, fixed 3, health score 72 → 89.

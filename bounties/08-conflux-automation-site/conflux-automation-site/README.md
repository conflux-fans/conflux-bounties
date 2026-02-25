# cfxdevkit/cas — Monorepo

Non-custodial limit order and DCA automation on **Conflux eSpace**.

**Live:** https://cas.cfxdevkit.org  
**Bounty:** [#08 — Conflux Automation Site](https://github.com/conflux-fans/conflux-bounties/issues/8)

---

## Packages

| Directory | Package | Description |
|-----------|---------|-------------|
| [`conflux-cas/`](conflux-cas/) | `@conflux-cas/*` | Application monorepo — contracts, backend API, keeper worker, Next.js frontend |
| [`conflux-sdk/`](conflux-sdk/) | `@cfxdevkit/sdk` | Shared SDK — chain clients, automation types, safety guards, wallet utilities |

---

## Quick Start

```bash
# Install all workspace dependencies (run from this directory)
pnpm install

# Start local dev (backend + frontend + worker concurrently)
cd conflux-cas
pnpm dev
```

See [conflux-cas/README.md](conflux-cas/README.md) for full setup instructions, contract deployment, Docker Compose, and environment variables.

---

## Documentation

| File | Description |
|------|-------------|
| [conflux-cas/README.md](conflux-cas/README.md) | Getting started, deployment, environment variables |
| [conflux-cas/docs/ARCHITECTURE.md](conflux-cas/docs/ARCHITECTURE.md) | System diagram, layer reference, API routes, DB schema |
| [conflux-cas/docs/USER_MANUAL.md](conflux-cas/docs/USER_MANUAL.md) | End-user guide — wallet setup, strategies, dashboard, safety |
| [conflux-sdk/README.md](conflux-sdk/README.md) | SDK installation and module overview |
| [conflux-sdk/CHANGELOG.md](conflux-sdk/CHANGELOG.md) | SDK version history |

---

## Deployed Contracts

### Conflux eSpace Mainnet (chain ID 1030)

| Contract | Address |
|----------|---------|
| `AutomationManager` | `0x9D5B131e5bA37A238cd1C485E2D9d7c2A68E1d0F` |
| `SwappiPriceAdapter` | `0xD2Cc2a7Eb4A5792cE6383CcD0f789C1A9c48ECf9` |
| `PermitHandler` | `0x0D566aC9Dd1e20Fc63990bEEf6e8abBA876c896B` |

Verified on Sourcify: [AutomationManager](https://repo.sourcify.dev/contracts/full_match/1030/0x9D5B131e5bA37A238cd1C485E2D9d7c2A68E1d0F/) · [SwappiPriceAdapter](https://repo.sourcify.dev/contracts/full_match/1030/0xD2Cc2a7Eb4A5792cE6383CcD0f789C1A9c48ECf9/)

---

## Test Summary

| Package | Tests | Notes |
|---------|-------|-------|
| Solidity contracts | 57 ✅ | >90% line coverage |
| `@conflux-cas/worker` | 40 ✅ | 94% statement coverage |
| `@cfxdevkit/sdk` | 85 ✅ | Automation module fully covered |
| `@conflux-cas/backend` | 16 ✅ | Integration tests against live SQLite |
| **Total** | **198** | All passing |

---

## License

MIT

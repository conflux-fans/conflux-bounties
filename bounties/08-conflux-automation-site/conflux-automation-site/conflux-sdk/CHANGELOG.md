# Changelog

All notable changes to `@cfxdevkit/sdk` will be documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.1.0] - 2026-02-19

### Added
- Initial SDK extraction from `conflux-devkit` monorepo
- `clients`: `ClientManager`, `CoreClient`, `EspaceClient` (+ wallet/test variants)
- `config`: Chain definitions for Conflux Core Space and eSpace (local/testnet/mainnet)
- `types`: `ChainType`, `UnifiedAccount`, `Address`, `ChainConfig` and all client interfaces
- `utils`: Simple structured logger
- `wallet/derivation`: BIP32/BIP39 HD wallet derivation for both Core and eSpace addresses
- `wallet/session-keys`: `SessionKeyManager` – temporary delegated signing
- `wallet/batching`: `TransactionBatcher` – multi-tx execution
- `wallet/embedded`: `EmbeddedWalletManager` – server-side custody
- `contracts/abis`: ERC-20, ERC-721, ERC-1155 ABIs
- `contracts/deployer`: `ContractDeployer` – deploy to Core or eSpace
- `contracts/interaction`: `ContractReader`, `ContractWriter`
- `services/swap`: `SwapService` – Swappi DEX integration (Uniswap V2)
- `services/keystore`: `KeystoreService` – encrypted HD wallet storage (AES-256-GCM + PBKDF2)
- `services/encryption`: `EncryptionService` – AES-256-GCM crypto primitives

### Changed (from conflux-devkit)
- Removed DevKit backend coupling from all services; services are now standalone classes
- Removed Solidity compiler wrapper (`solc` dependency)
- Removed `ui-headless` hooks (were DevKit-API coupled, not wagmi-native)
- Removed DevNode plugin, CLI binary, MCP server, WebSocket streaming server
- Fixed `@scure/bip39/wordlists/english` import to use `.js` extension for ESM compatibility
- Keystore backwards-compatibility block removed (DevKit-specific legacy)
- `moduleResolution` switched from `node` to `bundler` for correct ESM subpath resolution

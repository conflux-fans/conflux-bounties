# Metadata schema

Metadata is stored as JSON on IPFS and referenced by CID in the registry. The backend validates payloads with Zod and enforces a maximum size (default **50KB** via `MAX_METADATA_KB`).

---

## Required fields

| Field          | Type   | Description |
|----------------|--------|-------------|
| `description`  | string | 1–2000 chars. |
| `abi`          | array  | ABI entries (each with `type`, optional `name`, `inputs`, `outputs`, `stateMutability`). |
| `bytecodeHash` | string | Keccak256 of runtime bytecode, `0x` + 64 hex chars. Must match on-chain code for verification. |
| `compiler`     | object | See [Compiler](#compiler) below. |

---

## Optional fields

| Field     | Type   | Description |
|-----------|--------|-------------|
| `name`    | string | 1–200 chars. |
| `logo`    | string | URL (IPFS or HTTPS) of logo image. |
| `logoUrl` | string | Alias for `logo`. |
| `website` | string | HTTPS URL. |
| `tags`    | string[] | Max 16 tags, each 1–32 chars. |
| `sources` | array  | Source references (name, optional `ipfsCid`, optional `url`). |
| `socials` | object | See [Social links](#social-links) below. |

---

## Compiler

```json
{
  "version": "0.8.26",
  "optimizerRuns": 200,
  "language": "Solidity"
}
```

- `version` (required): Compiler version string.
- `optimizerRuns` (optional): Optimizer runs.
- `language` (optional): Default `"Solidity"`.

---

## Social links

Optional; all values must be valid URLs.

```json
{
  "twitter": "https://twitter.com/...",
  "discord": "https://discord.gg/...",
  "github": "https://github.com/...",
  "telegram": "https://t.me/..."
}
```

---

## Validation rules

- **Size:** Canonical JSON (sorted keys) must be &lt; 50KB by default. Configurable via `MAX_METADATA_KB`.
- **Logo upload:** Allowed MIME types for `/assets/logo` are set by `ALLOWED_LOGO_MIME` (default: `image/png`, `image/jpeg`, `image/svg+xml`).
- **Strict:** Unknown top-level fields are rejected.

---

## Example

```json
{
  "name": "My Token",
  "description": "An example ERC-20 on Conflux.",
  "logoUrl": "ipfs://Qm...",
  "website": "https://example.com",
  "tags": ["token", "erc20"],
  "abi": [
    { "type": "function", "name": "balanceOf", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "type": "uint256" }] }
  ],
  "bytecodeHash": "0x1234567890abcdef...",
  "compiler": { "version": "0.8.26", "optimizerRuns": 200, "language": "Solidity" },
  "socials": { "github": "https://github.com/example" }
}
```

---

## Shared package

The `@conflux-metadata/shared` package exports `MetadataSchema` (Zod) and `DEFAULT_MAX_METADATA_BYTES` for use in frontend or other services. See `shared/src/index.ts`.

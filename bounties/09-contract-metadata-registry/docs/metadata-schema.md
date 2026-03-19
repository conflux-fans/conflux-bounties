# Metadata Schema

Every piece of metadata in the registry follows the same JSON schema. It's validated with [Zod](https://zod.dev/) on both the backend and frontend (via the shared `@conflux-metadata/shared` package), and it has to fit under **50KB** when serialized with sorted keys.

---

## Required fields

These are the fields you must include in every submission:

| Field | Type | What it is |
|-------|------|-----------|
| `description` | string | A short description of the contract or project (1–2000 characters) |
| `abi` | array | The contract's ABI — each entry has `type`, and optionally `name`, `inputs`, `outputs`, `stateMutability` |
| `bytecodeHash` | string | Keccak256 hash of the deployed runtime bytecode (`0x` + 64 hex chars). The backend compares this against what's actually on-chain |
| `compiler` | object | Compiler details — see below |

## Optional fields

| Field | Type | What it is |
|-------|------|-----------|
| `name` | string | Project or contract name (1–200 characters) |
| `logo` | string | URL pointing to a logo image (IPFS or HTTPS) |
| `logoUrl` | string | Same as `logo` — either field works |
| `website` | string | Project website URL |
| `tags` | string[] | Up to 16 tags, each 1–32 characters (e.g. `["defi", "lending"]`) |
| `sources` | array | Source code references — each has a `name`, and optionally `ipfsCid` or `url` |
| `socials` | object | Social media links — see below |

---

## Compiler

```json
{
  "version": "0.8.26",
  "optimizerRuns": 200,
  "language": "Solidity"
}
```

- `version` is required — the compiler version string
- `optimizerRuns` is optional — number of optimizer runs
- `language` defaults to `"Solidity"` if not specified

---

## Social links

All fields are optional, but if provided they must be valid URLs:

```json
{
  "twitter": "https://twitter.com/yourproject",
  "discord": "https://discord.gg/yourserver",
  "github": "https://github.com/yourorg",
  "telegram": "https://t.me/yourchannel"
}
```

No additional keys are allowed (the schema uses strict mode).

---

## Validation rules

- **Size limit:** The canonical JSON (keys sorted alphabetically) must be under 50KB. You can change this with the `MAX_METADATA_KB` environment variable.
- **Logo uploads:** When uploading through `/assets/logo`, only certain MIME types are accepted (configurable via `ALLOWED_LOGO_MIME`, defaults to PNG, JPEG, and SVG).
- **Strict mode:** Any unrecognized top-level fields will cause validation to fail.

---

## Full example

```json
{
  "name": "My Token",
  "description": "An example ERC-20 token deployed on Conflux eSpace.",
  "logoUrl": "ipfs://QmYourLogoCID",
  "website": "https://example.com",
  "tags": ["token", "erc20"],
  "abi": [
    {
      "type": "function",
      "name": "balanceOf",
      "inputs": [{ "name": "account", "type": "address" }],
      "outputs": [{ "type": "uint256" }]
    }
  ],
  "bytecodeHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "compiler": {
    "version": "0.8.26",
    "optimizerRuns": 200,
    "language": "Solidity"
  },
  "socials": {
    "github": "https://github.com/example/mytoken"
  }
}
```

---

## Using the shared package

The Zod schema and constants are exported from `@conflux-metadata/shared`:

```typescript
import { MetadataSchema, DEFAULT_MAX_METADATA_BYTES } from '@conflux-metadata/shared';

// Validate some metadata
const result = MetadataSchema.safeParse(yourMetadataObject);

// Check the 50KB limit
if (JSON.stringify(yourMetadata).length > DEFAULT_MAX_METADATA_BYTES) {
  throw new Error('Metadata too large');
}
```

See `shared/src/index.ts` for the full schema definition.

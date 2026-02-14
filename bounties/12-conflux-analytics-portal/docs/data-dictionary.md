# Data Dictionary

## Raw Tables

### sync_state
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Always 1 (singleton) |
| last_block | BIGINT | Last successfully ingested block number |
| last_block_hash | TEXT | Hash of the last ingested block |
| updated_at | TIMESTAMPTZ | Timestamp of last update |

### blocks
| Column | Type | Description |
|--------|------|-------------|
| number | BIGINT (PK) | Block number |
| hash | TEXT (UNIQUE) | Block hash |
| parent_hash | TEXT | Parent block hash (for reorg detection) |
| timestamp | BIGINT | Unix timestamp |
| gas_used | NUMERIC | Total gas used in block |
| gas_limit | NUMERIC | Block gas limit |
| base_fee_per_gas | NUMERIC | EIP-1559 base fee (nullable) |
| tx_count | INTEGER | Number of transactions |
| miner | TEXT | Miner/validator address |

### transactions
| Column | Type | Description |
|--------|------|-------------|
| hash | TEXT (PK) | Transaction hash |
| block_number | BIGINT (FK → blocks) | Block number (CASCADE delete) |
| from | TEXT | Sender address |
| to | TEXT | Recipient address (null for contract creation) |
| value | NUMERIC | Value transferred in wei |
| gas_used | NUMERIC | Gas consumed |
| gas_price | NUMERIC | Effective gas price |
| max_fee_per_gas | NUMERIC | EIP-1559 max fee (nullable) |
| max_priority_fee_per_gas | NUMERIC | EIP-1559 priority fee (nullable) |
| status | TEXT | 'success' or 'failure' |
| timestamp | BIGINT | Unix timestamp |
| input | TEXT | Calldata hex |

## Token Tables

### tokens
| Column | Type | Description |
|--------|------|-------------|
| address | TEXT (PK) | Token contract address |
| name | TEXT | Token name |
| symbol | TEXT | Token symbol |
| decimals | INTEGER | Decimal places |
| total_supply | NUMERIC | Total supply (nullable) |

### token_transfers
| Column | Type | Description |
|--------|------|-------------|
| tx_hash | TEXT | Transaction hash |
| log_index | INTEGER | Log index within tx |
| token_address | TEXT | Token contract address |
| from | TEXT | Sender |
| to | TEXT | Receiver |
| value | NUMERIC | Amount transferred |
| block_number | BIGINT | Block number |
| timestamp | BIGINT | Unix timestamp |

UNIQUE constraint: (tx_hash, log_index)

### token_holders
| Column | Type | Description |
|--------|------|-------------|
| token_address | TEXT (PK) | Token contract |
| holder_address | TEXT (PK) | Holder address |
| balance | NUMERIC | Materialized balance |
| last_updated | BIGINT | Last update timestamp |

## Aggregate Tables

### daily_activity
| Column | Type | Description |
|--------|------|-------------|
| date | DATE (PK) | Calendar date |
| tx_count | INTEGER | Total transactions |
| active_accounts | INTEGER | Unique sender addresses |
| new_contracts | INTEGER | Contract creations (to=NULL) |
| total_gas_used | NUMERIC | Sum of gas_used |

### daily_fees
| Column | Type | Description |
|--------|------|-------------|
| date | DATE (PK) | Calendar date |
| avg_gas_price | NUMERIC | Average gas price |
| total_burned | NUMERIC | base_fee * gas_used |
| total_tips | NUMERIC | priority_fee * gas_used |
| tx_count | INTEGER | Transaction count |

### contract_daily_stats
| Column | Type | Description |
|--------|------|-------------|
| contract_address | TEXT (PK) | Contract address |
| date | DATE (PK) | Calendar date |
| tx_count | INTEGER | Calls to contract |
| unique_callers | INTEGER | Distinct senders |
| gas_used | NUMERIC | Total gas consumed |

### token_daily_stats
| Column | Type | Description |
|--------|------|-------------|
| token_address | TEXT (PK) | Token contract |
| date | DATE (PK) | Calendar date |
| transfer_count | INTEGER | Number of transfers |
| unique_senders | INTEGER | Distinct senders |
| unique_receivers | INTEGER | Distinct receivers |
| volume | NUMERIC | Total transfer volume |

### dapp_tags
| Column | Type | Description |
|--------|------|-------------|
| contract_address | TEXT (PK) | Contract address |
| dapp_name | TEXT | Human-readable DApp name |
| category | TEXT | Category (DeFi, NFT, etc.) |
| logo_url | TEXT | Logo URL (nullable) |

## API Tables

### api_keys
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Key ID |
| key | TEXT (UNIQUE) | API key string |
| name | TEXT | Key label |
| rate_limit | INTEGER | Per-minute limit |
| created_at | TIMESTAMPTZ | Creation time |

### shared_views
| Column | Type | Description |
|--------|------|-------------|
| slug | TEXT (PK) | URL slug |
| config | JSONB | Dashboard config |
| created_at | TIMESTAMPTZ | Creation time |
| expires_at | TIMESTAMPTZ | Expiration (nullable) |

### webhook_subscriptions
| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Subscription ID |
| url | TEXT | Webhook URL |
| event_type | TEXT | Event type |
| active | BOOLEAN | Active flag |
| created_at | TIMESTAMPTZ | Creation time |

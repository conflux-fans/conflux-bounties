import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generate seed.sql with 30 days of realistic aggregate data,
 * 100 raw blocks, 10 tokens, 5 DApps, and a demo API key.
 * Then apply it to the database.
 */
async function main() {
  const lines: string[] = [];

  const now = Date.now();
  const DAY_MS = 86_400_000;

  /** Demo API key */
  const apiKey = crypto.randomBytes(32).toString('hex');
  lines.push(
    `INSERT INTO api_keys (key, name, rate_limit) VALUES ('${apiKey}', 'demo', 100) ON CONFLICT (key) DO NOTHING;`,
  );
  console.log(`[seed] Demo API key: ${apiKey}`);

  /** DApp tags from JSON */
  const dappTagsPath = path.resolve(__dirname, '..', 'db', 'seed', 'dapp-tags.json');
  const dappTags = JSON.parse(fs.readFileSync(dappTagsPath, 'utf-8')) as Array<{
    contractAddress: string;
    dappName: string;
    category: string;
    logoUrl: string | null;
  }>;

  for (const tag of dappTags) {
    lines.push(
      `INSERT INTO dapp_tags (contract_address, dapp_name, category, logo_url) VALUES ('${tag.contractAddress}', '${tag.dappName}', '${tag.category}', ${tag.logoUrl ? `'${tag.logoUrl}'` : 'NULL'}) ON CONFLICT (contract_address) DO NOTHING;`,
    );
  }

  /** 10 tokens */
  const tokenNames = ['Wrapped CFX', 'USDT', 'USDC', 'ConfiToken', 'SwappiLP', 'NucleonCFX', 'GoledoGOL', 'BridgeToken', 'FluxUSD', 'StarCFX'];
  for (let i = 0; i < 10; i++) {
    const addr = `0x${(i + 1).toString(16).padStart(40, '0')}`;
    lines.push(
      `INSERT INTO tokens (address, name, symbol, decimals, total_supply) VALUES ('${addr}', '${tokenNames[i]}', '${tokenNames[i].slice(0, 4).toUpperCase()}', 18, '1000000000000000000000000') ON CONFLICT (address) DO NOTHING;`,
    );
  }

  /** 100 blocks + transactions */
  const baseBlock = 80_000_000;
  for (let i = 0; i < 100; i++) {
    const blockNum = baseBlock + i;
    const timestamp = Math.floor((now - (100 - i) * 1000) / 1000);
    const hash = `0x${crypto.randomBytes(32).toString('hex')}`;
    const parentHash = i === 0 ? `0x${'0'.repeat(64)}` : `0x${crypto.randomBytes(32).toString('hex')}`;
    const txCount = Math.floor(Math.random() * 20) + 1;
    const gasUsed = Math.floor(Math.random() * 5_000_000) + 1_000_000;
    const miner = `0x${crypto.randomBytes(20).toString('hex')}`;

    lines.push(
      `INSERT INTO blocks (number, hash, parent_hash, timestamp, gas_used, gas_limit, base_fee_per_gas, tx_count, miner) VALUES (${blockNum}, '${hash}', '${parentHash}', ${timestamp}, ${gasUsed}, 30000000, 1000000000, ${txCount}, '${miner}') ON CONFLICT (number) DO NOTHING;`,
    );

    for (let j = 0; j < Math.min(txCount, 3); j++) {
      const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
      const from = `0x${crypto.randomBytes(20).toString('hex')}`;
      const to = `0x${crypto.randomBytes(20).toString('hex')}`;
      const status = Math.random() > 0.05 ? 'success' : 'failure';
      const gasPrice = 1_000_000_000 + Math.floor(Math.random() * 500_000_000);

      lines.push(
        `INSERT INTO transactions (hash, block_number, "from", "to", value, gas_used, gas_price, status, timestamp, input) VALUES ('${txHash}', ${blockNum}, '${from}', '${to}', '0', ${Math.floor(gasUsed / txCount)}, ${gasPrice}, '${status}', ${timestamp}, '0x') ON CONFLICT (hash) DO NOTHING;`,
      );
    }
  }

  /** 30 days of daily_activity */
  for (let d = 29; d >= 0; d--) {
    const date = new Date(now - d * DAY_MS).toISOString().slice(0, 10);
    const txCount = Math.floor(Math.random() * 50_000) + 10_000;
    const activeAccounts = Math.floor(Math.random() * 5_000) + 1_000;
    const newContracts = Math.floor(Math.random() * 50) + 5;
    const totalGasUsed = BigInt(txCount) * 100_000n;
    lines.push(
      `INSERT INTO daily_activity (date, tx_count, active_accounts, new_contracts, total_gas_used) VALUES ('${date}', ${txCount}, ${activeAccounts}, ${newContracts}, ${totalGasUsed}) ON CONFLICT (date) DO NOTHING;`,
    );
  }

  /** 30 days of daily_fees */
  for (let d = 29; d >= 0; d--) {
    const date = new Date(now - d * DAY_MS).toISOString().slice(0, 10);
    const avgGas = 1_000_000_000 + Math.floor(Math.random() * 2_000_000_000);
    const burned = BigInt(Math.floor(Math.random() * 1e15));
    const tips = BigInt(Math.floor(Math.random() * 5e14));
    const txCount = Math.floor(Math.random() * 50_000) + 10_000;
    lines.push(
      `INSERT INTO daily_fees (date, avg_gas_price, total_burned, total_tips, tx_count) VALUES ('${date}', ${avgGas}, ${burned}, ${tips}, ${txCount}) ON CONFLICT (date) DO NOTHING;`,
    );
  }

  /** Contract daily stats for DApp contracts */
  for (const tag of dappTags) {
    for (let d = 29; d >= 0; d--) {
      const date = new Date(now - d * DAY_MS).toISOString().slice(0, 10);
      const txCount = Math.floor(Math.random() * 5_000) + 100;
      const callers = Math.floor(Math.random() * 500) + 50;
      const gasUsed = BigInt(txCount) * 50_000n;
      lines.push(
        `INSERT INTO contract_daily_stats (contract_address, date, tx_count, unique_callers, gas_used) VALUES ('${tag.contractAddress}', '${date}', ${txCount}, ${callers}, ${gasUsed}) ON CONFLICT (contract_address, date) DO NOTHING;`,
      );
    }
  }

  /** Token daily stats */
  for (let i = 0; i < 10; i++) {
    const addr = `0x${(i + 1).toString(16).padStart(40, '0')}`;
    for (let d = 29; d >= 0; d--) {
      const date = new Date(now - d * DAY_MS).toISOString().slice(0, 10);
      const transfers = Math.floor(Math.random() * 1_000) + 50;
      const senders = Math.floor(Math.random() * 200) + 20;
      const receivers = Math.floor(Math.random() * 200) + 20;
      const volume = BigInt(transfers) * BigInt(1e18);
      lines.push(
        `INSERT INTO token_daily_stats (token_address, date, transfer_count, unique_senders, unique_receivers, volume) VALUES ('${addr}', '${date}', ${transfers}, ${senders}, ${receivers}, ${volume}) ON CONFLICT (token_address, date) DO NOTHING;`,
      );
    }
  }

  /** Sync state checkpoint */
  lines.push(
    `UPDATE sync_state SET last_block = ${baseBlock + 99}, last_block_hash = '0x${'a'.repeat(64)}', updated_at = NOW() WHERE id = 1;`,
  );

  /** Write seed.sql */
  const seedPath = path.resolve(__dirname, '..', 'db', 'seed', 'seed.sql');
  fs.writeFileSync(seedPath, lines.join('\n') + '\n');
  console.log(`[seed] Wrote ${lines.length} statements to ${seedPath}`);

  /** Apply to database */
  const pool = new Pool({
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'conflux_analytics',
    user: process.env.POSTGRES_USER ?? 'analytics',
    password: process.env.POSTGRES_PASSWORD ?? 'analytics_secret',
  });

  const sql = fs.readFileSync(seedPath, 'utf-8');
  await pool.query(sql);
  console.log('[seed] Seed data applied to database.');
  await pool.end();
}

main().catch((err) => {
  console.error('[seed] Error:', err);
  process.exit(1);
});

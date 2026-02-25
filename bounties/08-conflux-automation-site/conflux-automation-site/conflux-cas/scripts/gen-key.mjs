#!/usr/bin/env node
/**
 * Generate a random Ethereum private key and derive its checksummed address.
 * Usage: node scripts/gen-key.mjs
 */
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

// ── 1. Generate private key ──────────────────────────────────────────────────
const privKeyBytes = secp256k1.utils.randomSecretKey();
const privKeyHex = `0x${Buffer.from(privKeyBytes).toString('hex')}`;

// ── 2. Derive uncompressed public key (65 bytes: 04 || x || y) ──────────────
const pubKeyBytes = secp256k1.getPublicKey(privKeyBytes, false); // uncompressed
const pubKeyBody = pubKeyBytes.slice(1); // drop the 0x04 prefix → 64 bytes

// ── 3. Keccak-256 → take last 20 bytes → raw address ────────────────────────
const addrBytes = keccak_256(pubKeyBody).slice(-20);
const addrHex = Buffer.from(addrBytes).toString('hex');

// ── 4. EIP-55 checksum ───────────────────────────────────────────────────────
const addrHash = Buffer.from(
  keccak_256(new TextEncoder().encode(addrHex))
).toString('hex');
const checksummed = addrHex
  .split('')
  .map((c, i) => (parseInt(addrHash[i], 16) >= 8 ? c.toUpperCase() : c))
  .join('');

// ── Output ───────────────────────────────────────────────────────────────────
console.log('');
console.log(`  Private key : ${privKeyHex}`);
console.log(`  Address     : 0x${checksummed}`);
console.log('');
console.log('  ⚠  Never share or commit your private key.');
console.log('  💧 Get testnet CFX: https://faucet.confluxnetwork.org/eSpace');
console.log('');

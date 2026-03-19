import { describe, expect, it } from 'vitest';
import {
  deriveAccount,
  deriveAccounts,
  deriveFaucetAccount,
  generateMnemonic,
  getDerivationPath,
  validateMnemonic,
} from '../wallet/derivation.js';
import { COIN_TYPES, CORE_NETWORK_IDS } from '../wallet/types.js';

describe('generateMnemonic', () => {
  it('returns a 12-word mnemonic by default', () => {
    const mnemonic = generateMnemonic();
    expect(mnemonic.split(' ')).toHaveLength(12);
  });

  it('returns a 24-word mnemonic when strength 256 is specified', () => {
    const mnemonic = generateMnemonic(256);
    expect(mnemonic.split(' ')).toHaveLength(24);
  });

  it('generates unique mnemonics', () => {
    const a = generateMnemonic();
    const b = generateMnemonic();
    expect(a).not.toBe(b);
  });
});

describe('validateMnemonic', () => {
  it('validates a real 12-word BIP39 mnemonic', () => {
    const mnemonic = generateMnemonic();
    const result = validateMnemonic(mnemonic);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects an invalid mnemonic', () => {
    const result = validateMnemonic(
      'not a valid mnemonic phrase at all here xx'
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects an empty string', () => {
    const result = validateMnemonic('');
    expect(result.valid).toBe(false);
  });
});

describe('deriveAccount', () => {
  const mnemonic =
    'test test test test test test test test test test test junk';

  it('derives an account with both Core and eSpace addresses', () => {
    const account = deriveAccount(mnemonic, 0);
    expect(account.coreAddress).toBeTruthy();
    expect(account.evmAddress).toBeTruthy();
    expect(account.evmAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(account.index).toBe(0);
    expect(account.corePrivateKey).toBeTruthy();
    expect(account.evmPrivateKey).toBeTruthy();
  });

  it('derives different accounts for different indices', () => {
    const acc0 = deriveAccount(mnemonic, 0);
    const acc1 = deriveAccount(mnemonic, 1);
    expect(acc0.evmAddress).not.toBe(acc1.evmAddress);
    expect(acc0.corePrivateKey).not.toBe(acc1.corePrivateKey);
  });

  it('derives consistent addresses for the same mnemonic and index', () => {
    const acc1 = deriveAccount(mnemonic, 0);
    const acc2 = deriveAccount(mnemonic, 0);
    expect(acc1.evmAddress).toBe(acc2.evmAddress);
    expect(acc1.coreAddress).toBe(acc2.coreAddress);
  });
});

describe('deriveAccounts', () => {
  const mnemonic =
    'test test test test test test test test test test test junk';

  it('derives the requested number of accounts', () => {
    const accounts = deriveAccounts(mnemonic, { count: 5 });
    expect(accounts).toHaveLength(5);
  });

  it('indexes accounts sequentially starting at 0', () => {
    const accounts = deriveAccounts(mnemonic, { count: 3 });
    expect(accounts[0].index).toBe(0);
    expect(accounts[1].index).toBe(1);
    expect(accounts[2].index).toBe(2);
  });

  it('starts at a custom offset when specified', () => {
    const accounts = deriveAccounts(mnemonic, { count: 2, startIndex: 5 });
    expect(accounts[0].index).toBe(5);
    expect(accounts[1].index).toBe(6);
  });
});

describe('deriveFaucetAccount', () => {
  const mnemonic =
    'test test test test test test test test test test test junk';

  it('returns a valid faucet account', () => {
    const faucet = deriveFaucetAccount(mnemonic);
    expect(faucet.evmAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});

describe('getDerivationPath', () => {
  // signature: getDerivationPath(coinType, index, accountType?)
  it('returns Core Space path for coin type 503', () => {
    const path = getDerivationPath(COIN_TYPES.CONFLUX, 0);
    expect(path).toContain("503'");
  });

  it('returns eSpace path for coin type 60', () => {
    const path = getDerivationPath(COIN_TYPES.ETHEREUM, 0);
    expect(path).toContain("60'");
  });
});

describe('COIN_TYPES', () => {
  it('has CONFLUX and ETHEREUM coin types defined', () => {
    expect(COIN_TYPES.CONFLUX).toBe(503);
    expect(COIN_TYPES.ETHEREUM).toBe(60);
  });
});

describe('CORE_NETWORK_IDS', () => {
  it('has mainnet and testnet network IDs', () => {
    expect(CORE_NETWORK_IDS.MAINNET).toBeDefined();
    expect(CORE_NETWORK_IDS.TESTNET).toBeDefined();
  });
});

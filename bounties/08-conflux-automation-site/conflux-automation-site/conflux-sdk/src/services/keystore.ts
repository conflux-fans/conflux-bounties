/*
 * Copyright 2025 Conflux DevKit Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Keystore Service V2
 *
 * Complete rewrite for v2.0 with:
 * - Multi-admin support
 * - Per-mnemonic node configuration
 * - Encrypted mnemonic and derived keys storage
 * - Immutable node configuration
 * - No default test mnemonic
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { logger } from '../utils/logger.js';
import {
  type DerivedAccount as CoreDerivedAccount,
  deriveAccounts as coreDeriveAccounts,
  generateMnemonic as coreGenerateMnemonic,
  validateMnemonic as coreValidateMnemonic,
} from '../wallet/index.js';
import { EncryptionService } from './encryption.js';
import type {
  AddMnemonicData,
  ConfigModificationCheck,
  DerivedAccount,
  KeystoreV2,
  MnemonicEntry,
  MnemonicSummary,
  NodeConfig,
  SetupData,
} from './keystore-types.js';

// Custom error for locked keystore
export class KeystoreLockedError extends Error {
  constructor(
    message: string = 'Keystore is locked. Please unlock with your password first.'
  ) {
    super(message);
    this.name = 'KeystoreLockedError';
  }
}

// Base data directory for all mnemonic-specific data
const BASE_DATA_DIR = process.env.DEVKIT_DATA_DIR || '/workspace/.conflux-dev';

// Keystore file path
const DEFAULT_KEYSTORE_PATH =
  process.env.DEVKIT_KEYSTORE_PATH || join(homedir(), '.devkit.keystore.json');

/**
 * KeystoreService V2
 */
export class KeystoreService {
  private keystorePath: string;
  private keystore: KeystoreV2 | null = null;
  private currentPassword: string | null = null;

  constructor(keystorePath: string = DEFAULT_KEYSTORE_PATH) {
    this.keystorePath = keystorePath;
  }

  // ===== INITIALIZATION =====

  /**
   * Initialize keystore (load from disk or create empty)
   */
  async initialize(): Promise<void> {
    if (existsSync(this.keystorePath)) {
      await this.loadKeystore();
    } else {
      logger.info('Keystore file not found - fresh installation detected');
      this.keystore = null;
    }
  }

  /**
   * Load keystore from disk
   */
  private async loadKeystore(): Promise<void> {
    try {
      const data = readFileSync(this.keystorePath, 'utf-8');
      this.keystore = JSON.parse(data) as KeystoreV2;

      // Validate version
      if (this.keystore.version !== 2) {
        throw new Error(
          `Unsupported keystore version: ${this.keystore.version}. Expected version 2.`
        );
      }

      logger.info('Keystore loaded successfully');
    } catch (error) {
      logger.error('Failed to load keystore:', error);
      throw error;
    }
  }

  /**
   * Save keystore to disk
   */
  private async saveKeystore(): Promise<void> {
    if (!this.keystore) {
      throw new Error('Cannot save null keystore');
    }

    try {
      const data = JSON.stringify(this.keystore, null, 2);
      writeFileSync(this.keystorePath, data, 'utf-8');
      logger.info('Keystore saved successfully');
    } catch (error) {
      logger.error('Failed to save keystore:', error);
      throw error;
    }
  }

  // ===== SETUP & STATUS =====

  /**
   * Check if initial setup is completed
   */
  async isSetupCompleted(): Promise<boolean> {
    return this.keystore?.setupCompleted ?? false;
  }

  /**
   * Complete initial setup
   */
  async completeSetup(data: SetupData): Promise<void> {
    if (this.keystore?.setupCompleted) {
      throw new Error('Setup already completed');
    }

    logger.info('Completing initial setup...');

    // Generate salt if encryption enabled
    let encryptionSalt: Buffer | undefined;
    if (data.encryption?.enabled && data.encryption.password) {
      encryptionSalt = EncryptionService.generateSalt();
      this.currentPassword = data.encryption.password;
    }

    // Create mnemonic entry
    const mnemonicEntry = await this.createMnemonicEntry({
      mnemonic: data.mnemonic,
      label: data.mnemonicLabel,
      nodeConfig: {
        ...data.nodeConfig,
        miningAuthor: data.nodeConfig.miningAuthor || 'auto',
      },
      isFirstSetup: true,
      encryptionEnabled: data.encryption?.enabled ?? false,
      encryptionSalt,
    });

    // Create keystore v2
    this.keystore = {
      version: 2,
      setupCompleted: true,
      setupCompletedAt: new Date().toISOString(),
      adminAddresses: [data.adminAddress],
      encryptionEnabled: data.encryption?.enabled ?? false,
      encryptionSalt: encryptionSalt?.toString('base64'),
      mnemonics: [mnemonicEntry],
      activeIndex: 0,
    };

    await this.saveKeystore();

    logger.success('Initial setup completed successfully');
    logger.info(`Admin address: ${data.adminAddress}`);
    logger.info(`Wallet: ${data.mnemonicLabel}`);
    logger.info(
      `Encryption: ${data.encryption?.enabled ? 'Enabled' : 'Disabled'}`
    );
  }

  // ===== ADMIN MANAGEMENT =====

  /**
   * Get all admin addresses
   */
  async getAdminAddresses(): Promise<string[]> {
    this.ensureKeystoreLoaded();
    return [...(this.keystore?.adminAddresses ?? [])];
  }

  /**
   * Add admin address
   */
  async addAdminAddress(address: string): Promise<void> {
    this.ensureKeystoreLoaded();

    const normalized = address.toLowerCase();
    const exists = this.keystore?.adminAddresses.some(
      (addr) => addr.toLowerCase() === normalized
    );

    if (exists) {
      throw new Error('Admin address already exists');
    }

    this.keystore?.adminAddresses.push(address);
    await this.saveKeystore();

    logger.info(`Added admin address: ${address}`);
  }

  /**
   * Remove admin address
   */
  async removeAdminAddress(
    address: string,
    currentAdmin: string
  ): Promise<void> {
    this.ensureKeystoreLoaded();

    // Cannot remove self
    if (address.toLowerCase() === currentAdmin.toLowerCase()) {
      throw new Error('Cannot remove your own admin address');
    }

    // Must keep at least one admin
    if (this.keystore!.adminAddresses.length <= 1) {
      throw new Error('Cannot remove the last admin address');
    }

    const index = this.keystore!.adminAddresses.findIndex(
      (addr) => addr.toLowerCase() === address.toLowerCase()
    );

    if (index === -1) {
      throw new Error('Admin address not found');
    }

    this.keystore!.adminAddresses.splice(index, 1);
    await this.saveKeystore();

    logger.info(`Removed admin address: ${address}`);
  }

  /**
   * Check if address is admin
   */
  isAdmin(address: string): boolean {
    if (!this.keystore) return false;

    return this.keystore.adminAddresses.some(
      (admin) => admin.toLowerCase() === address.toLowerCase()
    );
  }

  // ===== MNEMONIC MANAGEMENT =====

  /**
   * Get active mnemonic entry
   */
  async getActiveMnemonic(): Promise<MnemonicEntry> {
    this.ensureKeystoreLoaded();

    const mnemonic = this.keystore!.mnemonics[this.keystore!.activeIndex];
    if (!mnemonic) {
      throw new Error('No active mnemonic found');
    }

    return mnemonic;
  }

  /**
   * Get mnemonic by ID
   */
  async getMnemonic(id: string): Promise<MnemonicEntry> {
    this.ensureKeystoreLoaded();

    const mnemonic = this.keystore!.mnemonics.find((m) => m.id === id);
    if (!mnemonic) {
      throw new Error(`Mnemonic not found: ${id}`);
    }

    return mnemonic;
  }

  /**
   * List all mnemonics (summary only)
   */
  async listMnemonics(): Promise<MnemonicSummary[]> {
    this.ensureKeystoreLoaded();

    return this.keystore!.mnemonics.map((m, index) => ({
      id: m.id,
      label: m.label,
      type: m.type,
      isActive: index === this.keystore!.activeIndex,
      createdAt: m.createdAt,
      nodeConfig: m.nodeConfig,
      dataDir: this.getDataDirForMnemonic(m.mnemonic),
      dataSize: this.getDataDirSize(this.getDataDirForMnemonic(m.mnemonic)),
    }));
  }

  /**
   * Add new mnemonic
   */
  async addMnemonic(data: AddMnemonicData): Promise<MnemonicEntry> {
    this.ensureKeystoreLoaded();

    // Check for duplicate label
    const exists = this.keystore!.mnemonics.some((m) => m.label === data.label);
    if (exists) {
      throw new Error(`Mnemonic with label "${data.label}" already exists`);
    }

    // Create mnemonic entry
    const mnemonicEntry = await this.createMnemonicEntry({
      mnemonic: data.mnemonic,
      label: data.label,
      nodeConfig: {
        ...data.nodeConfig,
        miningAuthor: data.nodeConfig.miningAuthor || 'auto',
      },
      isFirstSetup: false,
      encryptionEnabled: this.keystore!.encryptionEnabled,
      encryptionSalt: this.keystore?.encryptionSalt
        ? Buffer.from(this.keystore?.encryptionSalt, 'base64')
        : undefined,
    });

    this.keystore!.mnemonics.push(mnemonicEntry);

    // Set as active if requested
    if (data.setAsActive) {
      this.keystore!.activeIndex = this.keystore!.mnemonics.length - 1;
    }

    await this.saveKeystore();

    logger.info(`Added mnemonic: ${data.label}`);

    return mnemonicEntry;
  }

  /**
   * Switch active mnemonic
   */
  async switchActiveMnemonic(id: string): Promise<void> {
    this.ensureKeystoreLoaded();

    const index = this.keystore!.mnemonics.findIndex((m) => m.id === id);
    if (index === -1) {
      throw new Error(`Mnemonic not found: ${id}`);
    }

    this.keystore!.activeIndex = index;
    await this.saveKeystore();

    logger.info(
      `Switched to mnemonic: ${this.keystore!.mnemonics[index].label}`
    );
  }

  /**
   * Delete mnemonic and its data
   */
  async deleteMnemonic(id: string, deleteData: boolean = false): Promise<void> {
    this.ensureKeystoreLoaded();

    const index = this.keystore!.mnemonics.findIndex((m) => m.id === id);
    if (index === -1) {
      throw new Error(`Mnemonic not found: ${id}`);
    }

    // Cannot delete active mnemonic
    if (index === this.keystore!.activeIndex) {
      throw new Error(
        'Cannot delete active mnemonic. Switch to another mnemonic first.'
      );
    }

    const mnemonic = this.keystore!.mnemonics[index];

    // Delete data directory if requested
    if (deleteData) {
      const dataDir = this.getDataDirForMnemonic(mnemonic.mnemonic);
      if (existsSync(dataDir)) {
        // Check for lock file
        const lockFile = join(dataDir, 'node.lock');
        if (existsSync(lockFile)) {
          throw new Error('Cannot delete data while node is running');
        }

        rmSync(dataDir, { recursive: true, force: true });
        logger.info(`Deleted data directory: ${dataDir}`);
      }
    }

    // Remove from keystore
    this.keystore!.mnemonics.splice(index, 1);

    // Adjust active index if needed
    if (this.keystore!.activeIndex > index) {
      this.keystore!.activeIndex--;
    }

    await this.saveKeystore();

    logger.info(`Deleted mnemonic: ${mnemonic.label}`);
  }

  // ===== NODE CONFIGURATION =====

  /**
   * Get node configuration for a mnemonic
   */
  async getNodeConfig(mnemonicId: string): Promise<NodeConfig> {
    const mnemonic = await this.getMnemonic(mnemonicId);
    return mnemonic.nodeConfig;
  }

  /**
   * Check if node configuration can be modified
   */
  async canModifyNodeConfig(
    mnemonicId: string
  ): Promise<ConfigModificationCheck> {
    const mnemonic = await this.getMnemonic(mnemonicId);
    const dataDir = this.getDataDirForMnemonic(mnemonic.mnemonic);

    // Check if data directory exists
    if (!existsSync(dataDir)) {
      return {
        canModify: true,
      };
    }

    // Check if node is running (lock file exists)
    const lockFile = join(dataDir, 'node.lock');
    if (existsSync(lockFile)) {
      return {
        canModify: false,
        reason: 'Node is currently running',
        lockFile,
      };
    }

    // Data exists but node is stopped
    return {
      canModify: false,
      reason:
        'Data directory exists. Delete blockchain data to modify configuration.',
      dataDir,
    };
  }

  /**
   * Update node configuration
   */
  async updateNodeConfig(
    mnemonicId: string,
    config: Partial<NodeConfig>
  ): Promise<void> {
    const check = await this.canModifyNodeConfig(mnemonicId);
    if (!check.canModify) {
      throw new Error(check.reason);
    }

    this.ensureKeystoreLoaded();

    const index = this.keystore!.mnemonics.findIndex(
      (m) => m.id === mnemonicId
    );
    if (index === -1) {
      throw new Error(`Mnemonic not found: ${mnemonicId}`);
    }

    const mnemonic = this.keystore!.mnemonics[index];

    // Update configuration
    const newConfig: NodeConfig = {
      ...mnemonic.nodeConfig,
      ...config,
      immutable: true,
      configHash: '', // Will be recalculated
      createdAt: new Date().toISOString(),
    };

    // Recalculate config hash
    newConfig.configHash = await this.calculateConfigHash(newConfig);

    this.keystore!.mnemonics[index].nodeConfig = newConfig;

    await this.saveKeystore();

    logger.info(`Updated node config for: ${mnemonic.label}`);
  }

  /**
   * Delete blockchain data directory
   */
  async deleteNodeData(
    mnemonicId: string
  ): Promise<{ deletedDir: string; dataSize: string }> {
    const mnemonic = await this.getMnemonic(mnemonicId);
    const dataDir = this.getDataDirForMnemonic(mnemonic.mnemonic);

    if (!existsSync(dataDir)) {
      throw new Error('Data directory does not exist');
    }

    // Check for lock file
    const lockFile = join(dataDir, 'node.lock');
    if (existsSync(lockFile)) {
      throw new Error('Cannot delete data while node is running');
    }

    const dataSize = this.getDataDirSize(dataDir);

    rmSync(dataDir, { recursive: true, force: true });

    logger.info(`Deleted data directory: ${dataDir}`);

    return { deletedDir: dataDir, dataSize };
  }

  // ===== ENCRYPTION =====

  /**
   * Check if keystore is locked
   */
  isLocked(): boolean {
    if (!this.keystore || !this.keystore.encryptionEnabled) {
      return false;
    }

    return this.currentPassword === null;
  }

  /**
   * Check if encryption is enabled for the keystore
   */
  isEncryptionEnabled(): boolean {
    return this.keystore?.encryptionEnabled ?? false;
  }

  /**
   * Unlock keystore with password
   */
  async unlockKeystore(password: string): Promise<void> {
    if (!this.keystore || !this.keystore.encryptionEnabled) {
      throw new Error('Keystore is not encrypted');
    }

    // Verify password by trying to decrypt first mnemonic
    try {
      const firstMnemonic = this.keystore.mnemonics[0];
      if (firstMnemonic.type === 'encrypted') {
        const salt = Buffer.from(this.keystore.encryptionSalt!, 'base64');
        await EncryptionService.decrypt(firstMnemonic.mnemonic, password, salt);
      }

      this.currentPassword = password;
      logger.info('Keystore unlocked successfully');
    } catch (_error) {
      throw new Error('Invalid password');
    }
  }

  /**
   * Lock keystore (clear password from memory)
   */
  async lockKeystore(): Promise<void> {
    this.currentPassword = null;
    logger.info('Keystore locked');
  }

  /**
   * Get decrypted mnemonic
   */
  async getDecryptedMnemonic(mnemonicId: string): Promise<string> {
    const mnemonic = await this.getMnemonic(mnemonicId);

    if (mnemonic.type === 'plaintext') {
      return mnemonic.mnemonic;
    }

    // Encrypted - need password
    if (this.isLocked()) {
      throw new KeystoreLockedError();
    }

    const salt = Buffer.from(this.keystore!.encryptionSalt!, 'base64');
    return await EncryptionService.decrypt(
      mnemonic.mnemonic,
      this.currentPassword!,
      salt
    );
  }

  // ===== DERIVED KEYS & ACCOUNTS =====

  /**
   * Get genesis accounts for a mnemonic
   */
  async deriveGenesisAccounts(mnemonicId: string): Promise<DerivedAccount[]> {
    const mnemonicEntry = await this.getMnemonic(mnemonicId);

    // Check if already derived and stored
    if (mnemonicEntry.derivedKeys.type === 'plaintext') {
      return mnemonicEntry.derivedKeys.genesisAccounts as DerivedAccount[];
    }

    // Encrypted - need to decrypt
    if (this.isLocked()) {
      throw new KeystoreLockedError();
    }

    const salt = Buffer.from(this.keystore!.encryptionSalt!, 'base64');
    const decrypted = await EncryptionService.decryptObject<DerivedAccount[]>(
      mnemonicEntry.derivedKeys.genesisAccounts as string,
      this.currentPassword!,
      salt
    );

    return decrypted;
  }

  /**
   * Get faucet account for a mnemonic
   */
  async deriveFaucetAccount(mnemonicId: string): Promise<DerivedAccount> {
    const mnemonicEntry = await this.getMnemonic(mnemonicId);

    // Check if already derived and stored
    if (mnemonicEntry.derivedKeys.type === 'plaintext') {
      return mnemonicEntry.derivedKeys.faucetAccount as DerivedAccount;
    }

    // Encrypted - need to decrypt
    if (this.isLocked()) {
      throw new KeystoreLockedError();
    }

    const salt = Buffer.from(this.keystore!.encryptionSalt!, 'base64');
    const decrypted = await EncryptionService.decryptObject<DerivedAccount>(
      mnemonicEntry.derivedKeys.faucetAccount as string,
      this.currentPassword!,
      salt
    );

    return decrypted;
  }

  /**
   * Derive accounts from mnemonic (HD wallet derivation)
   * Returns accounts with both Core and eSpace private keys
   * Uses @conflux-devkit/core/wallet for derivation
   */
  async deriveAccountsFromMnemonic(
    mnemonic: string,
    _network: 'core' | 'espace', // Kept for API compatibility, both keys are always derived
    count: number,
    startIndex: number = 0,
    chainIdOverride?: number
  ): Promise<DerivedAccount[]> {
    // Get chainId from override or active mnemonic
    let coreNetworkId: number;
    if (chainIdOverride !== undefined) {
      coreNetworkId = chainIdOverride;
    } else {
      const activeMnemonic = await this.getActiveMnemonic();
      coreNetworkId = activeMnemonic.nodeConfig.chainId;
    }

    // Use core wallet module for derivation
    const coreAccounts = coreDeriveAccounts(mnemonic, {
      count,
      startIndex,
      coreNetworkId,
      accountType: 'standard',
    });

    // Map to backend's DerivedAccount type
    return coreAccounts.map(
      (acc: CoreDerivedAccount): DerivedAccount => ({
        index: acc.index,
        core: acc.coreAddress,
        evm: acc.evmAddress,
        privateKey: acc.corePrivateKey, // Core Space private key (m/44'/503'/0'/0/i)
        evmPrivateKey: acc.evmPrivateKey, // eSpace private key (m/44'/60'/0'/0/i)
      })
    );
  }

  // ===== UTILITY METHODS =====

  /**
   * Get data directory for active mnemonic
   */
  async getDataDir(): Promise<string> {
    const mnemonic = await this.getActiveMnemonic();
    return this.getDataDirForMnemonic(mnemonic.mnemonic);
  }

  /**
   * Get data directory for specific mnemonic
   */
  private getDataDirForMnemonic(mnemonic: string): string {
    const hash = createHash('sha256').update(mnemonic).digest('hex');
    const shortHash = hash.substring(0, 16);
    return join(BASE_DATA_DIR, `wallet-${shortHash}`);
  }

  /**
   * Get mnemonic hash (for display)
   */
  async getMnemonicHash(): Promise<string> {
    const mnemonic = await this.getActiveMnemonic();
    const hash = createHash('sha256').update(mnemonic.mnemonic).digest('hex');
    return hash;
  }

  /**
   * Get active mnemonic label
   */
  getActiveLabel(): string {
    if (!this.keystore) return 'Unknown';
    const mnemonic = this.keystore.mnemonics[this.keystore.activeIndex];
    return mnemonic?.label || 'Unknown';
  }

  /**
   * Get active mnemonic index
   */
  getActiveIndex(): number {
    return this.keystore?.activeIndex ?? 0;
  }

  /**
   * Generate new BIP-39 mnemonic
   * Uses @conflux-devkit/core/wallet for generation
   */
  generateMnemonic(): string {
    return coreGenerateMnemonic();
  }

  /**
   * Validate mnemonic format
   * Uses @conflux-devkit/core/wallet for validation
   */
  validateMnemonic(mnemonic: string): boolean {
    return coreValidateMnemonic(mnemonic).valid;
  }

  // ===== PRIVATE HELPERS =====

  /**
   * Ensure keystore is loaded
   */
  private ensureKeystoreLoaded(): void {
    if (!this.keystore) {
      throw new Error('Keystore not loaded. Complete initial setup first.');
    }
  }

  /**
   * Create a mnemonic entry with node config and derived keys
   */
  private async createMnemonicEntry(params: {
    mnemonic: string;
    label: string;
    nodeConfig: {
      accountsCount: number;
      chainId: number;
      evmChainId: number;
      miningAuthor: string;
    };
    isFirstSetup: boolean;
    encryptionEnabled: boolean;
    encryptionSalt?: Buffer;
  }): Promise<MnemonicEntry> {
    const { mnemonic, label, nodeConfig, encryptionEnabled, encryptionSalt } =
      params;

    const id = `mnemonic_${Date.now()}`;
    const createdAt = new Date().toISOString();

    // Derive genesis accounts (0 to accountsCount-1)
    // Pass chainId explicitly since during initial setup there's no active mnemonic yet
    const genesisAccounts = await this.deriveAccountsFromMnemonic(
      mnemonic,
      'espace',
      nodeConfig.accountsCount,
      0,
      nodeConfig.chainId
    );

    // Derive faucet account (accountsCount)
    const [faucetAccount] = await this.deriveAccountsFromMnemonic(
      mnemonic,
      'core',
      1,
      nodeConfig.accountsCount,
      nodeConfig.chainId
    );

    // Create node config with hash
    const config: NodeConfig = {
      ...nodeConfig,
      immutable: true,
      configHash: '', // Will be calculated
      createdAt,
    };

    config.configHash = await this.calculateConfigHash(config);

    // Encrypt mnemonic and derived keys if encryption enabled
    let encryptedMnemonic = mnemonic;
    let derivedKeys: MnemonicEntry['derivedKeys'];

    if (encryptionEnabled && encryptionSalt && this.currentPassword) {
      encryptedMnemonic = await EncryptionService.encrypt(
        mnemonic,
        this.currentPassword,
        encryptionSalt
      );

      const encryptedGenesis = await EncryptionService.encryptObject(
        genesisAccounts,
        this.currentPassword,
        encryptionSalt
      );

      const encryptedFaucet = await EncryptionService.encryptObject(
        faucetAccount,
        this.currentPassword,
        encryptionSalt
      );

      derivedKeys = {
        type: 'encrypted',
        genesisAccounts: encryptedGenesis,
        faucetAccount: encryptedFaucet,
      };
    } else {
      derivedKeys = {
        type: 'plaintext',
        genesisAccounts,
        faucetAccount,
      };
    }

    return {
      id,
      label,
      type: encryptionEnabled ? 'encrypted' : 'plaintext',
      mnemonic: encryptedMnemonic,
      createdAt,
      nodeConfig: config,
      derivedKeys,
    };
  }

  /**
   * Calculate config hash for integrity check
   */
  private async calculateConfigHash(config: NodeConfig): Promise<string> {
    const data = JSON.stringify({
      accountsCount: config.accountsCount,
      chainId: config.chainId,
      evmChainId: config.evmChainId,
      miningAuthor: config.miningAuthor,
    });

    return await EncryptionService.hash(data);
  }

  /**
   * Get data directory size (human-readable)
   */
  private getDataDirSize(dataDir: string): string {
    if (!existsSync(dataDir)) {
      return '0MB';
    }

    try {
      const stats = statSync(dataDir);
      const bytes = stats.size;

      if (bytes < 1024) return `${bytes}B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    } catch (_error) {
      return '0MB';
    }
  }
}

// Singleton instance
let instance: KeystoreService | null = null;

/**
 * Get singleton KeystoreService instance
 */
export function getKeystoreService(): KeystoreService {
  if (!instance) {
    instance = new KeystoreService();
  }
  return instance;
}

// Re-export types for backward compatibility
export type { DerivedAccount } from './keystore-types.js';

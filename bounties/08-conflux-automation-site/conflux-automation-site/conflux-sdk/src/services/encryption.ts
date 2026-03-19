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

import { webcrypto } from 'node:crypto';

/**
 * Encryption service using AES-256-GCM
 *
 * Security specifications:
 * - Algorithm: AES-256-GCM (authenticated encryption)
 * - Key derivation: PBKDF2-SHA256 with 100,000 iterations
 * - Salt: 32 bytes (random, stored in keystore)
 * - IV: 12 bytes (random per encryption, prepended to ciphertext)
 * - Format: base64(IV + EncryptedData + AuthTag)
 */
export class EncryptionService {
  private static readonly ITERATIONS = 100000;
  private static readonly KEY_LENGTH = 256;
  private static readonly SALT_LENGTH = 32;
  private static readonly IV_LENGTH = 12;

  /**
   * Generate a random salt for key derivation
   */
  static generateSalt(): Buffer {
    return Buffer.from(
      webcrypto.getRandomValues(new Uint8Array(EncryptionService.SALT_LENGTH))
    );
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  static async deriveKey(password: string, salt: Buffer): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await webcrypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive AES key using PBKDF2
    return await webcrypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(salt),
        iterations: EncryptionService.ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: EncryptionService.KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt plaintext with password
   *
   * @param plaintext - String to encrypt
   * @param password - Encryption password
   * @param salt - Salt for key derivation
   * @returns Base64-encoded ciphertext with prepended IV
   */
  static async encrypt(
    plaintext: string,
    password: string,
    salt: Buffer
  ): Promise<string> {
    // Derive key from password
    const key = await EncryptionService.deriveKey(password, salt);

    // Generate random IV
    const iv = webcrypto.getRandomValues(
      new Uint8Array(EncryptionService.IV_LENGTH)
    );

    // Encode plaintext
    const encoder = new TextEncoder();
    const plaintextBuffer = encoder.encode(plaintext);

    // Encrypt with AES-GCM
    const ciphertext = await webcrypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintextBuffer
    );

    // Combine IV + ciphertext (IV prepended for easy extraction)
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // Return as base64
    return Buffer.from(combined).toString('base64');
  }

  /**
   * Decrypt ciphertext with password
   *
   * @param ciphertext - Base64-encoded ciphertext with prepended IV
   * @param password - Encryption password
   * @param salt - Salt for key derivation
   * @returns Decrypted plaintext
   * @throws Error if decryption fails (wrong password or corrupted data)
   */
  static async decrypt(
    ciphertext: string,
    password: string,
    salt: Buffer
  ): Promise<string> {
    // Decode from base64
    const combined = Buffer.from(ciphertext, 'base64');

    // Extract IV and encrypted data
    const iv = combined.subarray(0, EncryptionService.IV_LENGTH);
    const encrypted = combined.subarray(EncryptionService.IV_LENGTH);

    // Derive key from password
    const key = await EncryptionService.deriveKey(password, salt);

    try {
      // Decrypt with AES-GCM
      const decrypted = await webcrypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );

      // Decode plaintext
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (_error) {
      throw new Error('Decryption failed - invalid password or corrupted data');
    }
  }

  /**
   * Encrypt an object (serializes to JSON first)
   */
  static async encryptObject<T>(
    obj: T,
    password: string,
    salt: Buffer
  ): Promise<string> {
    const json = JSON.stringify(obj);
    return await EncryptionService.encrypt(json, password, salt);
  }

  /**
   * Decrypt to an object (parses JSON after decryption)
   */
  static async decryptObject<T>(
    ciphertext: string,
    password: string,
    salt: Buffer
  ): Promise<T> {
    const json = await EncryptionService.decrypt(ciphertext, password, salt);
    return JSON.parse(json) as T;
  }

  /**
   * Hash a string with SHA-256 (for config integrity checks)
   */
  static async hash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const hashBuffer = await webcrypto.subtle.digest('SHA-256', dataBuffer);

    return Buffer.from(hashBuffer).toString('hex');
  }

  /**
   * Verify password strength (basic validation)
   */
  static validatePasswordStrength(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letters');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letters');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain numbers');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

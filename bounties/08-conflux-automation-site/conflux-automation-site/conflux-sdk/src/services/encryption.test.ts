import { describe, expect, it } from 'vitest';
import { EncryptionService } from '../services/encryption.js';

describe('EncryptionService', () => {
  describe('generateSalt', () => {
    it('returns a 32-byte buffer', () => {
      const salt = EncryptionService.generateSalt();
      expect(salt).toBeInstanceOf(Buffer);
      expect(salt.byteLength).toBe(32);
    });

    it('generates unique salts', () => {
      const s1 = EncryptionService.generateSalt().toString('hex');
      const s2 = EncryptionService.generateSalt().toString('hex');
      expect(s1).not.toBe(s2);
    });
  });

  describe('encrypt / decrypt', () => {
    it('round-trips a plaintext value', async () => {
      const salt = EncryptionService.generateSalt();
      const password = 'super-secret-password-123';
      const plaintext = 'my secret mnemonic phrase or data';

      const encrypted = await EncryptionService.encrypt(
        plaintext,
        password,
        salt
      );
      const decrypted = await EncryptionService.decrypt(
        encrypted,
        password,
        salt
      );

      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for the same plaintext (random IV)', async () => {
      const salt = EncryptionService.generateSalt();
      const password = 'password';
      const plaintext = 'same text';

      const enc1 = await EncryptionService.encrypt(plaintext, password, salt);
      const enc2 = await EncryptionService.encrypt(plaintext, password, salt);

      expect(enc1).not.toBe(enc2);
    });

    it('encrypts with a binary key and decrypts back', async () => {
      const salt = EncryptionService.generateSalt();
      const password = 'p@55w0rd!';
      const json = JSON.stringify({ key: 'value', num: 42 });

      const ciphertext = await EncryptionService.encrypt(json, password, salt);
      const result = await EncryptionService.decrypt(
        ciphertext,
        password,
        salt
      );
      expect(JSON.parse(result)).toEqual({ key: 'value', num: 42 });
    });

    it('throws when decrypting with wrong password', async () => {
      const salt = EncryptionService.generateSalt();
      const ciphertext = await EncryptionService.encrypt(
        'secret',
        'correct-password',
        salt
      );

      await expect(
        EncryptionService.decrypt(ciphertext, 'wrong-password', salt)
      ).rejects.toThrow();
    });

    it('throws when decrypting with wrong salt', async () => {
      const salt = EncryptionService.generateSalt();
      const wrongSalt = EncryptionService.generateSalt();
      const ciphertext = await EncryptionService.encrypt(
        'secret',
        'password',
        salt
      );

      await expect(
        EncryptionService.decrypt(ciphertext, 'password', wrongSalt)
      ).rejects.toThrow();
    });
  });
});

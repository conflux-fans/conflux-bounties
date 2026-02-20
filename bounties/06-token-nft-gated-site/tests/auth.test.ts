import { describe, it, expect } from 'vitest';
import { generateNonce, buildSiwcMessage, parseSiwcMessage } from '../src/lib/auth';

describe('SIWC Auth', () => {
  const sampleParams = {
    domain: 'localhost',
    address: '0x1234567890abcdef1234567890abcdef12345678',
    statement: 'Sign in to access token-gated content.',
    uri: 'http://localhost:3000',
    version: '1',
    chainId: 1030,
    nonce: 'abc123def456',
    issuedAt: '2025-01-01T00:00:00.000Z',
  };

  describe('generateNonce', () => {
    it('should generate a 32-char hex nonce', () => {
      const nonce = generateNonce();
      expect(nonce).toHaveLength(32);
      expect(/^[0-9a-f]+$/.test(nonce)).toBe(true);
    });

    it('should generate unique nonces', () => {
      const a = generateNonce();
      const b = generateNonce();
      expect(a).not.toBe(b);
    });
  });

  describe('buildSiwcMessage', () => {
    it('should build correct SIWC message format', () => {
      const message = buildSiwcMessage(sampleParams);
      expect(message).toContain('localhost wants you to sign in with your Conflux account:');
      expect(message).toContain(sampleParams.address);
      expect(message).toContain('Chain ID: 1030');
      expect(message).toContain(`Nonce: ${sampleParams.nonce}`);
      expect(message).toContain('Version: 1');
    });
  });

  describe('parseSiwcMessage', () => {
    it('should round-trip build → parse', () => {
      const message = buildSiwcMessage(sampleParams);
      const parsed = parseSiwcMessage(message);

      expect(parsed).not.toBeNull();
      expect(parsed!.domain).toBe('localhost');
      expect(parsed!.address).toBe(sampleParams.address);
      expect(parsed!.chainId).toBe(1030);
      expect(parsed!.nonce).toBe(sampleParams.nonce);
      expect(parsed!.version).toBe('1');
    });

    it('should return null for invalid messages', () => {
      expect(parseSiwcMessage('invalid message')).toBeNull();
      expect(parseSiwcMessage('')).toBeNull();
    });

    it('should parse statement correctly', () => {
      const message = buildSiwcMessage(sampleParams);
      const parsed = parseSiwcMessage(message);
      expect(parsed!.statement).toBe('Sign in to access token-gated content.');
    });
  });
});

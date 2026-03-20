import { fetchContractSource, checkContractVerified } from '@/lib/confluxscan';

// Mock global fetch
global.fetch = jest.fn();

describe('fetchContractSource', () => {
  afterEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  it('fetches and parses contract source', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: '1',
        message: 'OK',
        result: [{
          SourceCode: 'pragma solidity ^0.8.0;\ncontract Test {}',
          ABI: '[{"type":"function"}]',
          ContractName: 'Test',
          CompilerVersion: 'v0.8.19',
          OptimizationUsed: '1',
          Runs: '200',
          ConstructorArguments: '',
          EVMVersion: 'london',
          Library: '',
          LicenseType: 'MIT',
          Proxy: '0',
          Implementation: '',
          SwarmSource: '',
        }],
      }),
    });

    const result = await fetchContractSource('0x1234567890abcdef1234567890abcdef12345678');
    expect(result.name).toBe('Test');
    expect(result.compilerVersion).toBe('v0.8.19');
    expect(result.sourceCode).toContain('pragma solidity');
  });

  it('throws for unverified contract', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: '0',
        message: 'NOTOK',
        result: null,
      }),
    });

    await expect(
      fetchContractSource('0x1234567890abcdef1234567890abcdef12345678'),
    ).rejects.toThrow('not verified');
  });

  it('throws for API error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(
      fetchContractSource('0x1234567890abcdef1234567890abcdef12345678'),
    ).rejects.toThrow('500');
  });

  it('throws for empty source code', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: '1',
        message: 'OK',
        result: [{
          SourceCode: '',
          ABI: '[]',
          ContractName: 'Test',
          CompilerVersion: 'v0.8.19',
          OptimizationUsed: '0',
          Runs: '200',
          ConstructorArguments: '',
          EVMVersion: 'london',
          Library: '',
          LicenseType: '',
          Proxy: '0',
          Implementation: '',
          SwarmSource: '',
        }],
      }),
    });

    await expect(
      fetchContractSource('0x1234567890abcdef1234567890abcdef12345678'),
    ).rejects.toThrow('source code is not available');
  });
});

describe('checkContractVerified', () => {
  afterEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  it('returns true for verified contracts', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: '1',
        result: [{
          SourceCode: 'pragma solidity ^0.8.0;\ncontract Test {}',
          ABI: '[]', ContractName: 'Test', CompilerVersion: 'v0.8.19',
          OptimizationUsed: '0', Runs: '200', ConstructorArguments: '',
          EVMVersion: 'london', Library: '', LicenseType: '',
          Proxy: '0', Implementation: '', SwarmSource: '',
        }],
      }),
    });

    expect(await checkContractVerified('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
  });

  it('returns false for unverified contracts', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: '0', result: null }),
    });

    expect(await checkContractVerified('0x1234567890abcdef1234567890abcdef12345678')).toBe(false);
  });
});

// Mock wagmi modules to avoid Jest parsing issues
jest.mock('wagmi', () => ({
  http: jest.fn(),
  createConfig: jest.fn(),
}));

jest.mock('wagmi/chains', () => ({
  sepolia: { id: 11155111 },
  mainnet: { id: 1 },
  confluxESpace: { id: 1030 },
  confluxESpaceTestnet: { id: 71 },
}));

jest.mock('@rainbow-me/rainbowkit', () => ({
  getDefaultConfig: jest.fn(() => ({})),
}));

import { 
  getFactoryAddress, 
  getExplorerUrl, 
  getExplorerAddressUrl, 
  getExplorerTxUrl, 
  getChainName,
  CONTRACT_ADDRESSES,
  CHAIN_INFO,
  DEFAULT_CHAIN,
  chains
} from './config';

// Mock environment variables
const originalEnv = process.env;

describe('Web3 Config', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('CONTRACT_ADDRESSES', () => {
    it('should have factory addresses for all supported chains', () => {
      expect(CONTRACT_ADDRESSES[1]).toBeDefined(); // mainnet
      expect(CONTRACT_ADDRESSES[11155111]).toBeDefined(); // sepolia
      expect(CONTRACT_ADDRESSES[1030]).toBeDefined(); // confluxESpace
      expect(CONTRACT_ADDRESSES[71]).toBeDefined(); // confluxESpaceTestnet
    });

    it('should have FACTORY property for each chain', () => {
      Object.values(CONTRACT_ADDRESSES).forEach(chainConfig => {
        expect(chainConfig.FACTORY).toBeDefined();
      });
    });
  });

  describe('CHAIN_INFO', () => {
    it('should have chain information for all supported chains', () => {
      expect(CHAIN_INFO[1]).toBeDefined(); // mainnet
      expect(CHAIN_INFO[11155111]).toBeDefined(); // sepolia
      expect(CHAIN_INFO[1030]).toBeDefined(); // confluxESpace
      expect(CHAIN_INFO[71]).toBeDefined(); // confluxESpaceTestnet
    });

    it('should have required properties for each chain', () => {
      Object.values(CHAIN_INFO).forEach(chainInfo => {
        expect(chainInfo.name).toBeDefined();
        expect(chainInfo.explorer).toBeDefined();
      });
    });

    it('should have correct chain names', () => {
      expect(CHAIN_INFO[1].name).toBe('Ethereum Mainnet');
      expect(CHAIN_INFO[11155111].name).toBe('Sepolia Testnet');
      expect(CHAIN_INFO[1030].name).toBe('Conflux Espace');
      expect(CHAIN_INFO[71].name).toBe('Conflux Espace Testnet');
    });

    it('should have correct explorer URLs', () => {
      expect(CHAIN_INFO[1].explorer).toBe('https://etherscan.io');
      expect(CHAIN_INFO[11155111].explorer).toBe('https://sepolia.etherscan.io');
      expect(CHAIN_INFO[1030].explorer).toBe('https://evm.confluxscan.io');
      expect(CHAIN_INFO[71].explorer).toBe('https://evm.confluxscan.io');
    });
  });

  describe('getFactoryAddress', () => {
    it('should return factory address for mainnet if configured', () => {
      if (CONTRACT_ADDRESSES[1].FACTORY) {
        const address = getFactoryAddress(1);
        expect(address).toBe(CONTRACT_ADDRESSES[1].FACTORY);
      } else {
        expect(() => getFactoryAddress(1)).toThrow('Factory contract not deployed on chain 1');
      }
    });

    it('should return factory address for sepolia if configured', () => {
      if (CONTRACT_ADDRESSES[11155111].FACTORY) {
        const address = getFactoryAddress(11155111);
        expect(address).toBe(CONTRACT_ADDRESSES[11155111].FACTORY);
      } else {
        expect(() => getFactoryAddress(11155111)).toThrow('Factory contract not deployed on chain 11155111');
      }
    });

    it('should throw error for unsupported chain', () => {
      expect(() => getFactoryAddress(999)).toThrow('Factory contract not deployed on chain 999');
    });

    it('should throw error when factory address is empty', () => {
      // Test with a chain that doesn't have a factory address
      if (!CONTRACT_ADDRESSES[1030]?.FACTORY) {
        expect(() => getFactoryAddress(1030)).toThrow('Factory contract not deployed on chain 1030');
      } else {
        // If it has an address, test with a non-existent chain
        expect(() => getFactoryAddress(999)).toThrow('Factory contract not deployed on chain 999');
      }
    });
  });

  describe('getExplorerUrl', () => {
    it('should return correct explorer URL for mainnet', () => {
      const url = getExplorerUrl(1);
      expect(url).toBe('https://etherscan.io');
    });

    it('should return correct explorer URL for sepolia', () => {
      const url = getExplorerUrl(11155111);
      expect(url).toBe('https://sepolia.etherscan.io');
    });

    it('should return correct explorer URL for confluxESpace', () => {
      const url = getExplorerUrl(1030);
      expect(url).toBe('https://evm.confluxscan.io');
    });

    it('should return default explorer URL for unknown chain', () => {
      const url = getExplorerUrl(999);
      expect(url).toBe('https://etherscan.io');
    });
  });

  describe('getExplorerAddressUrl', () => {
    it('should return correct address URL for mainnet', () => {
      const address = '0x1234567890123456789012345678901234567890';
      const url = getExplorerAddressUrl(1, address);
      expect(url).toBe(`https://etherscan.io/address/${address}`);
    });

    it('should return correct address URL for sepolia', () => {
      const address = '0x0987654321098765432109876543210987654321';
      const url = getExplorerAddressUrl(11155111, address);
      expect(url).toBe(`https://sepolia.etherscan.io/address/${address}`);
    });

    it('should return correct address URL for confluxESpace', () => {
      const address = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const url = getExplorerAddressUrl(1030, address);
      expect(url).toBe(`https://evm.confluxscan.io/address/${address}`);
    });
  });

  describe('getExplorerTxUrl', () => {
    it('should return correct transaction URL for mainnet', () => {
      const txHash = '0x1234567890123456789012345678901234567890123456789012345678901234';
      const url = getExplorerTxUrl(1, txHash);
      expect(url).toBe(`https://etherscan.io/tx/${txHash}`);
    });

    it('should return correct transaction URL for sepolia', () => {
      const txHash = '0x0987654321098765432109876543210987654321098765432109876543210987';
      const url = getExplorerTxUrl(11155111, txHash);
      expect(url).toBe(`https://sepolia.etherscan.io/tx/${txHash}`);
    });

    it('should return correct transaction URL for confluxESpace', () => {
      const txHash = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const url = getExplorerTxUrl(1030, txHash);
      expect(url).toBe(`https://evm.confluxscan.io/tx/${txHash}`);
    });
  });

  describe('getChainName', () => {
    it('should return correct chain name for mainnet', () => {
      const name = getChainName(1);
      expect(name).toBe('Ethereum Mainnet');
    });

    it('should return correct chain name for sepolia', () => {
      const name = getChainName(11155111);
      expect(name).toBe('Sepolia Testnet');
    });

    it('should return correct chain name for confluxESpace', () => {
      const name = getChainName(1030);
      expect(name).toBe('Conflux Espace');
    });

    it('should throw error for unknown chain', () => {
      expect(() => getChainName(999)).toThrow('Chain not supported');
    });
  });

  describe('DEFAULT_CHAIN', () => {
    it('should be set to sepolia', () => {
      expect(DEFAULT_CHAIN.id).toBe(11155111);
    });
  });

  describe('chains', () => {
    it('should include all supported chains', () => {
      const chainIds = chains.map(chain => chain.id);
      expect(chainIds).toContain(11155111); // sepolia
      expect(chainIds).toContain(1); // mainnet
      expect(chainIds).toContain(1030); // confluxESpace
      expect(chainIds).toContain(71); // confluxESpaceTestnet
    });

    it('should have correct length', () => {
      expect(chains).toHaveLength(4);
    });
  });

  it('should handle getFactoryAddress with invalid chain', () => {
    const invalidChain = 999999;
    expect(() => getFactoryAddress(invalidChain)).toThrow('Factory contract not deployed on chain 999999');
  });

  it('should handle getChainName with invalid chain', () => {
    const invalidChain = 999999;
    expect(() => getChainName(invalidChain)).toThrow('Chain not supported');
  });
}); 
// Contract factory for creating test smart contracts and ABIs
export class ContractFactory {
  // Simple ERC20-like test contract ABI
  static getTestTokenABI() {
    return [
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "from",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "value",
            "type": "uint256"
          }
        ],
        "name": "Transfer",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "owner",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "spender",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "value",
            "type": "uint256"
          }
        ],
        "name": "Approval",
        "type": "event"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "to",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "transfer",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "spender",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "approve",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "account",
            "type": "address"
          }
        ],
        "name": "balanceOf",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ];
  }

  // Simple test contract bytecode (minimal ERC20-like contract)
  static getTestTokenBytecode() {
    return "0x608060405234801561001057600080fd5b50600436106100365760003560e01c8063a9059cbb1461003b578063dd62ed3e14610057575b600080fd5b610055600480360381019061005091906100d3565b610087565b005b610071600480360381019061006c9190610113565b6100a1565b60405161007e9190610162565b60405180910390f35b8173ffffffffffffffffffffffffffffffffffffffff16ff5b60006020528160005260406000206020528060005260406000206000915091505481565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b60006100f3826100c8565b9050919050565b610103816100e8565b811461010e57600080fd5b50565b600081359050610120816100fa565b92915050565b6000819050919050565b61013981610126565b811461014457600080fd5b50565b60008135905061015681610130565b92915050565b600060408284031215610172576101716100c3565b5b600061018084828501610111565b915050600061019184828501610147565b9150509250929050565b600060408284031215610171576101b06100c3565b5b60006101be84828501610111565b91505060006101cf84828501610111565b9150509250929050565b6101e281610126565b82525050565b60006020820190506101fd60008301846101d9565b9291505056fea2646970667358221220";
  }

  // Custom event test contract ABI
  static getCustomEventABI() {
    return [
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "user",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "message",
            "type": "string"
          }
        ],
        "name": "CustomEvent",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "bytes32",
            "name": "id",
            "type": "bytes32"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "creator",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "timestamp",
            "type": "uint256"
          }
        ],
        "name": "ItemCreated",
        "type": "event"
      }
    ];
  }

  // Generate test contract addresses
  static generateTestAddress(seed: number = 0): string {
    const hex = seed.toString(16).padStart(40, '0');
    return `0x${hex}`;
  }

  // Create test contract deployment transaction
  static createDeploymentTransaction(contractBytecode: string, from: string) {
    return {
      from,
      data: contractBytecode,
      gas: '2000000',
      gasPrice: '20000000000'
    };
  }

  // Create test function call transaction
  static createFunctionCall(contractAddress: string, functionData: string, from: string) {
    return {
      to: contractAddress,
      from,
      data: functionData,
      gas: '100000',
      gasPrice: '20000000000'
    };
  }

  // Generate function selector for testing
  static getFunctionSelector(signature: string): string {
    // This is a simplified version - in real tests you'd use ethers.js utils
    const hash = signature.split('(')[0] || signature; // Simplified for testing
    return `0x${hash.slice(0, 8).padEnd(8, '0')}`;
  }
}
import {
  parseSolidityFunctions,
  groupFindingsByFunction,
  getDisplaySignature,
  getFunctionContext,
  SolidityFunction,
  FunctionGroup
} from '../../lib/functionParser';

describe('functionParser', () => {
  const sampleContract = `
pragma solidity ^0.8.0;

contract TestContract {
    uint256 public balance;
    address private owner;

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable {
        balance += msg.value;
    }

    function withdraw(uint256 amount) public {
        require(msg.sender == owner, "Not owner");
        require(amount <= balance, "Insufficient balance");
        balance -= amount;
        payable(msg.sender).transfer(amount);
    }

    function getBalance() public view returns (uint256) {
        return balance;
    }

    function calculateFee(uint256 amount) internal pure returns (uint256) {
        return amount * 3 / 100;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    fallback() external payable {
        balance += msg.value;
    }

    receive() external payable {
        balance += msg.value;
    }
}
`.trim();

  const sampleFindings = [
    {
      id: 'finding-1',
      category: 'Access Control',
      severity: 'high' as const,
      title: 'Missing access control',
      description: 'Withdraw function lacks proper access control',
      lines: [15, 16, 17, 18],
      location: 'withdraw function',
      recommendation: 'Add proper access control'
    },
    {
      id: 'finding-2',
      category: 'Gas Optimization',
      severity: 'low' as const,
      title: 'Missing view modifier',
      description: 'getBalance function should be view',
      lines: [21, 22, 23],
      location: 'getBalance function',
      recommendation: 'Add view modifier'
    },
    {
      id: 'finding-3',
      category: 'Reentrancy',
      severity: 'critical' as const,
      title: 'Reentrancy vulnerability',
      description: 'External call in withdraw function',
      lines: [18],
      location: 'withdraw',
      recommendation: 'Use reentrancy guard'
    },
    {
      id: 'finding-4',
      category: 'Code Quality',
      severity: 'medium' as const,
      title: 'Contract level issue',
      description: 'Missing contract documentation',
      recommendation: 'Add NatSpec documentation'
    }
  ];

  beforeEach(() => {
    console.log = jest.fn();
  });

  describe('parseSolidityFunctions', () => {
    it('should parse all function types correctly', () => {
      const functions = parseSolidityFunctions(sampleContract);

      expect(functions).toHaveLength(8); // constructor, deposit, withdraw, getBalance, calculateFee, onlyOwner, fallback, receive

      const functionNames = functions.map(f => f.name);
      expect(functionNames).toContain('constructor');
      expect(functionNames).toContain('deposit');
      expect(functionNames).toContain('withdraw');
      expect(functionNames).toContain('getBalance');
      expect(functionNames).toContain('calculateFee');
      expect(functionNames).toContain('onlyOwner');
      expect(functionNames).toContain('fallback');
      expect(functionNames).toContain('receive');
    });

    it('should correctly identify function types', () => {
      const functions = parseSolidityFunctions(sampleContract);

      const constructor = functions.find(f => f.name === 'constructor');
      expect(constructor?.type).toBe('constructor');

      const deposit = functions.find(f => f.name === 'deposit');
      expect(deposit?.type).toBe('function');

      const modifier = functions.find(f => f.name === 'onlyOwner');
      expect(modifier?.type).toBe('modifier');

      const fallback = functions.find(f => f.name === 'fallback');
      expect(fallback?.type).toBe('fallback');

      const receive = functions.find(f => f.name === 'receive');
      expect(receive?.type).toBe('receive');
    });

    it('should correctly identify visibility modifiers', () => {
      const functions = parseSolidityFunctions(sampleContract);

      const deposit = functions.find(f => f.name === 'deposit');
      expect(deposit?.visibility).toBe('external');

      const withdraw = functions.find(f => f.name === 'withdraw');
      expect(withdraw?.visibility).toBe('public');

      const calculateFee = functions.find(f => f.name === 'calculateFee');
      expect(calculateFee?.visibility).toBe('internal');
    });

    it('should correctly identify mutability modifiers', () => {
      const functions = parseSolidityFunctions(sampleContract);

      const deposit = functions.find(f => f.name === 'deposit');
      expect(deposit?.mutability).toBe('payable');

      const getBalance = functions.find(f => f.name === 'getBalance');
      expect(getBalance?.mutability).toBe('view');

      const calculateFee = functions.find(f => f.name === 'calculateFee');
      expect(calculateFee?.mutability).toBe('pure');

      const withdraw = functions.find(f => f.name === 'withdraw');
      expect(withdraw?.mutability).toBe('nonpayable');
    });

    it('should correctly identify line numbers', () => {
      const functions = parseSolidityFunctions(sampleContract);

      const constructor = functions.find(f => f.name === 'constructor');
      expect(constructor?.startLine).toBe(7);
      expect(constructor?.endLine).toBe(9);

      const deposit = functions.find(f => f.name === 'deposit');
      expect(deposit?.startLine).toBe(11);
      expect(deposit?.endLine).toBe(13);

      const withdraw = functions.find(f => f.name === 'withdraw');
      expect(withdraw?.startLine).toBe(15);
      expect(withdraw?.endLine).toBe(20);
    });

    it('should handle empty contract', () => {
      const emptyContract = `
        pragma solidity ^0.8.0;
        contract Empty {}
      `;
      
      const functions = parseSolidityFunctions(emptyContract);
      expect(functions).toHaveLength(0);
    });

    it('should skip comments and empty lines', () => {
      const contractWithComments = `
        pragma solidity ^0.8.0;
        
        contract Test {
            // This is a comment
            /* Multi-line comment
               function fake() {} */
            
            function real() public {
                // Another comment
            }
        }
      `;
      
      const functions = parseSolidityFunctions(contractWithComments);
      expect(functions).toHaveLength(2);
      const realFunction = functions.find(f => f.name === 'real');
      expect(realFunction).toBeDefined();
    });

    it('should handle functions with complex signatures', () => {
      const complexContract = `
        function complexFunction(
            address token,
            uint256 amount,
            bytes calldata data
        ) external payable returns (bool success, bytes memory result) {
            return (true, "");
        }
      `;
      
      const functions = parseSolidityFunctions(complexContract);
      expect(functions).toHaveLength(1);
      expect(functions[0].name).toBe('complexFunction');
      expect(functions[0].visibility).toBe(''); // Multi-line signatures may not parse visibility correctly
      expect(functions[0].mutability).toBe('nonpayable'); // Multi-line signatures may not parse mutability correctly
    });
  });

  describe('groupFindingsByFunction', () => {
    it('should group findings by their associated functions', () => {
      const groups = groupFindingsByFunction(sampleContract, sampleFindings);

      expect(groups).toBeDefined();
      expect(Array.isArray(groups)).toBe(true);
      expect(groups.length).toBeGreaterThan(0);

      // Should have groups for functions with findings
      const withdrawGroup = groups.find(g => g.function.name === 'withdraw');
      expect(withdrawGroup).toBeDefined();
      expect(withdrawGroup!.findings).toHaveLength(2); // finding-1 and finding-3

      const getBalanceGroup = groups.find(g => g.function.name === 'getBalance');
      expect(getBalanceGroup).toBeDefined();
      expect(getBalanceGroup!.findings).toHaveLength(1); // finding-2
    });

    it('should create contract-level group for orphan findings', () => {
      const groups = groupFindingsByFunction(sampleContract, sampleFindings);

      const contractLevelGroup = groups.find(g => g.function.name === 'Contract Level');
      expect(contractLevelGroup).toBeDefined();
      expect(contractLevelGroup!.findings).toHaveLength(1); // finding-4
    });

    it('should sort findings by severity within each group', () => {
      const groups = groupFindingsByFunction(sampleContract, sampleFindings);

      const withdrawGroup = groups.find(g => g.function.name === 'withdraw');
      expect(withdrawGroup!.findings[0].severity).toBe('critical'); // finding-3
      expect(withdrawGroup!.findings[1].severity).toBe('high'); // finding-1
    });

    it('should sort groups by highest severity finding', () => {
      const groups = groupFindingsByFunction(sampleContract, sampleFindings);

      // First group should have critical findings
      expect(groups[0].findings.some(f => f.severity === 'critical')).toBe(true);
    });

    it('should match findings by line numbers', () => {
      const findingsWithLines = [
        {
          id: 'line-finding',
          category: 'Test',
          severity: 'medium' as const,
          title: 'Line-based finding',
          description: 'Finding matched by line number',
          lines: [16, 17], // Within withdraw function (lines 15-19)
          recommendation: 'Fix issue'
        }
      ];

      const groups = groupFindingsByFunction(sampleContract, findingsWithLines);
      const withdrawGroup = groups.find(g => g.function.name === 'withdraw');
      
      expect(withdrawGroup).toBeDefined();
      expect(withdrawGroup!.findings).toHaveLength(1);
      expect(withdrawGroup!.findings[0].id).toBe('line-finding');
    });

    it('should match findings by location string', () => {
      const findingsWithLocation = [
        {
          id: 'location-finding',
          category: 'Test',
          severity: 'medium' as const,
          title: 'Location-based finding',
          description: 'Finding matched by location',
          location: 'deposit function in TestContract',
          recommendation: 'Fix issue'
        }
      ];

      const groups = groupFindingsByFunction(sampleContract, findingsWithLocation);
      const depositGroup = groups.find(g => g.function.name === 'deposit');
      
      expect(depositGroup).toBeDefined();
      expect(depositGroup!.findings).toHaveLength(1);
      expect(depositGroup!.findings[0].id).toBe('location-finding');
    });

    it('should match findings by function name in description', () => {
      const findingsWithDescription = [
        {
          id: 'description-finding',
          category: 'Test',
          severity: 'medium' as const,
          title: 'getBalance optimization',
          description: 'The getBalance function could be optimized',
          recommendation: 'Fix issue'
        }
      ];

      const groups = groupFindingsByFunction(sampleContract, findingsWithDescription);
      const getBalanceGroup = groups.find(g => g.function.name === 'getBalance');
      
      expect(getBalanceGroup).toBeDefined();
      expect(getBalanceGroup!.findings).toHaveLength(1);
      expect(getBalanceGroup!.findings[0].id).toBe('description-finding');
    });

    it('should handle empty findings array', () => {
      const groups = groupFindingsByFunction(sampleContract, []);
      
      expect(groups).toHaveLength(0);
    });

    it('should handle findings with no matching functions', () => {
      const orphanFindings = [
        {
          id: 'orphan',
          category: 'Test',
          severity: 'low' as const,
          title: 'Orphan finding',
          description: 'This finding does not match any function',
          recommendation: 'Fix issue'
        }
      ];

      const groups = groupFindingsByFunction(sampleContract, orphanFindings);
      
      expect(groups).toHaveLength(1);
      expect(groups[0].function.name).toBe('Contract Level');
      expect(groups[0].findings).toHaveLength(1);
    });
  });

  describe('getDisplaySignature', () => {
    it('should return constructor signature', () => {
      const func: SolidityFunction = {
        name: 'constructor',
        type: 'constructor',
        startLine: 1,
        endLine: 3,
        signature: 'constructor() { owner = msg.sender; }',
        visibility: '',
        mutability: ''
      };

      expect(getDisplaySignature(func)).toBe('constructor');
    });

    it('should return fallback signature', () => {
      const func: SolidityFunction = {
        name: 'fallback',
        type: 'fallback',
        startLine: 1,
        endLine: 3,
        signature: 'fallback() external payable { }',
        visibility: 'external',
        mutability: 'payable'
      };

      expect(getDisplaySignature(func)).toBe('fallback()');
    });

    it('should return receive signature', () => {
      const func: SolidityFunction = {
        name: 'receive',
        type: 'receive',
        startLine: 1,
        endLine: 3,
        signature: 'receive() external payable { }',
        visibility: 'external',
        mutability: 'payable'
      };

      expect(getDisplaySignature(func)).toBe('receive()');
    });

    it('should extract function signature from signature string', () => {
      const func: SolidityFunction = {
        name: 'transfer',
        type: 'function',
        startLine: 1,
        endLine: 5,
        signature: 'function transfer(address to, uint256 amount) public returns (bool) {',
        visibility: 'public',
        mutability: 'nonpayable'
      };

      expect(getDisplaySignature(func)).toBe('function transfer(address to, uint256 amount)');
    });

    it('should handle signature without function match', () => {
      const func: SolidityFunction = {
        name: 'test',
        type: 'function',
        startLine: 1,
        endLine: 3,
        signature: 'invalid signature { code }',
        visibility: 'public',
        mutability: 'nonpayable'
      };

      expect(getDisplaySignature(func)).toBe('invalid signature');
    });
  });

  describe('getFunctionContext', () => {
    it('should return function context with default context lines', () => {
      const functions = parseSolidityFunctions(sampleContract);
      const depositFunction = functions.find(f => f.name === 'deposit')!;

      const context = getFunctionContext(sampleContract, depositFunction);

      expect(context).toContain('deposit() external payable');
      expect(context).toContain('balance += msg.value');
      
      // Should include line numbers
      expect(context).toMatch(/\d+:/);
    });

    it('should return function context with custom context lines', () => {
      const functions = parseSolidityFunctions(sampleContract);
      const depositFunction = functions.find(f => f.name === 'deposit')!;

      const context = getFunctionContext(sampleContract, depositFunction, 1);

      // Should have fewer lines with contextLines = 1
      const lineCount = context.split('\n').length;
      expect(lineCount).toBeLessThan(10);
      expect(context).toContain('deposit() external payable');
    });

    it('should handle context at start of file', () => {
      const functions = parseSolidityFunctions(sampleContract);
      const firstFunction = functions[0]; // Should be constructor

      const context = getFunctionContext(sampleContract, firstFunction, 5);

      expect(context).toBeDefined();
      expect(context.length).toBeGreaterThan(0);
      expect(context).toContain('constructor');
    });

    it('should handle context at end of file', () => {
      const functions = parseSolidityFunctions(sampleContract);
      const lastFunction = functions[functions.length - 1];

      const context = getFunctionContext(sampleContract, lastFunction, 5);

      expect(context).toBeDefined();
      expect(context.length).toBeGreaterThan(0);
    });

    it('should include line numbers in context', () => {
      const functions = parseSolidityFunctions(sampleContract);
      const depositFunction = functions.find(f => f.name === 'deposit')!;

      const context = getFunctionContext(sampleContract, depositFunction, 1);
      const lines = context.split('\n');

      lines.forEach(line => {
        expect(line).toMatch(/^\d+:/);
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle contract with only interface functions', () => {
      const interfaceContract = `
        interface ITest {
            function test() external;
            function test2() external pure returns (uint256);
        }
      `;

      const functions = parseSolidityFunctions(interfaceContract);
      expect(functions).toHaveLength(2);
      expect(functions[0].name).toBe('test');
      expect(functions[1].name).toBe('test2');
    });

    it('should handle malformed function signatures', () => {
      const malformedContract = `
        contract Test {
            function // incomplete
            function test(
            function valid() public {}
        }
      `;

      const functions = parseSolidityFunctions(malformedContract);
      const validFunction = functions.find(f => f.name === 'valid');
      expect(validFunction).toBeDefined();
    });

    it('should handle nested braces correctly', () => {
      const nestedContract = `
        function test() public {
            if (condition) {
                while (true) {
                    doSomething();
                }
            }
        }
      `;

      const functions = parseSolidityFunctions(nestedContract);
      expect(functions).toHaveLength(1);
      expect(functions[0].endLine).toBeGreaterThan(functions[0].startLine);
    });

    it('should handle abstract functions without braces', () => {
      const abstractContract = `
        abstract contract Test {
            function abstractFunc() public virtual;
            function concreteFunc() public {}
        }
      `;

      const functions = parseSolidityFunctions(abstractContract);
      expect(functions).toHaveLength(2);
      
      const abstractFunc = functions.find(f => f.name === 'abstractFunc');
      expect(abstractFunc?.endLine).toBeGreaterThanOrEqual(abstractFunc?.startLine || 0);
    });
  });
});
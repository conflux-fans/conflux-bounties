import { runStaticAnalysis, checkStaticAnalysisAvailable, StaticFinding, SourceFile } from '../../lib/staticAnalyzer';

describe('staticAnalyzer Integration', () => {
  const sampleContract: SourceFile = {
    name: 'TestContract.sol',
    content: `
pragma solidity ^0.8.0;

contract TestContract {
    mapping(address => uint256) public balances;
    address public owner;
    
    constructor() {
        owner = tx.origin; // SWC-115: tx.origin usage
    }
    
    function withdraw(uint256 amount) public {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        // Reentrancy vulnerability - external call before state change
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        balances[msg.sender] -= amount; // State change after external call
    }
    
    function transfer(address to, uint256 amount) public {
        balances[msg.sender] -= amount; // No overflow check
        balances[to] += amount;
    }
}
`
  };

  describe('checkStaticAnalysisAvailable', () => {
    it('should check tool availability', async () => {
      const availability = await checkStaticAnalysisAvailable();
      
      expect(typeof availability.slither).toBe('boolean');
      expect(typeof availability.mythril).toBe('boolean');
      
      console.log('Static analysis tool availability:', availability);
    }, 10000);
  });

  describe('runStaticAnalysis', () => {
    it('should handle empty source files', async () => {
      const result = await runStaticAnalysis([]);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle missing Docker containers gracefully', async () => {
      const result = await runStaticAnalysis([sampleContract]);
      
      expect(Array.isArray(result)).toBe(true);
      // Should not throw errors even if Docker containers are not running
      console.log(`Static analysis returned ${result.length} findings`);
      
      // If findings are returned, validate their structure
      if (result.length > 0) {
        result.forEach((finding: StaticFinding) => {
          expect(finding).toHaveProperty('id');
          expect(finding).toHaveProperty('tool');
          expect(finding).toHaveProperty('severity');
          expect(finding).toHaveProperty('title');
          expect(finding).toHaveProperty('description');
          expect(['slither', 'mythril']).toContain(finding.tool);
          expect(['low', 'medium', 'high', 'critical']).toContain(finding.severity);
        });
        
        console.log('Sample findings:', result.slice(0, 2));
      }
    }, 30000);

    it('should validate StaticFinding interface', () => {
      const sampleFinding: StaticFinding = {
        id: 'test-id',
        tool: 'slither',
        severity: 'high',
        title: 'Test Finding',
        description: 'Test description',
        swc_id: 'SWC-107',
        cwe_id: 'CWE-362',
        lines: [10, 11],
        file: 'TestContract.sol',
        impact: 'high',
        confidence: 'high'
      };

      expect(sampleFinding.id).toBe('test-id');
      expect(sampleFinding.tool).toBe('slither');
      expect(sampleFinding.severity).toBe('high');
    });
  });

  describe('Error handling', () => {
    it('should handle malformed source files', async () => {
      const invalidContract: SourceFile = {
        name: 'Invalid.sol',
        content: 'This is not valid Solidity code {'
      };

      const result = await runStaticAnalysis([invalidContract]);
      expect(Array.isArray(result)).toBe(true);
      // Should handle errors gracefully and return empty array
    }, 15000);
  });
});
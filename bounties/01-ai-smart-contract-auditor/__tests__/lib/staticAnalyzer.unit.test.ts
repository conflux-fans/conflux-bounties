import { 
  mapSlitherSeverity,
  mapMythrilSeverity,
  StaticFinding, 
  SourceFile
} from '../../lib/staticAnalyzer';

describe('staticAnalyzer unit tests', () => {
  describe('mapSlitherSeverity', () => {
    it('should return critical for high impact and high confidence', () => {
      expect(mapSlitherSeverity('High', 'High')).toBe('critical');
      expect(mapSlitherSeverity('HIGH', 'HIGH')).toBe('critical');
      expect(mapSlitherSeverity('high', 'high')).toBe('critical');
    });

    it('should return high for high impact medium confidence or medium impact high confidence', () => {
      expect(mapSlitherSeverity('High', 'Medium')).toBe('high');
      expect(mapSlitherSeverity('Medium', 'High')).toBe('high');
      expect(mapSlitherSeverity('HIGH', 'MEDIUM')).toBe('high');
      expect(mapSlitherSeverity('MEDIUM', 'HIGH')).toBe('high');
    });

    it('should return medium for medium impact medium confidence or high impact low confidence', () => {
      expect(mapSlitherSeverity('Medium', 'Medium')).toBe('medium');
      expect(mapSlitherSeverity('High', 'Low')).toBe('medium');
      expect(mapSlitherSeverity('MEDIUM', 'MEDIUM')).toBe('medium');
      expect(mapSlitherSeverity('HIGH', 'LOW')).toBe('medium');
    });

    it('should return low for all other combinations', () => {
      expect(mapSlitherSeverity('Low', 'High')).toBe('low');
      expect(mapSlitherSeverity('Low', 'Medium')).toBe('low');
      expect(mapSlitherSeverity('Low', 'Low')).toBe('low');
      expect(mapSlitherSeverity('Medium', 'Low')).toBe('low');
      expect(mapSlitherSeverity('Unknown', 'Unknown')).toBe('low');
      expect(mapSlitherSeverity('', '')).toBe('low');
    });

    it('should handle case insensitive input', () => {
      expect(mapSlitherSeverity('hIgH', 'HiGh')).toBe('critical');
      expect(mapSlitherSeverity('MeDiUm', 'lOw')).toBe('low');
    });
  });

  describe('mapMythrilSeverity', () => {
    it('should map high to critical', () => {
      expect(mapMythrilSeverity('High')).toBe('critical');
      expect(mapMythrilSeverity('HIGH')).toBe('critical');
      expect(mapMythrilSeverity('high')).toBe('critical');
    });

    it('should map medium to high', () => {
      expect(mapMythrilSeverity('Medium')).toBe('high');
      expect(mapMythrilSeverity('MEDIUM')).toBe('high');
      expect(mapMythrilSeverity('medium')).toBe('high');
    });

    it('should map low to medium', () => {
      expect(mapMythrilSeverity('Low')).toBe('medium');
      expect(mapMythrilSeverity('LOW')).toBe('medium');
      expect(mapMythrilSeverity('low')).toBe('medium');
    });

    it('should map unknown values to low', () => {
      expect(mapMythrilSeverity('Unknown')).toBe('low');
      expect(mapMythrilSeverity('Critical')).toBe('low');
      expect(mapMythrilSeverity('')).toBe('low');
      expect(mapMythrilSeverity('invalid')).toBe('low');
    });

    it('should handle case insensitive input', () => {
      expect(mapMythrilSeverity('HiGh')).toBe('critical');
      expect(mapMythrilSeverity('MeDiUm')).toBe('high');
      expect(mapMythrilSeverity('LoW')).toBe('medium');
    });
  });

  describe('StaticFinding interface', () => {
    it('should validate StaticFinding interface properties', () => {
      const finding: StaticFinding = {
        id: 'finding-1',
        tool: 'mythril',
        swc_id: 'SWC-101',
        cwe_id: 'CWE-862',
        severity: 'critical',
        title: 'Authorization through tx.origin',
        description: 'The contract uses tx.origin for authorization',
        lines: [1, 2, 3],
        file: 'Contract.sol',
        impact: 'High impact vulnerability',
        confidence: 'High'
      };

      expect(finding.id).toBe('finding-1');
      expect(finding.tool).toBe('mythril');
      expect(finding.swc_id).toBe('SWC-101');
      expect(finding.cwe_id).toBe('CWE-862');
      expect(finding.severity).toBe('critical');
      expect(finding.title).toBe('Authorization through tx.origin');
      expect(finding.description).toBe('The contract uses tx.origin for authorization');
      expect(finding.lines).toEqual([1, 2, 3]);
      expect(finding.file).toBe('Contract.sol');
      expect(finding.impact).toBe('High impact vulnerability');
      expect(finding.confidence).toBe('High');
    });
  });

  describe('SourceFile interface', () => {
    it('should validate SourceFile interface properties', () => {
      const sourceFile: SourceFile = {
        name: 'TestContract.sol',
        content: 'pragma solidity ^0.8.0;\ncontract Test {}'
      };

      expect(sourceFile.name).toBe('TestContract.sol');
      expect(sourceFile.content).toBe('pragma solidity ^0.8.0;\ncontract Test {}');
    });

    it('should handle empty and complex source files', () => {
      const emptySrc: SourceFile = { name: 'empty.sol', content: '' };
      const complexSrc: SourceFile = { 
        name: 'complex.sol', 
        content: `
pragma solidity ^0.8.0;

import "./interfaces/IExample.sol";

contract ComplexContract {
    mapping(address => uint256) public balances;
    
    function complexFunction(address user) external view returns (uint256) {
        return balances[user];
    }
}
        `.trim()
      };

      expect(emptySrc.content).toBe('');
      expect(complexSrc.name).toBe('complex.sol');
      expect(complexSrc.content).toContain('pragma solidity');
      expect(complexSrc.content).toContain('mapping');
    });
  });
});
import { runStaticAnalysis, StaticFinding, SourceFile } from '../../lib/staticAnalyzer';

describe('staticAnalyzer', () => {
  describe('runStaticAnalysis', () => {
    const mockSourceFiles: SourceFile[] = [
      {
        name: 'Contract.sol',
        content: 'pragma solidity ^0.8.0; contract Test { function test() {} }'
      }
    ];

    beforeEach(() => {
      jest.clearAllMocks();
      console.log = jest.fn();
      console.warn = jest.fn();
    });

    it('should return empty array when no source files provided', async () => {
      const result = await runStaticAnalysis([]);
      
      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith('[StaticAnalysis] No source files provided, returning empty results');
    });

    it('should return empty array when null source files provided', async () => {
      const result = await runStaticAnalysis(null as any);
      
      expect(result).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith('[StaticAnalysis] No source files provided, returning empty results');
    });

    it('should return empty array and log appropriate messages for valid source files', async () => {
      const result = await runStaticAnalysis(mockSourceFiles);
      
      expect(result).toEqual([]);
      expect(console.log).toHaveBeenCalledWith('[StaticAnalysis] Static analysis tools (Slither/Mythril) disabled - using AI-only analysis');
      expect(console.log).toHaveBeenCalledWith('[StaticAnalysis] Skipping Docker-based static analysis for 1 source files');
      expect(console.log).toHaveBeenCalledWith('[StaticAnalysis] Total findings: 0 (AI analysis will be performed separately)');
    });

    it('should handle multiple source files', async () => {
      const multipleFiles: SourceFile[] = [
        { name: 'Contract1.sol', content: 'pragma solidity ^0.8.0; contract Test1 {}' },
        { name: 'Contract2.sol', content: 'pragma solidity ^0.8.0; contract Test2 {}' },
        { name: 'Contract3.sol', content: 'pragma solidity ^0.8.0; contract Test3 {}' }
      ];

      const result = await runStaticAnalysis(multipleFiles);
      
      expect(result).toEqual([]);
      expect(console.log).toHaveBeenCalledWith('[StaticAnalysis] Skipping Docker-based static analysis for 3 source files');
    });

    it('should return StaticFinding array type', async () => {
      const result = await runStaticAnalysis(mockSourceFiles);
      
      expect(Array.isArray(result)).toBe(true);
      // Verify it can hold StaticFinding objects
      const mockFinding: StaticFinding = {
        id: 'test-id',
        tool: 'slither',
        severity: 'high',
        title: 'Test Finding',
        description: 'Test description'
      };
      result.push(mockFinding);
      expect(result[0]).toMatchObject(mockFinding);
    });

    it('should handle edge cases gracefully', async () => {
      // Empty content files
      const emptyContentFiles: SourceFile[] = [
        { name: 'Empty.sol', content: '' }
      ];

      const result = await runStaticAnalysis(emptyContentFiles);
      expect(result).toEqual([]);

      // Very long content
      const longContentFiles: SourceFile[] = [
        { name: 'Long.sol', content: 'a'.repeat(10000) }
      ];

      const result2 = await runStaticAnalysis(longContentFiles);
      expect(result2).toEqual([]);
    });

    it('should validate StaticFinding interface properties', () => {
      // Test that StaticFinding interface has expected properties
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

    it('should validate SourceFile interface properties', () => {
      const sourceFile: SourceFile = {
        name: 'TestContract.sol',
        content: 'pragma solidity ^0.8.0;\ncontract Test {}'
      };

      expect(sourceFile.name).toBe('TestContract.sol');
      expect(sourceFile.content).toBe('pragma solidity ^0.8.0;\ncontract Test {}');
    });
  });
});
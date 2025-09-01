import { generateReports } from '../../lib/reportGenerator';
import * as swcCweMap from '../../lib/swcCweMap';

// Mock the swcCweMap module
jest.mock('../../lib/swcCweMap', () => ({
  getSWCDescription: jest.fn(),
  getCWELink: jest.fn(),
  getRelatedCWEs: jest.fn()
}));

const mockSwcCweMap = swcCweMap as jest.Mocked<typeof swcCweMap>;

describe('reportGenerator', () => {
  const mockFindings = [
    {
      id: 'finding-1',
      category: 'Reentrancy',
      severity: 'critical' as const,
      swc_id: 'SWC-107',
      cwe_id: 'CWE-841',
      title: 'Reentrancy vulnerability in withdraw function',
      description: 'The withdraw function is vulnerable to reentrancy attacks due to external calls before state changes.',
      lines: [15, 16, 17],
      code_snippet: 'function withdraw() {\n    msg.sender.call{value: balance}("");\n    balance = 0;\n}',
      recommendation: 'Use the checks-effects-interactions pattern and consider implementing a reentrancy guard.',
      confidence: 95,
      impact: 'Attacker can drain contract funds through recursive calls.'
    },
    {
      id: 'finding-2',
      category: 'Access Control',
      severity: 'high' as const,
      swc_id: 'SWC-105',
      cwe_id: 'CWE-284',
      title: 'Missing access control on sensitive function',
      description: 'The emergencyWithdraw function lacks proper access control mechanisms.',
      lines: [25, 26],
      code_snippet: 'function emergencyWithdraw() public {\n    payable(msg.sender).transfer(address(this).balance);\n}',
      recommendation: 'Add onlyOwner modifier or equivalent access control.',
      confidence: 90
    },
    {
      id: 'finding-3',
      category: 'Gas Optimization',
      severity: 'medium' as const,
      title: 'Inefficient storage operations',
      description: 'Multiple storage reads in loop can be optimized.',
      lines: [30, 31, 32],
      recommendation: 'Cache storage variables in memory before loop.',
      confidence: 80
    },
    {
      id: 'finding-4',
      category: 'Code Quality',
      severity: 'low' as const,
      title: 'Missing error messages',
      description: 'Require statements lack descriptive error messages.',
      lines: [40],
      code_snippet: 'require(amount > 0);',
      recommendation: 'Add descriptive error messages to all require statements.',
      confidence: 75
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockSwcCweMap.getSWCDescription.mockReturnValue('SWC Description');
    mockSwcCweMap.getCWELink.mockReturnValue('https://cwe.mitre.org/data/definitions/123.html');
    mockSwcCweMap.getRelatedCWEs.mockReturnValue(['CWE-456', 'CWE-789']);
  });

  describe('generateReports', () => {
    it('should generate both JSON and markdown reports', () => {
      const reports = generateReports(mockFindings);

      expect(reports).toHaveProperty('json');
      expect(reports).toHaveProperty('markdown');
      expect(typeof reports.json).toBe('object');
      expect(typeof reports.markdown).toBe('string');
    });

    it('should handle empty findings array', () => {
      const reports = generateReports([]);

      expect(reports.json.summary.totalFindings).toBe(0);
      expect(reports.json.findings).toHaveLength(0);
      expect(reports.markdown).toContain('0 findings');
    });
  });

  describe('JSON Report Generation', () => {
    it('should generate correct summary statistics', () => {
      const reports = generateReports(mockFindings);
      const summary = reports.json.summary;

      expect(summary.totalFindings).toBe(4);
      expect(summary.severityBreakdown).toEqual({
        critical: 1,
        high: 1,
        medium: 1,
        low: 1
      });
      expect(summary.categories).toEqual(['Reentrancy', 'Access Control', 'Gas Optimization', 'Code Quality']);
      expect(summary.overallRisk).toBe('CRITICAL');
    });

    it('should include all finding properties in JSON format', () => {
      const reports = generateReports(mockFindings);
      const findings = reports.json.findings;

      expect(findings).toHaveLength(4);
      
      const criticalFinding = findings.find((f: any) => f.severity === 'critical');
      expect(criticalFinding).toMatchObject({
        id: 'finding-1',
        category: 'Reentrancy',
        severity: 'critical',
        swc_id: 'SWC-107',
        cwe_id: 'CWE-841',
        title: 'Reentrancy vulnerability in withdraw function',
        description: expect.any(String),
        lines: [15, 16, 17],
        code_snippet: expect.any(String),
        recommendation: expect.any(String),
        confidence: 95,
        impact: expect.any(String),
        references: expect.any(Array)
      });
    });

    it('should include metadata in JSON report', () => {
      const reports = generateReports(mockFindings);
      const metadata = reports.json.metadata;

      expect(metadata).toMatchObject({
        generatedAt: expect.any(String),
        version: '1.0.0',
        engine: 'AI Smart Contract Auditor'
      });

      // Check that generatedAt is a valid ISO string
      expect(() => new Date(metadata.generatedAt)).not.toThrow();
    });

    it('should generate references for findings with SWC/CWE IDs', () => {
      const reports = generateReports(mockFindings);
      const criticalFinding = reports.json.findings.find((f: any) => f.severity === 'critical');

      expect(criticalFinding.references).toBeDefined();
      expect(Array.isArray(criticalFinding.references)).toBe(true);
      expect(criticalFinding.references.length).toBeGreaterThan(0);

      expect(mockSwcCweMap.getSWCDescription).toHaveBeenCalledWith('SWC-107');
      expect(mockSwcCweMap.getCWELink).toHaveBeenCalledWith('CWE-841');
      expect(mockSwcCweMap.getRelatedCWEs).toHaveBeenCalledWith('SWC-107');
    });
  });

  describe('Markdown Report Generation', () => {
    it('should generate markdown with proper structure', () => {
      const reports = generateReports(mockFindings);
      const markdown = reports.markdown;

      expect(markdown).toContain('# Smart Contract Security Audit Report');
      expect(markdown).toContain('## Executive Summary');
      expect(markdown).toContain('### Severity Breakdown');
      expect(markdown).toContain('## Detailed Findings');
      expect(markdown).toContain('## Categories Summary');
    });

    it('should include severity breakdown with emojis', () => {
      const reports = generateReports(mockFindings);
      const markdown = reports.markdown;

      expect(markdown).toContain('🔴 **Critical**: 1');
      expect(markdown).toContain('🟠 **High**: 1');
      expect(markdown).toContain('🟡 **Medium**: 1');
      expect(markdown).toContain('🟢 **Low**: 1');
    });

    it('should group findings by severity in correct order', () => {
      const reports = generateReports(mockFindings);
      const markdown = reports.markdown;

      const criticalIndex = markdown.indexOf('🔴 CRITICAL Severity');
      const highIndex = markdown.indexOf('🟠 HIGH Severity');
      const mediumIndex = markdown.indexOf('🟡 MEDIUM Severity');
      const lowIndex = markdown.indexOf('🟢 LOW Severity');

      expect(criticalIndex).toBeLessThan(highIndex);
      expect(highIndex).toBeLessThan(mediumIndex);
      expect(mediumIndex).toBeLessThan(lowIndex);
    });

    it('should include detailed finding information', () => {
      const reports = generateReports(mockFindings);
      const markdown = reports.markdown;

      expect(markdown).toContain('CRITICAL-1: Reentrancy vulnerability in withdraw function');
      expect(markdown).toContain('**Category**: Reentrancy');
      expect(markdown).toContain('**Confidence**: 95%');
      expect(markdown).toContain('**SWC Classification**: SWC-107');
      expect(markdown).toContain('**CWE Classification**: CWE-841');
      expect(markdown).toContain('**Lines**: 15, 16, 17');
    });

    it('should include code snippets when available', () => {
      const reports = generateReports(mockFindings);
      const markdown = reports.markdown;

      expect(markdown).toContain('**Code Snippet**:');
      expect(markdown).toContain('```solidity');
      expect(markdown).toContain('function withdraw() {');
      expect(markdown).toContain('msg.sender.call{value: balance}("");');
    });

    it('should include references section', () => {
      const reports = generateReports(mockFindings);
      const markdown = reports.markdown;

      expect(markdown).toContain('**References**:');
      expect(markdown).toContain('[SWC-107: Smart Contract Weakness Classification]');
      expect(markdown).toContain('[CWE-841: Common Weakness Enumeration]');
    });

    it('should include categories summary', () => {
      const reports = generateReports(mockFindings);
      const markdown = reports.markdown;

      expect(markdown).toContain('## Categories Summary');
      expect(markdown).toContain('**Reentrancy**: 1 findings');
      expect(markdown).toContain('**Access Control**: 1 findings');
      expect(markdown).toContain('**Gas Optimization**: 1 findings');
      expect(markdown).toContain('**Code Quality**: 1 findings');
    });

    it('should include generation timestamp', () => {
      const reports = generateReports(mockFindings);
      const markdown = reports.markdown;

      expect(markdown).toContain('*Report generated on');
      expect(markdown).toContain('by AI Smart Contract Auditor*');
    });

    it('should handle findings without optional fields gracefully', () => {
      const minimalFindings = [
        {
          id: 'minimal-1',
          category: 'Test',
          severity: 'medium' as const,
          title: 'Minimal finding',
          description: 'Basic description',
          lines: [1],
          recommendation: 'Fix it',
          confidence: 80
        }
      ];

      const reports = generateReports(minimalFindings);
      const markdown = reports.markdown;

      expect(markdown).toContain('MEDIUM-1: Minimal finding');
      expect(markdown).toContain('**Category**: Test');
      expect(markdown).not.toContain('**SWC Classification**');
      expect(markdown).not.toContain('**CWE Classification**');
      expect(markdown).not.toContain('**Code Snippet**');
      expect(markdown).not.toContain('**Impact**');
    });
  });

  describe('Overall Risk Determination', () => {
    it('should return CRITICAL for any critical findings', () => {
      const criticalFindings = [{ ...mockFindings[0], severity: 'critical' as const }];
      const reports = generateReports(criticalFindings);
      
      expect(reports.json.summary.overallRisk).toBe('CRITICAL');
    });

    it('should return HIGH for high severity findings', () => {
      const highFindings = [{ ...mockFindings[0], severity: 'high' as const }];
      const reports = generateReports(highFindings);
      
      expect(reports.json.summary.overallRisk).toBe('HIGH');
    });

    it('should return HIGH for many medium findings', () => {
      const manyMediumFindings = Array(3).fill(null).map((_, i) => ({
        ...mockFindings[0],
        id: `medium-${i}`,
        severity: 'medium' as const
      }));
      const reports = generateReports(manyMediumFindings);
      
      expect(reports.json.summary.overallRisk).toBe('HIGH');
    });

    it('should return MEDIUM for few medium findings', () => {
      const fewMediumFindings = [{ ...mockFindings[0], severity: 'medium' as const }];
      const reports = generateReports(fewMediumFindings);
      
      expect(reports.json.summary.overallRisk).toBe('MEDIUM');
    });

    it('should return MEDIUM for many low findings', () => {
      const manyLowFindings = Array(6).fill(null).map((_, i) => ({
        ...mockFindings[0],
        id: `low-${i}`,
        severity: 'low' as const
      }));
      const reports = generateReports(manyLowFindings);
      
      expect(reports.json.summary.overallRisk).toBe('MEDIUM');
    });

    it('should return LOW for few low findings', () => {
      const fewLowFindings = [{ ...mockFindings[0], severity: 'low' as const }];
      const reports = generateReports(fewLowFindings);
      
      expect(reports.json.summary.overallRisk).toBe('LOW');
    });

    it('should return MINIMAL for no findings', () => {
      const reports = generateReports([]);
      
      expect(reports.json.summary.overallRisk).toBe('MINIMAL');
    });
  });

  describe('Reference Generation', () => {
    it('should generate SWC references when SWC ID is present', () => {
      mockSwcCweMap.getSWCDescription.mockReturnValue('Test SWC Description');
      
      const reports = generateReports(mockFindings);
      const finding = reports.json.findings.find((f: any) => f.swc_id === 'SWC-107');
      
      const swcRef = finding.references.find((ref: any) => ref.title.includes('SWC-107'));
      expect(swcRef).toBeDefined();
      expect(swcRef.url).toBe('https://swcregistry.io/docs/SWC-107');
    });

    it('should generate CWE references when CWE ID is present', () => {
      mockSwcCweMap.getCWELink.mockReturnValue('https://cwe.mitre.org/data/definitions/841.html');
      
      const reports = generateReports(mockFindings);
      const finding = reports.json.findings.find((f: any) => f.cwe_id === 'CWE-841');
      
      const cweRef = finding.references.find((ref: any) => ref.title.includes('CWE-841'));
      expect(cweRef).toBeDefined();
      expect(cweRef.url).toBe('https://cwe.mitre.org/data/definitions/841.html');
    });

    it('should generate related CWE references', () => {
      mockSwcCweMap.getRelatedCWEs.mockReturnValue(['CWE-456']);
      mockSwcCweMap.getCWELink.mockImplementation((cweId) => 
        `https://cwe.mitre.org/data/definitions/${cweId.split('-')[1]}.html`
      );
      
      const reports = generateReports(mockFindings);
      const finding = reports.json.findings.find((f: any) => f.swc_id === 'SWC-107');
      
      const relatedCweRef = finding.references.find((ref: any) => ref.title.includes('CWE-456'));
      expect(relatedCweRef).toBeDefined();
      expect(relatedCweRef.url).toBe('https://cwe.mitre.org/data/definitions/456.html');
    });

    it('should handle missing SWC/CWE descriptions gracefully', () => {
      mockSwcCweMap.getSWCDescription.mockReturnValue(null);
      mockSwcCweMap.getCWELink.mockReturnValue(null);
      mockSwcCweMap.getRelatedCWEs.mockReturnValue([]);
      
      const reports = generateReports(mockFindings);
      const finding = reports.json.findings.find((f: any) => f.swc_id === 'SWC-107');
      
      expect(finding.references).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle findings with empty lines array', () => {
      const findingsWithEmptyLines = [{
        ...mockFindings[0],
        lines: []
      }];
      
      const reports = generateReports(findingsWithEmptyLines);
      expect(reports.markdown).toContain('**Lines**: ');
    });

    it('should handle very long descriptions and recommendations', () => {
      const longText = 'A'.repeat(1000);
      const findingsWithLongText = [{
        ...mockFindings[0],
        description: longText,
        recommendation: longText
      }];
      
      const reports = generateReports(findingsWithLongText);
      expect(reports.markdown).toContain(longText);
      expect(reports.json.findings[0].description).toBe(longText);
    });

    it('should handle special characters in findings', () => {
      const specialCharFindings = [{
        ...mockFindings[0],
        title: 'Finding with "quotes" and & symbols',
        description: 'Contains <tags> and {braces} and [brackets]',
        code_snippet: 'function test() { return "quoted string"; }'
      }];
      
      const reports = generateReports(specialCharFindings);
      expect(reports.markdown).toContain('Finding with "quotes" and & symbols');
      expect(reports.json.findings[0].title).toBe('Finding with "quotes" and & symbols');
    });

    it('should skip severity sections with no findings', () => {
      const onlyLowFindings = [{ ...mockFindings[3] }]; // Only low severity
      
      const reports = generateReports(onlyLowFindings);
      const markdown = reports.markdown;
      
      expect(markdown).not.toContain('🔴 CRITICAL Severity');
      expect(markdown).not.toContain('🟠 HIGH Severity');
      expect(markdown).not.toContain('🟡 MEDIUM Severity');
      expect(markdown).toContain('🟢 LOW Severity');
    });
  });
});
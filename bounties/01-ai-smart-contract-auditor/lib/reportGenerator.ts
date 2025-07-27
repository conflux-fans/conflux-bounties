import { getVulnerabilityCategoriesByType, VULNERABILITY_CATEGORIES } from './vulnerabilityCategories';

interface Finding {
  id: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  swc_id?: string;
  cwe_id?: string;
  title: string;
  description: string;
  lines?: number[];
  location?: string;
  recommendation?: string;
}

interface ReportData {
  findings: Finding[];
  categorizedFindings: {
    security: Finding[];
    gas_optimization: Finding[];
    code_quality: Finding[];
    other: Finding[];
  };
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    byCategory: {
      security: number;
      gas_optimization: number;
      code_quality: number;
      other: number;
    };
  };
}

export function generateReports(findings: Finding[]): { json: any; markdown: string } {
  // Categorize findings by type
  const categorizedFindings = categorizeFindings(findings);
  
  // Create summary statistics
  const summary = {
    total: findings.length,
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    byCategory: {
      security: categorizedFindings.security.length,
      gas_optimization: categorizedFindings.gas_optimization.length,
      code_quality: categorizedFindings.code_quality.length,
      other: categorizedFindings.other.length
    }
  };

  const reportData: ReportData = {
    findings,
    categorizedFindings,
    summary
  };

  const json = {
    ...reportData,
    generatedAt: new Date().toISOString(),
  };

  const markdown = generateMarkdownReport(reportData);

  return { json, markdown };
}

/**
 * Categorize findings by vulnerability type based on predefined categories
 */
function categorizeFindings(findings: Finding[]) {
  const categories = getVulnerabilityCategoriesByType();
  
  const categorized = {
    security: [] as Finding[],
    gas_optimization: [] as Finding[],
    code_quality: [] as Finding[],
    other: [] as Finding[]
  };

  findings.forEach(finding => {
    const category = finding.category.toLowerCase().replace(/\s+/g, '_');
    
    // Check if finding matches any predefined security categories
    const isSecurityFinding = categories.security.some(cat => 
      cat.id === category || 
      cat.name.toLowerCase() === finding.category.toLowerCase() ||
      cat.detection_patterns.some(pattern => 
        finding.description.toLowerCase().includes(pattern.toLowerCase())
      )
    );
    
    // Check gas optimization categories
    const isGasOptimization = categories.gas_optimization.some(cat => 
      cat.id === category || 
      cat.name.toLowerCase() === finding.category.toLowerCase() ||
      cat.detection_patterns.some(pattern => 
        finding.description.toLowerCase().includes(pattern.toLowerCase())
      )
    );
    
    // Check code quality categories
    const isCodeQuality = categories.code_quality.some(cat => 
      cat.id === category || 
      cat.name.toLowerCase() === finding.category.toLowerCase() ||
      cat.detection_patterns.some(pattern => 
        finding.description.toLowerCase().includes(pattern.toLowerCase())
      )
    );

    // Categorize finding
    if (isSecurityFinding) {
      categorized.security.push(finding);
    } else if (isGasOptimization) {
      categorized.gas_optimization.push(finding);
    } else if (isCodeQuality) {
      categorized.code_quality.push(finding);
    } else {
      categorized.other.push(finding);
    }
  });

  return categorized;
}

/**
 * Generate a categorized section of the markdown report
 */
function generateCategorizedSection(title: string, findings: Finding[], severityEmoji: any): string {
  if (findings.length === 0) {
    return '';
  }

  let section = `## ${title}

Found ${findings.length} issue${findings.length === 1 ? '' : 's'} in this category.

`;

  findings.forEach((finding, index) => {
    section += `### ${index + 1}. ${finding.title} ${severityEmoji[finding.severity]}

**Category**: ${finding.category}  
**Severity**: ${finding.severity.toUpperCase()}

**Description**: ${finding.description}

${finding.swc_id || finding.cwe_id ? `**Standards**: ${[finding.swc_id, finding.cwe_id].filter(Boolean).join(', ')}\n\n` : ''}${finding.location ? `**Location**: ${finding.location}\n\n` : ''}${finding.lines && finding.lines.length > 0 ? `**Affected Lines**: ${finding.lines.join(', ')}\n\n` : ''}${finding.recommendation ? `**💡 Recommendation**: ${finding.recommendation}\n\n` : ''}---

`;
  });

  return section;
}

function generateMarkdownReport(data: ReportData): string {
  const { findings, categorizedFindings, summary } = data;
  
  const severityEmoji = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  };

  // Legacy summary for backward compatibility
  const legacySummary = {
    total: findings.length,
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
  };

  let markdown = `# Smart Contract Audit Report

## Executive Summary

**Total Findings**: ${summary.total}

### Severity Distribution
- **Critical**: ${legacySummary.critical} ${severityEmoji.critical}
- **High**: ${legacySummary.high} ${severityEmoji.high}
- **Medium**: ${legacySummary.medium} ${severityEmoji.medium}
- **Low**: ${legacySummary.low} ${severityEmoji.low}

### Category Distribution
- **Security Issues**: ${summary.byCategory.security} findings
- **Gas Optimization**: ${summary.byCategory.gas_optimization} findings
- **Code Quality**: ${summary.byCategory.code_quality} findings
- **Other Issues**: ${summary.byCategory.other} findings

---

`;

  if (findings.length === 0) {
    markdown += `## Analysis Results

No security issues or code quality problems were detected during the comprehensive audit.

✅ **The contract appears to follow security best practices and coding standards.**
`;
  } else {
    // Generate categorized sections
    markdown += generateCategorizedSection('🔒 Security Issues', categorizedFindings.security, severityEmoji);
    markdown += generateCategorizedSection('⛽ Gas Optimization Opportunities', categorizedFindings.gas_optimization, severityEmoji);
    markdown += generateCategorizedSection('📝 Code Quality Improvements', categorizedFindings.code_quality, severityEmoji);
    
    if (categorizedFindings.other.length > 0) {
      markdown += generateCategorizedSection('🔍 Other Findings', categorizedFindings.other, severityEmoji);
    }
  }

  markdown += `
*Report generated on ${new Date().toLocaleString('en-US')}*
`;

  return markdown;
}
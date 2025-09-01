import { getSWCDescription, getCWELink, getRelatedCWEs } from './swcCweMap';

interface Finding {
  id: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  swc_id?: string;
  cwe_id?: string;
  title: string;
  description: string;
  lines: number[];
  code_snippet?: string;
  recommendation: string;
  confidence: number;
  impact?: string;
}

interface ReportFormats {
  json: any;
  markdown: string;
}

export function generateReports(findings: Finding[]): ReportFormats {
  const jsonReport = generateJSONReport(findings);
  const markdownReport = generateMarkdownReport(findings);
  
  return {
    json: jsonReport,
    markdown: markdownReport
  };
}

function generateJSONReport(findings: Finding[]) {
  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length
  };

  const categories = [...new Set(findings.map(f => f.category))];
  
  return {
    summary: {
      totalFindings: findings.length,
      severityBreakdown: severityCounts,
      categories: categories,
      overallRisk: determineOverallRisk(severityCounts)
    },
    findings: findings.map(finding => ({
      id: finding.id,
      category: finding.category,
      severity: finding.severity,
      swc_id: finding.swc_id,
      cwe_id: finding.cwe_id,
      title: finding.title,
      description: finding.description,
      lines: finding.lines,
      code_snippet: finding.code_snippet,
      recommendation: finding.recommendation,
      confidence: finding.confidence,
      impact: finding.impact,
      references: generateReferences(finding)
    })),
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      engine: 'AI Smart Contract Auditor'
    }
  };
}

function generateMarkdownReport(findings: Finding[]): string {
  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length
  };

  let markdown = `# Smart Contract Security Audit Report

## Executive Summary

This security audit identified **${findings.length} findings** across multiple categories.

### Severity Breakdown
- 🔴 **Critical**: ${severityCounts.critical}
- 🟠 **High**: ${severityCounts.high}  
- 🟡 **Medium**: ${severityCounts.medium}
- 🟢 **Low**: ${severityCounts.low}

**Overall Risk Level**: ${determineOverallRisk(severityCounts)}

---

## Detailed Findings

`;

  const severityOrder = ['critical', 'high', 'medium', 'low'];
  const severityEmojis = {
    critical: '🔴',
    high: '🟠', 
    medium: '🟡',
    low: '🟢'
  };

  severityOrder.forEach(severity => {
    const severityFindings = findings.filter(f => f.severity === severity);
    if (severityFindings.length === 0) return;

    markdown += `### ${severityEmojis[severity as keyof typeof severityEmojis]} ${severity.toUpperCase()} Severity (${severityFindings.length})\n\n`;

    severityFindings.forEach((finding, index) => {
      markdown += `#### ${severity.toUpperCase()}-${index + 1}: ${finding.title}\n\n`;
      markdown += `**Category**: ${finding.category}\n`;
      markdown += `**Confidence**: ${finding.confidence}%\n`;
      
      if (finding.swc_id) {
        markdown += `**SWC Classification**: ${finding.swc_id}\n`;
      }
      if (finding.cwe_id) {
        markdown += `**CWE Classification**: ${finding.cwe_id}\n`;
      }
      
      markdown += `**Lines**: ${finding.lines.join(', ')}\n\n`;
      
      markdown += `**Description**:\n${finding.description}\n\n`;
      
      if (finding.code_snippet) {
        markdown += `**Code Snippet**:\n\`\`\`solidity\n${finding.code_snippet}\n\`\`\`\n\n`;
      }
      
      markdown += `**Recommendation**:\n${finding.recommendation}\n\n`;
      
      if (finding.impact) {
        markdown += `**Impact**:\n${finding.impact}\n\n`;
      }

      // Add references
      const references = generateReferences(finding);
      if (references.length > 0) {
        markdown += `**References**:\n`;
        references.forEach(ref => {
          markdown += `- [${ref.title}](${ref.url})\n`;
        });
        markdown += `\n`;
      }
      
      markdown += `---\n\n`;
    });
  });

  const categories = [...new Set(findings.map(f => f.category))];
  markdown += `## Categories Summary\n\n`;
  categories.forEach(category => {
    const categoryFindings = findings.filter(f => f.category === category);
    markdown += `- **${category}**: ${categoryFindings.length} findings\n`;
  });

  markdown += `\n---\n\n`;
  markdown += `*Report generated on ${new Date().toISOString()} by AI Smart Contract Auditor*\n`;

  return markdown;
}

function determineOverallRisk(severityCounts: { critical: number; high: number; medium: number; low: number }): string {
  if (severityCounts.critical > 0) {
    return 'CRITICAL';
  } else if (severityCounts.high > 0) {
    return 'HIGH';
  } else if (severityCounts.medium > 2) {
    return 'HIGH';
  } else if (severityCounts.medium > 0) {
    return 'MEDIUM';
  } else if (severityCounts.low > 5) {
    return 'MEDIUM';
  } else if (severityCounts.low > 0) {
    return 'LOW';
  } else {
    return 'MINIMAL';
  }
}

function generateReferences(finding: Finding): Array<{ title: string; url: string }> {
  const references = [];

  if (finding.swc_id) {
    const description = getSWCDescription(finding.swc_id);
    if (description) {
      references.push({
        title: `${finding.swc_id}: Smart Contract Weakness Classification`,
        url: `https://swcregistry.io/docs/${finding.swc_id}`
      });
    }
  }

  if (finding.cwe_id) {
    const cweLink = getCWELink(finding.cwe_id);
    if (cweLink) {
      references.push({
        title: `${finding.cwe_id}: Common Weakness Enumeration`,
        url: cweLink
      });
    }
  }

  if (finding.swc_id) {
    const relatedCWEs = getRelatedCWEs(finding.swc_id);
    relatedCWEs.forEach(cweId => {
      const cweLink = getCWELink(cweId);
      if (cweLink) {
        references.push({
          title: `${cweId}: Related Common Weakness`,
          url: cweLink
        });
      }
    });
  }

  return references;
}
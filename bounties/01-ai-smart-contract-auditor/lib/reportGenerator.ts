interface Finding {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location?: string;
  recommendation?: string;
}

interface ReportData {
  findings: Finding[];
}

export function generateReports(findings: Finding[]): { json: any; markdown: string } {
  const reportData: ReportData = {
    findings
  };

  const json = {
    ...reportData,
    summary: {
      total: findings.length,
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
    },
    generatedAt: new Date().toISOString(),
  };

  const markdown = generateMarkdownReport(reportData);

  return { json, markdown };
}

function generateMarkdownReport(data: ReportData): string {
  const { findings } = data;
  
  const severityEmoji = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  };

  const summary = {
    total: findings.length,
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
  };

  let markdown = `# Smart Contract Audit Report

## Summary

- **Total findings**: ${summary.total}
- **Critical**: ${summary.critical} ${severityEmoji.critical}
- **High**: ${summary.high} ${severityEmoji.high}
- **Medium**: ${summary.medium} ${severityEmoji.medium}
- **Low**: ${summary.low} ${severityEmoji.low}

---

## Finding Details

`;

  if (findings.length === 0) {
    markdown += `No issues detected during the audit.

✅ The contract appears to follow security best practices.
`;
  } else {
    findings.forEach((finding, index) => {
      markdown += `### ${index + 1}. ${finding.title} ${severityEmoji[finding.severity]}

**Severity**: ${finding.severity.toUpperCase()}

**Description**: ${finding.description}

${finding.location ? `**Location**: ${finding.location}\n\n` : ''}${finding.recommendation ? `**Recommendation**: ${finding.recommendation}\n\n` : ''}---

`;
    });
  }

  markdown += `
*Report generated on ${new Date().toLocaleString('en-US')}*
`;

  return markdown;
}
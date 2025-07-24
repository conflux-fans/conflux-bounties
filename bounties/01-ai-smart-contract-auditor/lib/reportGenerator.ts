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

  let markdown = `# Rapport d'Audit de Smart Contract

## Résumé

- **Total des findings**: ${summary.total}
- **Critique**: ${summary.critical} ${severityEmoji.critical}
- **Élevé**: ${summary.high} ${severityEmoji.high}
- **Moyen**: ${summary.medium} ${severityEmoji.medium}
- **Faible**: ${summary.low} ${severityEmoji.low}

---

## Détails des Findings

`;

  if (findings.length === 0) {
    markdown += `Aucun problème détecté lors de l'audit.

✅ Le contrat semble conforme aux bonnes pratiques de sécurité.
`;
  } else {
    findings.forEach((finding, index) => {
      markdown += `### ${index + 1}. ${finding.title} ${severityEmoji[finding.severity]}

**Sévérité**: ${finding.severity.toUpperCase()}

**Description**: ${finding.description}

${finding.location ? `**Localisation**: ${finding.location}\n\n` : ''}${finding.recommendation ? `**Recommandation**: ${finding.recommendation}\n\n` : ''}---

`;
    });
  }

  markdown += `
*Rapport généré le ${new Date().toLocaleString('fr-FR')}*
`;

  return markdown;
}
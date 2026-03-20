import OpenAI from 'openai';
import type { AuditFinding, AuditSummary } from '@/types/audit';

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

const AUDIT_PROMPT = `You are an expert smart contract security auditor. Analyze the following Solidity smart contract source code and identify security vulnerabilities, gas optimization opportunities, and code quality issues.

For each finding, provide:
1. A unique ID (F001, F002, etc.)
2. Category: "security", "gas", or "quality"
3. Severity: "critical", "high", "medium", "low", or "info"
4. SWC classification ID (if applicable, e.g., "SWC-107")
5. CWE classification ID (if applicable, e.g., "CWE-284")
6. Title: A brief descriptive title
7. Description: Detailed explanation of the vulnerability
8. Lines: Array of line numbers where the issue occurs
9. CodeSnippet: The relevant code snippet
10. Recommendation: How to fix the issue

Focus on these SWC categories:
- SWC-101: Integer Overflow and Underflow
- SWC-104: Unchecked Call Return Values
- SWC-105: Unprotected Ether Withdrawal
- SWC-107: Reentrancy
- SWC-108: State Variable Default Visibility
- SWC-109: Uninitialized Storage Pointer
- SWC-115: Authorization through tx.origin
- SWC-116: Block values as a proxy for time
- SWC-119: Shadowing State Variables

Also check for gas optimizations and general code quality issues.

Respond ONLY with a valid JSON object in this exact format:
{
  "findings": [
    {
      "id": "F001",
      "category": "security",
      "severity": "high",
      "swc": "SWC-107",
      "cwe": "CWE-841",
      "title": "...",
      "description": "...",
      "lines": [45, 46],
      "codeSnippet": "...",
      "recommendation": "..."
    }
  ],
  "gasOptimizations": [...],
  "codeQuality": [...]
}

Contract source code:
`;

export async function analyzeContractWithLLM(
  sourceCode: string,
  contractName: string,
): Promise<{
  findings: AuditFinding[];
  gasOptimizations: AuditFinding[];
  codeQuality: AuditFinding[];
}> {
  const client = getOpenAIClient();

  const maxContractSize = parseInt(process.env.MAX_CONTRACT_SIZE || '1000000');
  const truncated = sourceCode.length > maxContractSize
    ? sourceCode.substring(0, maxContractSize) + '\n// ... TRUNCATED FOR ANALYSIS ...'
    : sourceCode;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: AUDIT_PROMPT },
      { role: 'user', content: `${contractName}\n\n${truncated}` },
    ],
    temperature: 0.1,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('No response from LLM');

  try {
    const parsed = JSON.parse(content);
    const validateFindings = (arr: unknown[]): AuditFinding[] =>
      (Array.isArray(arr) ? arr : []).map((f: any, i: number) => ({
        id: f.id || `F${String(i + 1).padStart(3, '0')}`,
        category: f.category || 'security',
        severity: f.severity || 'medium',
        swc: f.swc || undefined,
        cwe: f.cwe || undefined,
        title: f.title || 'Untitled Finding',
        description: f.description || '',
        lines: Array.isArray(f.lines) ? f.lines : [],
        codeSnippet: f.codeSnippet || undefined,
        recommendation: f.recommendation || '',
      }));

    return {
      findings: validateFindings(parsed.findings),
      gasOptimizations: validateFindings(parsed.gasOptimizations),
      codeQuality: validateFindings(parsed.codeQuality),
    };
  } catch (e) {
    throw new Error(`Failed to parse LLM response: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function computeSummary(
  findings: AuditFinding[],
  gasOptimizations: AuditFinding[],
  codeQuality: AuditFinding[],
): AuditSummary {
  const all = [...findings, ...gasOptimizations, ...codeQuality];
  const securityFindings = findings;

  const criticalCount = securityFindings.filter(f => f.severity === 'critical').length;
  const highCount = securityFindings.filter(f => f.severity === 'high').length;
  const mediumCount = securityFindings.filter(f => f.severity === 'medium').length;
  const lowCount = securityFindings.filter(f => f.severity === 'low' || f.severity === 'info').length;

  let overallRisk: AuditSummary['overallRisk'] = 'low';
  if (criticalCount > 0) overallRisk = 'critical';
  else if (highCount > 0) overallRisk = 'high';
  else if (mediumCount > 0) overallRisk = 'medium';

  return {
    totalFindings: all.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    overallRisk,
  };
}


export interface SolidityFunction {
  name: string;
  startLine: number;
  endLine: number;
  signature: string;
  type: 'function' | 'constructor' | 'modifier' | 'fallback' | 'receive';
  visibility: 'public' | 'private' | 'internal' | 'external' | '';
  mutability: 'pure' | 'view' | 'payable' | 'nonpayable' | '';
}

export interface FunctionGroup {
  function: SolidityFunction;
  findings: Array<{
    id: string;
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    lines?: number[];
    codeSnippet?: string;
    location?: string;
    recommendation?: string;
    accuracy?: number;
  }>;
}

export function parseSolidityFunctions(sourceCode: string): SolidityFunction[] {
  const lines = sourceCode.split('\n');
  const functions: SolidityFunction[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('//') || line.startsWith('/*') || !line) {
      continue;
    }
    
    const functionMatch = line.match(
      /^\s*(function|constructor|modifier|fallback|receive)\s*([a-zA-Z_][a-zA-Z0-9_]*)?/
    );
    
    if (functionMatch) {
      const type = functionMatch[1] as SolidityFunction['type'];
      const name = functionMatch[2] || type;
      
      const visibility = extractVisibility(line);
      const mutability = extractMutability(line);
      
      const endLine = findFunctionEnd(lines, i);
      
      functions.push({
        name,
        startLine: i + 1,
        endLine,
        signature: line,
        type,
        visibility,
        mutability
      });
    }
  }
  
  return functions;
}

function extractVisibility(line: string): SolidityFunction['visibility'] {
  if (line.includes('public')) return 'public';
  if (line.includes('private')) return 'private';
  if (line.includes('internal')) return 'internal';
  if (line.includes('external')) return 'external';
  return '';
}

function extractMutability(line: string): SolidityFunction['mutability'] {
  if (line.includes('pure')) return 'pure';
  if (line.includes('view')) return 'view';
  if (line.includes('payable')) return 'payable';
  return 'nonpayable';
}

function findFunctionEnd(lines: string[], startIndex: number): number {
  let braceCount = 0;
  let foundOpenBrace = false;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        foundOpenBrace = true;
      } else if (char === '}') {
        braceCount--;
        
        if (foundOpenBrace && braceCount === 0) {
          return i + 1;
        }
      }
    }
    
    if (!foundOpenBrace && line.includes(';')) {
      return i + 1;
    }
  }
  
  return lines.length;
}

export function groupFindingsByFunction(
  sourceCode: string,
  findings: Array<{
    id: string;
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    lines?: number[];
    codeSnippet?: string;
    location?: string;
    recommendation?: string;
    accuracy?: number;
  }>
): FunctionGroup[] {
  const functions = parseSolidityFunctions(sourceCode);
  const functionGroups: FunctionGroup[] = [];
  const ungroupedFindings: typeof findings = [];
  
  console.log(`[FunctionParser] Found ${functions.length} functions`);
  
  for (const func of functions) {
    const functionFindings = findings.filter(finding => {
      if (finding.lines && finding.lines.length > 0) {
        return finding.lines.some(line => line >= func.startLine && line <= func.endLine);
      }
      
      if (finding.location) {
        return finding.location.toLowerCase().includes(func.name.toLowerCase());
      }
      
      const text = `${finding.title} ${finding.description}`.toLowerCase();
      return text.includes(func.name.toLowerCase());
    });
    
    if (functionFindings.length > 0) {
      functionGroups.push({
        function: func,
        findings: functionFindings
      });
    }
  }
  
  const groupedFindingIds = new Set(
    functionGroups.flatMap(group => group.findings.map(f => f.id))
  );
  
  const orphanFindings = findings.filter(finding => !groupedFindingIds.has(finding.id));
  
  if (orphanFindings.length > 0) {
    functionGroups.push({
      function: {
        name: 'Contract Level',
        startLine: 1,
        endLine: sourceCode.split('\n').length,
        signature: 'Contract-level findings',
        type: 'function',
        visibility: '',
        mutability: ''
      },
      findings: orphanFindings
    });
  }
  
  functionGroups.forEach(group => {
    group.findings.sort((a, b) => {
      const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  });
  
  functionGroups.sort((a, b) => {
    const severityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
    const aMaxSeverity = Math.max(...a.findings.map(f => severityOrder[f.severity]));
    const bMaxSeverity = Math.max(...b.findings.map(f => severityOrder[f.severity]));
    return bMaxSeverity - aMaxSeverity;
  });
  
  console.log(`[FunctionParser] Grouped findings into ${functionGroups.length} function groups`);
  
  return functionGroups;
}

export function getDisplaySignature(func: SolidityFunction): string {
  if (func.type === 'constructor') {
    return `constructor`;
  }
  if (func.type === 'fallback') {
    return `fallback()`;
  }
  if (func.type === 'receive') {
    return `receive()`;
  }
  
  const match = func.signature.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/);
  if (match) {
    return match[0];
  }
  
  return func.signature.split('{')[0].trim();
}

export function getFunctionContext(sourceCode: string, func: SolidityFunction, contextLines: number = 2): string {
  const lines = sourceCode.split('\n');
  const startLine = Math.max(0, func.startLine - 1 - contextLines);
  const endLine = Math.min(lines.length - 1, func.endLine - 1 + contextLines);
  
  return lines.slice(startLine, endLine + 1)
    .map((line, index) => `${startLine + index + 1}: ${line}`)
    .join('\n');
}
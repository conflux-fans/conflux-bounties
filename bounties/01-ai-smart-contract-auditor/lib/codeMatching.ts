interface CodeMatch {
  startLine: number;
  endLine: number;
  confidence: number;
  exactMatch: boolean;
}


export function findCodeSnippetInSource(sourceCode: string, codeSnippet: string): CodeMatch[] {
  if (!codeSnippet || !sourceCode) {
    return [];
  }

  const sourceLines = sourceCode.split('\n');
  const snippetLines = codeSnippet.split('\n').map(line => line.trim());
  const matches: CodeMatch[] = [];

  const cleanSnippetLines = snippetLines.filter(line => line.length > 0);
  
  if (cleanSnippetLines.length === 0) {
    return [];
  }

  for (let i = 0; i <= sourceLines.length - cleanSnippetLines.length; i++) {
    let matchCount = 0;
    let exactMatch = true;

    for (let j = 0; j < cleanSnippetLines.length; j++) {
      const sourceLine = sourceLines[i + j]?.trim() || '';
      const snippetLine = cleanSnippetLines[j];

      if (sourceLine === snippetLine) {
        matchCount++;
      } else if (sourceLine.includes(snippetLine) || snippetLine.includes(sourceLine)) {
        matchCount += 0.7; 
        exactMatch = false;
      } else if (fuzzyMatch(sourceLine, snippetLine)) {
        matchCount += 0.5; 
        exactMatch = false;
      }
    }

    const confidence = matchCount / cleanSnippetLines.length;
    
    if (confidence > 0.7) {
      matches.push({
        startLine: i + 1, 
        endLine: i + cleanSnippetLines.length,
        confidence,
        exactMatch
      });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

function fuzzyMatch(line1: string, line2: string): boolean {
  const normalize = (line: string) => {
    return line
      .replace(/\s+/g, ' ') 
      .replace(/\/\/.*$/, '') 
      .replace(/\/\*.*?\*\//g, '') 
      .replace(/[{}();,]/g, ' ')
      .trim()
      .toLowerCase();
  };

  const norm1 = normalize(line1);
  const norm2 = normalize(line2);

  if (norm1 === norm2) return true;
  
  if (norm1.length > 10 && norm2.length > 10) {
    return norm1.includes(norm2) || norm2.includes(norm1);
  }

  return false;
}

export function validateAndCorrectLineNumbers(
  sourceCode: string, 
  finding: { lines?: number[]; codeSnippet?: string; title: string }
): number[] {
  const { lines, codeSnippet, title } = finding;

  if (codeSnippet) {
    const matches = findCodeSnippetInSource(sourceCode, codeSnippet);
    
    if (matches.length > 0) {
      const bestMatch = matches[0];
      console.log(`[CodeMatching] Found precise match for "${title}" at lines ${bestMatch.startLine}-${bestMatch.endLine} (confidence: ${bestMatch.confidence})`);
      
      const correctedLines = [];
      for (let i = bestMatch.startLine; i <= bestMatch.endLine; i++) {
        correctedLines.push(i);
      }
      return correctedLines;
    } else {
      console.warn(`[CodeMatching] Could not find code snippet for "${title}": "${codeSnippet.substring(0, 50)}..."`);
    }
  }

  if (lines && lines.length > 0) {
    const sourceLines = sourceCode.split('\n');
    const validLines = lines.filter(line => line > 0 && line <= sourceLines.length);
    
    if (validLines.length !== lines.length) {
      console.warn(`[CodeMatching] Some line numbers for "${title}" are out of bounds. Original: [${lines.join(', ')}], Valid: [${validLines.join(', ')}]`);
    }
    
    return validLines;
  }

  return findLinesByKeywords(sourceCode, title);
}

function findLinesByKeywords(sourceCode: string, title: string): number[] {
  const sourceLines = sourceCode.split('\n');
  const keywords = extractKeywords(title);
  const foundLines: number[] = [];

  for (let i = 0; i < sourceLines.length; i++) {
    const line = sourceLines[i].toLowerCase();
    
    const matchingKeywords = keywords.filter(keyword => line.includes(keyword.toLowerCase()));
    
    if (matchingKeywords.length >= Math.min(2, keywords.length)) {
      foundLines.push(i + 1); 
    }
  }

  return foundLines.slice(0, 5); 
}

function extractKeywords(title: string): string[] {
  const functionKeywords = title.match(/\b(function|modifier|constructor|fallback|receive)\s+(\w+)/gi);
  const variableKeywords = title.match(/\b(variable|mapping|array|struct)\s+(\w+)/gi);
  const operationKeywords = title.match(/\b(transfer|send|call|delegatecall|require|assert|revert)\b/gi);
  
  const keywords: string[] = [];
  
  if (functionKeywords) {
    keywords.push(...functionKeywords.map(k => k.split(/\s+/)[1]));
  }
  
  if (variableKeywords) {
    keywords.push(...variableKeywords.map(k => k.split(/\s+/)[1]));
  }
  
  if (operationKeywords) {
    keywords.push(...operationKeywords);
  }

  const words = title.split(/\s+/).filter(word => 
    word.length > 3 && 
    !['vulnerability', 'issue', 'problem', 'missing', 'improper'].includes(word.toLowerCase())
  );
  
  keywords.push(...words);
  
  return [...new Set(keywords)]; 
}

export function scoreLineAccuracy(
  sourceCode: string,
  finding: { lines?: number[]; codeSnippet?: string; title: string; description: string }
): number {
  if (!finding.lines || finding.lines.length === 0) {
    return 0;
  }

  const sourceLines = sourceCode.split('\n');
  let score = 0;

  const validLines = finding.lines.filter(line => line > 0 && line <= sourceLines.length);
  if (validLines.length !== finding.lines.length) {
    score -= 0.3; 
  }

  if (finding.codeSnippet && validLines.length > 0) {
    const actualCode = validLines.map(line => sourceLines[line - 1]?.trim() || '').join('\n');
    const expectedCode = finding.codeSnippet.trim();
    
    if (actualCode === expectedCode) {
      score += 1.0; 
    } else if (actualCode.includes(expectedCode) || expectedCode.includes(actualCode)) {
      score += 0.7;
    } else if (fuzzyMatch(actualCode, expectedCode)) {
      score += 0.5;
    }
  }

  const keywords = extractKeywords(finding.title + ' ' + finding.description);
  for (const lineNum of validLines) {
    const line = sourceLines[lineNum - 1]?.toLowerCase() || '';
    const matchingKeywords = keywords.filter(keyword => line.includes(keyword.toLowerCase()));
    score += matchingKeywords.length * 0.1;
  }

  return Math.min(score, 1.0); 
}
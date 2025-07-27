/**
 * Utilities for precise code matching and line identification
 */

interface CodeMatch {
  startLine: number;
  endLine: number;
  confidence: number;
  exactMatch: boolean;
}

/**
 * Find the exact line(s) where a code snippet appears in the source code
 */
export function findCodeSnippetInSource(sourceCode: string, codeSnippet: string): CodeMatch[] {
  if (!codeSnippet || !sourceCode) {
    return [];
  }

  const sourceLines = sourceCode.split('\n');
  const snippetLines = codeSnippet.split('\n').map(line => line.trim());
  const matches: CodeMatch[] = [];

  // Clean the snippet lines
  const cleanSnippetLines = snippetLines.filter(line => line.length > 0);
  
  if (cleanSnippetLines.length === 0) {
    return [];
  }

  // Try to find exact matches first
  for (let i = 0; i <= sourceLines.length - cleanSnippetLines.length; i++) {
    let matchCount = 0;
    let exactMatch = true;

    for (let j = 0; j < cleanSnippetLines.length; j++) {
      const sourceLine = sourceLines[i + j]?.trim() || '';
      const snippetLine = cleanSnippetLines[j];

      if (sourceLine === snippetLine) {
        matchCount++;
      } else if (sourceLine.includes(snippetLine) || snippetLine.includes(sourceLine)) {
        matchCount += 0.7; // Partial match
        exactMatch = false;
      } else if (fuzzyMatch(sourceLine, snippetLine)) {
        matchCount += 0.5; // Fuzzy match
        exactMatch = false;
      }
    }

    const confidence = matchCount / cleanSnippetLines.length;
    
    // Only consider matches with confidence > 0.7
    if (confidence > 0.7) {
      matches.push({
        startLine: i + 1, // 1-indexed
        endLine: i + cleanSnippetLines.length,
        confidence,
        exactMatch
      });
    }
  }

  // Sort by confidence (highest first)
  return matches.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Fuzzy matching for code lines (ignores whitespace differences, comment differences, etc.)
 */
function fuzzyMatch(line1: string, line2: string): boolean {
  // Normalize both lines
  const normalize = (line: string) => {
    return line
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\/\/.*$/, '') // Remove line comments
      .replace(/\/\*.*?\*\//g, '') // Remove block comments
      .replace(/[{}();,]/g, ' ') // Replace common punctuation with spaces
      .trim()
      .toLowerCase();
  };

  const norm1 = normalize(line1);
  const norm2 = normalize(line2);

  if (norm1 === norm2) return true;
  
  // Check if one contains the other (for partial matches)
  if (norm1.length > 10 && norm2.length > 10) {
    return norm1.includes(norm2) || norm2.includes(norm1);
  }

  return false;
}

/**
 * Validate and correct line numbers based on code snippets
 */
export function validateAndCorrectLineNumbers(
  sourceCode: string, 
  finding: { lines?: number[]; codeSnippet?: string; title: string }
): number[] {
  const { lines, codeSnippet, title } = finding;

  // If we have a code snippet, try to find the exact location
  if (codeSnippet) {
    const matches = findCodeSnippetInSource(sourceCode, codeSnippet);
    
    if (matches.length > 0) {
      const bestMatch = matches[0];
      console.log(`[CodeMatching] Found precise match for "${title}" at lines ${bestMatch.startLine}-${bestMatch.endLine} (confidence: ${bestMatch.confidence})`);
      
      // Return all lines in the range
      const correctedLines = [];
      for (let i = bestMatch.startLine; i <= bestMatch.endLine; i++) {
        correctedLines.push(i);
      }
      return correctedLines;
    } else {
      console.warn(`[CodeMatching] Could not find code snippet for "${title}": "${codeSnippet.substring(0, 50)}..."`);
    }
  }

  // If we have line numbers but no snippet, validate them
  if (lines && lines.length > 0) {
    const sourceLines = sourceCode.split('\n');
    const validLines = lines.filter(line => line > 0 && line <= sourceLines.length);
    
    if (validLines.length !== lines.length) {
      console.warn(`[CodeMatching] Some line numbers for "${title}" are out of bounds. Original: [${lines.join(', ')}], Valid: [${validLines.join(', ')}]`);
    }
    
    return validLines;
  }

  // Fallback: try to find by searching for keywords in the title/description
  return findLinesByKeywords(sourceCode, title);
}

/**
 * Find lines by searching for keywords from the finding title
 */
function findLinesByKeywords(sourceCode: string, title: string): number[] {
  const sourceLines = sourceCode.split('\n');
  const keywords = extractKeywords(title);
  const foundLines: number[] = [];

  for (let i = 0; i < sourceLines.length; i++) {
    const line = sourceLines[i].toLowerCase();
    
    // Check if line contains multiple keywords
    const matchingKeywords = keywords.filter(keyword => line.includes(keyword.toLowerCase()));
    
    if (matchingKeywords.length >= Math.min(2, keywords.length)) {
      foundLines.push(i + 1); // 1-indexed
    }
  }

  return foundLines.slice(0, 5); // Limit to 5 lines max
}

/**
 * Extract relevant keywords from a finding title
 */
function extractKeywords(title: string): string[] {
  // Common function names and patterns
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

  // Add other meaningful words
  const words = title.split(/\s+/).filter(word => 
    word.length > 3 && 
    !['vulnerability', 'issue', 'problem', 'missing', 'improper'].includes(word.toLowerCase())
  );
  
  keywords.push(...words);
  
  return [...new Set(keywords)]; // Remove duplicates
}

/**
 * Score the accuracy of line identification
 */
export function scoreLineAccuracy(
  sourceCode: string,
  finding: { lines?: number[]; codeSnippet?: string; title: string; description: string }
): number {
  if (!finding.lines || finding.lines.length === 0) {
    return 0;
  }

  const sourceLines = sourceCode.split('\n');
  let score = 0;

  // Check if lines are valid
  const validLines = finding.lines.filter(line => line > 0 && line <= sourceLines.length);
  if (validLines.length !== finding.lines.length) {
    score -= 0.3; // Penalty for invalid lines
  }

  // If we have a code snippet, check if it matches the specified lines
  if (finding.codeSnippet && validLines.length > 0) {
    const actualCode = validLines.map(line => sourceLines[line - 1]?.trim() || '').join('\n');
    const expectedCode = finding.codeSnippet.trim();
    
    if (actualCode === expectedCode) {
      score += 1.0; // Perfect match
    } else if (actualCode.includes(expectedCode) || expectedCode.includes(actualCode)) {
      score += 0.7; // Partial match
    } else if (fuzzyMatch(actualCode, expectedCode)) {
      score += 0.5; // Fuzzy match
    }
  }

  // Check if the lines contain relevant keywords
  const keywords = extractKeywords(finding.title + ' ' + finding.description);
  for (const lineNum of validLines) {
    const line = sourceLines[lineNum - 1]?.toLowerCase() || '';
    const matchingKeywords = keywords.filter(keyword => line.includes(keyword.toLowerCase()));
    score += matchingKeywords.length * 0.1;
  }

  return Math.min(score, 1.0); // Cap at 1.0
}
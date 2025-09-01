import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { getContractSource } from './confluxScanClient';
import { generateReports } from './reportGenerator';
import { runStaticAnalysis, StaticFinding, SourceFile } from './staticAnalyzer';
import { insertAuditReport, AuditReportInsert } from './database';
import { generateDetectionPrompt, mapFindingToStandards } from './vulnerabilityCategories';
import { validateAndCorrectLineNumbers, scoreLineAccuracy } from './codeMatching';

interface Finding {
  id: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  swc_id?: string;
  cwe_id?: string;
  title: string;
  description: string;
  lines: number[];
  code_snippet?: string;
  codeSnippet?: string;
  location?: string;
  recommendation: string;
  confidence: number;
  impact?: string;
}

class AIError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'AIError';
  }
}

interface AuditJob {
  id: string;
  address: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  result?: string;
  errorMessage?: string;
  findings?: Finding[];
  reports?: {
    json: any;
    markdown: string;
  };
}

export interface Report {
  id?: string;
  json: any;
  markdown: string;
  findings: Finding[];
  summary: {
    totalFindings: number;
    severityCounts: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    categories: string[];
    contractAddress: string;
    analysisDate: string;
    toolsUsed: string[];
  };
}

export interface AuditProgress {
  stage: string;
  progress: number;
  message: string;
  timestamp: Date;
  data?: any;
}

export type ProgressCallback = (progress: AuditProgress) => void;

export interface AuditOptions {
  onProgress?: ProgressCallback;
  eventEmitter?: EventEmitter;
}

export class AuditEventEmitter extends EventEmitter {
  constructor() {
    super();
  }

  emitProgress(stage: string, progress: number, message: string, data?: any) {
    const progressData: AuditProgress = {
      stage,
      progress,
      message,
      timestamp: new Date(),
      data
    };
    
    this.emit('progress', progressData);
    this.emit(stage, progressData);
  }
}

export function createAuditWithProgress(address: string) {
  const eventEmitter = new AuditEventEmitter();
  
  const auditPromise = runAudit(address, { eventEmitter });
  
  return {
    audit: auditPromise,
    events: eventEmitter,
    onProgress: (callback: ProgressCallback) => eventEmitter.on('progress', callback),
    onStage: (stage: string, callback: (progress: AuditProgress) => void) => eventEmitter.on(stage, callback),
    onComplete: (callback: (progress: AuditProgress) => void) => eventEmitter.on('completed', callback),
    onFailed: (callback: (progress: AuditProgress) => void) => eventEmitter.on('failed', callback)
  };
}

const auditJobs = new Map<string, AuditJob>();

export async function runAudit(address: string, options: AuditOptions = {}): Promise<Report> {
  console.log(`[RunAudit] Starting comprehensive audit for address: ${address}`);
  const startTime = new Date();
  
  const emitProgress = (stage: string, progress: number, message: string, data?: any) => {
    const progressData: AuditProgress = {
      stage,
      progress,
      message,
      timestamp: new Date(),
      data
    };
    
    if (options.onProgress) {
      options.onProgress(progressData);
    }
    
    if (options.eventEmitter) {
      options.eventEmitter.emit('progress', progressData);
      options.eventEmitter.emit(stage, progressData);
    }
    
    console.log(`[RunAudit] ${progress}% - ${stage}: ${message}`);
  };
  
  let staticFindings: StaticFinding[] = [];
  let toolsUsed: string[] = ['AI Analysis'];

  try {
    emitProgress('initializing', 0, 'Starting comprehensive smart contract audit', { address });
    
    emitProgress('fetching', 5, 'Connecting to ConfluxScan API...');
    const source = await getContractSource(address);
    emitProgress('fetched', 10, `Source code fetched successfully (${source.length} characters)`, { 
      sourceLength: source.length 
    });
    
    emitProgress('static_analysis_start', 15, 'Initializing static analysis tools (Slither & Mythril)...');
    
    try {
      const contractName = `Contract_${address.slice(-8)}.sol`;
      const sourceFiles: SourceFile[] = [{
        name: contractName,
        content: source
      }];
      
      emitProgress('static_analysis_running', 25, 'Running static analysis with Slither and Mythril...');
      staticFindings = await runStaticAnalysis(sourceFiles);
      
      const usedTools = [...new Set(staticFindings.map(f => f.tool))];
      if (usedTools.includes('slither')) toolsUsed.push('Slither');
      if (usedTools.includes('mythril')) toolsUsed.push('Mythril');
      
      emitProgress('static_analysis_complete', 40, `Static analysis complete: found ${staticFindings.length} issues`, {
        staticFindings: staticFindings.length,
        toolsUsed: usedTools
      });
      
    } catch (staticError) {
      console.warn(`[RunAudit] Static analysis failed, proceeding with AI-only analysis:`, staticError);
      emitProgress('static_analysis_failed', 40, 'Static analysis failed, proceeding with AI-only analysis', {
        error: staticError instanceof Error ? staticError.message : String(staticError)
      });
    }
    
    emitProgress('ai_analysis_start', 45, 'Preparing AI security analysis with context from static tools...');
    const contractName = `Contract_${address.slice(-8)}.sol`;
    
    emitProgress('ai_analysis_running', 50, 'Running AI-powered vulnerability detection and validation...');
    const aiFindings = await analyzeSource(source, contractName, staticFindings);
    
    emitProgress('ai_analysis_complete', 60, `AI analysis complete: identified ${aiFindings.length} security findings`, {
      aiFindings: aiFindings.length,
      staticContext: staticFindings.length
    });
    
    const allFindings = aiFindings;
    
    emitProgress('classification_start', 65, 'Classifying vulnerabilities by severity and category...');
    
    const severityCounts = {
      critical: allFindings.filter(f => f.severity === 'critical').length,
      high: allFindings.filter(f => f.severity === 'high').length,
      medium: allFindings.filter(f => f.severity === 'medium').length,
      low: allFindings.filter(f => f.severity === 'low').length
    };
    
    const categories = [...new Set(allFindings.map(f => f.category))].sort();
    
    emitProgress('classification_complete', 80, `Classification complete: ${allFindings.length} findings across ${categories.length} categories`, {
      severityCounts,
      categories
    });
    
    emitProgress('report_generation_start', 85, 'Generating comprehensive audit reports...');
    const reports = generateReports(allFindings);
    
    emitProgress('report_generation_complete', 90, 'Reports generated: JSON and Markdown formats ready');
    
    emitProgress('finalizing', 95, 'Finalizing audit report and creating summary...');
    
    const summary = createAuditSummary(allFindings, address, startTime, toolsUsed);
    
    const report: Report = {
      json: reports.json,
      markdown: reports.markdown,
      findings: allFindings,
      summary
    };
    
    emitProgress('completed', 100, `Audit completed successfully! Found ${allFindings.length} total findings`, {
      totalFindings: allFindings.length,
      severityCounts: summary.severityCounts,
      toolsUsed: summary.toolsUsed,
      duration: Date.now() - startTime.getTime()
    });
    
    console.log(`[RunAudit] Audit complete! Found ${allFindings.length} total findings`);
    console.log(`[RunAudit] Severity breakdown:`, summary.severityCounts);
    
    const processingTime = Date.now() - startTime.getTime();
    try {
      const savedReport = await saveAuditReportToDatabase(address, report, processingTime, toolsUsed);
      if (savedReport) {
        report.id = savedReport.id;
        console.log(`[RunAudit] Report saved with ID: ${savedReport.id}`);
        
        import('./webhooks').then(({ sendAuditCompletedWebhook }) => {
          sendAuditCompletedWebhook(
            savedReport.id,
            address,
            allFindings.length,
            summary.severityCounts,
            processingTime
          ).catch(webhookError => {
            console.error(`[RunAudit] Failed to send completion webhook:`, webhookError);
          });
        });
      }
    } catch (error) {
      console.error(`[RunAudit] Failed to save audit report to database:`, error);
    }
    
    return report;
    
  } catch (error) {
    console.error(`[RunAudit] Audit failed for address ${address}:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const processingTime = Date.now() - startTime.getTime();
    
    emitProgress('failed', -1, `Audit failed: ${errorMessage}`, {
      error: errorMessage,
      duration: processingTime
    });
    
    saveFailedAuditToDatabase(address, errorMessage, processingTime, toolsUsed)
      .then((savedReport) => {
        if (savedReport) {
          import('./webhooks').then(({ sendAuditFailedWebhook }) => {
            sendAuditFailedWebhook(
              savedReport.id,
              address,
              errorMessage,
              processingTime
            ).catch(webhookError => {
              console.error(`[RunAudit] Failed to send failure webhook:`, webhookError);
            });
          });
        }
      })
      .catch(saveError => {
        console.error(`[RunAudit] Failed to save failed audit to database:`, saveError);
      });
    
    if (error instanceof AIError) {
      throw error;
    }
    
    throw new AIError(
      `Audit failed for contract ${address}: ${errorMessage}`,
      error instanceof Error ? error : undefined
    );
  }
}

function createAuditSummary(
  findings: Finding[], 
  contractAddress: string, 
  startTime: Date, 
  toolsUsed: string[]
): Report['summary'] {
  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length
  };
  
  const categories = [...new Set(findings.map(f => f.category))].sort();
  
  return {
    totalFindings: findings.length,
    severityCounts,
    categories,
    contractAddress,
    analysisDate: startTime.toISOString(),
    toolsUsed
  };
}

async function analyzeSource(
  source: string, 
  contractName: string = 'Contract.sol', 
  staticFindings: StaticFinding[] = []
): Promise<Finding[]> {
  console.log(`[AnalyzeSource] Starting AI analysis with ${staticFindings.length} static findings, source length: ${source.length}`);
  
  try {
    let finalStaticFindings = staticFindings;
    
    if (staticFindings.length === 0) {
      console.log(`[AnalyzeSource] No static findings provided, running static analysis...`);
      try {
        const sourceFiles: SourceFile[] = [{
          name: contractName,
          content: source
        }];
        
        finalStaticFindings = await runStaticAnalysis(sourceFiles);
        console.log(`[AnalyzeSource] Static analysis complete, found ${finalStaticFindings.length} issues`);
      } catch (staticError) {
        console.warn(`[AnalyzeSource] Static analysis failed, proceeding with AI-only analysis:`, staticError);
      }
    }
    
    const rawFindings = await callAIForAnalysis(source, finalStaticFindings);
    console.log(`[AnalyzeSource] AI analysis complete, found ${rawFindings.length} findings`);
    
    const correctedFindings = rawFindings.map(finding => {
      const correctedLines = validateAndCorrectLineNumbers(source, finding);
      const accuracy = scoreLineAccuracy(source, finding);
      
      console.log(`[AnalyzeSource] Finding "${finding.title}": Original lines [${finding.lines?.join(', ') || 'none'}], Corrected lines [${correctedLines.join(', ')}], Accuracy: ${accuracy.toFixed(2)}`);
      
      return {
        ...finding,
        lines: correctedLines.length > 0 ? correctedLines : finding.lines,
        accuracy 
      };
    });
    
    return correctedFindings;
    
  } catch (error) {
    console.error(`[AnalyzeSource] Analysis failed:`, error);
    
    if (error instanceof AIError) {
      throw error;
    }
    
    throw new AIError(
      `Failed to analyze contract source code: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

async function callAIForAnalysis(source: string, staticFindings: StaticFinding[] = []): Promise<Finding[]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new AIError('No AI API key configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable.');
  }

  const prompt = createSecurityAnalysisPrompt(source, staticFindings);
  
  if (process.env.OPENAI_API_KEY) {
    return await callOpenAI(prompt);
  } else if (process.env.ANTHROPIC_API_KEY) {
    return await callAnthropic(prompt);
  }
  
  throw new AIError('No supported AI API key found');
}

function createSecurityAnalysisPrompt(source: string, staticFindings: StaticFinding[] = []): string {
  let staticAnalysisSection = '';
  
  if (staticFindings.length > 0) {
    staticAnalysisSection = `

## STATIC ANALYSIS RESULTS
The following issues were found by static analysis tools (Slither and Mythril). Please review these findings and:
1. Validate if they are true positives or false positives
2. Provide additional context and detailed explanations
3. Look for related issues that static tools might have missed
4. Suggest comprehensive remediation strategies

Static findings:
${staticFindings.map((finding, index) => `
${index + 1}. **${finding.tool.toUpperCase()} - ${finding.title}**
   - Severity: ${finding.severity}
   - SWC ID: ${finding.swc_id || 'N/A'}
   - Lines: ${finding.lines?.join(', ') || 'N/A'}
   - Description: ${finding.description}
   ${finding.file ? `- File: ${finding.file}` : ''}
`).join('')}

Based on these static analysis results and your own analysis, provide a comprehensive security assessment.`;
  } else {
    staticAnalysisSection = `

## STATIC ANALYSIS STATUS
Static analysis tools (Slither/Mythril) were not available or failed to run. Please perform a thorough manual analysis to identify all potential security vulnerabilities.`;
  }

  return `You are a professional smart contract security auditor. Analyze the following Solidity code for security vulnerabilities and provide a comprehensive security assessment.

${staticAnalysisSection}

## ANALYSIS REQUIREMENTS

IMPORTANT: Respond with a valid JSON array of vulnerability findings. Each finding must have this exact structure:
{
  "id": "unique-id",
  "category": "vulnerability category (e.g., 'Access Control', 'Reentrancy', 'Integer Overflow')",
  "severity": "low|medium|high|critical",
  "swc_id": "SWC-XXX (if applicable)",
  "cwe_id": "CWE-XXX (if applicable)", 
  "title": "Brief vulnerability title",
  "description": "Detailed description of the vulnerability including context from static analysis if relevant",
  "lines": [array of line numbers where vulnerability exists],
  "codeSnippet": "Exact vulnerable code from the contract (copy the problematic line(s) verbatim)",
  "location": "function or contract name where the issue is found",
  "recommendation": "Specific remediation advice"
}

${generateDetectionPrompt()}

## ANALYSIS INSTRUCTIONS

1. **SECURITY VULNERABILITIES (Priority: Critical/High/Medium)**
   - Focus on identifying exploitable security flaws that could lead to fund loss, unauthorized access, or contract compromise
   - Pay special attention to reentrancy, integer overflow, access control, and unchecked external calls
   - Validate any static analysis findings and look for additional security issues
   - **CRITICAL**: For each finding, copy the exact problematic code line(s) in the "codeSnippet" field

2. **GAS OPTIMIZATION OPPORTUNITIES (Priority: Medium/Low)**
   - Identify patterns that consume excessive gas or can be optimized
   - Look for inefficient loops, redundant computations, and suboptimal data structures
   - Suggest view/pure modifiers where applicable
   - Include the specific code that should be optimized

3. **CODE QUALITY IMPROVEMENTS (Priority: Low)**
   - Check for unused variables, missing error messages, naming conventions
   - Assess code documentation and clarity
   - Suggest best practices for maintainability

4. **PRECISE LINE IDENTIFICATION**
   - Count line numbers carefully from the beginning of the contract
   - Copy the exact vulnerable code verbatim in "codeSnippet"
   - Specify the function/contract name in "location"
   - If vulnerability spans multiple lines, include all affected lines in "lines" array

5. **SEVERITY GUIDELINES**
   - **Critical**: Direct fund loss, contract takeover, or system compromise
   - **High**: Significant security risk, unauthorized access, or major functional impact
   - **Medium**: Moderate security risk, potential DoS, or significant gas inefficiency
   - **Low**: Code quality issues, minor optimizations, or best practice violations

## CONTRACT SOURCE CODE

\`\`\`solidity
${source}
\`\`\`

## OUTPUT FORMAT

CRITICAL: Your response must be ONLY a valid JSON array. Follow these rules EXACTLY:

1. Start with [ and end with ]
2. No text before or after the JSON array
3. No markdown code blocks or backticks
4. No explanations or comments
5. If no vulnerabilities found, return exactly: []

Example format:
[
  {
    "id": "vuln-1",
    "category": "Access Control",
    "severity": "high",
    "swc_id": "SWC-105",
    "cwe_id": "CWE-284",
    "title": "Missing access control on critical function",
    "description": "The function lacks proper access control checks",
    "lines": [42, 43],
    "codeSnippet": "function withdraw() public {\n    payable(msg.sender).transfer(balance);\n}",
    "location": "withdraw function in MyContract",
    "recommendation": "Add onlyOwner modifier or equivalent access control"
  }
]

VALIDATION: Before responding, verify your output:
- Starts with [ character
- Ends with ] character  
- Valid JSON syntax (no trailing commas)
- No extra text or formatting

Include both validated static analysis findings and any additional vulnerabilities you discover through manual analysis.`;
}

async function callOpenAI(prompt: string): Promise<Finding[]> {
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
    
    try {
      console.log(`[OpenAI] Attempt ${attempt}/${maxRetries}`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a professional smart contract security auditor. CRITICAL: Your response must be ONLY a valid JSON array starting with [ and ending with ]. No explanatory text, no markdown formatting, no code blocks, no additional comments. Valid JSON syntax only. If no vulnerabilities found, return exactly: []'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 8000
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        console.log(`[OpenAI] HTTP error ${response.status}:`, errorData);
        
        if (response.status === 429) {
          throw new AIError('OpenAI API rate limit exceeded. Please try again later.');
        } else if (response.status === 401) {
          throw new AIError('OpenAI API authentication failed. Please check your API key.');
        } else if (response.status >= 500) {
          throw new AIError('OpenAI API server error. Please try again later.');
        } else {
          throw new AIError(`OpenAI API error: ${response.status} ${errorData}`);
        }
      }

      const data = await response.json();
      console.log(`[OpenAI] Response received, usage:`, data.usage);
      
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new AIError('No content received from OpenAI API');
      }

      return parseAIResponse(content);
      
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[OpenAI] Attempt ${attempt} failed:`, lastError);
      
      if (error instanceof AIError) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  throw new AIError(
    `OpenAI API failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
    lastError || undefined
  );
}

async function callAnthropic(prompt: string): Promise<Finding[]> {
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Anthropic] Attempt ${attempt}/${maxRetries}`);
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 8000,
          temperature: 0.1,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.log(`[Anthropic] HTTP error ${response.status}:`, errorData);
        
        if (response.status === 429) {
          throw new AIError('Anthropic API rate limit exceeded. Please try again later.');
        } else if (response.status === 401) {
          throw new AIError('Anthropic API authentication failed. Please check your API key.');
        } else if (response.status >= 500) {
          throw new AIError('Anthropic API server error. Please try again later.');
        } else {
          throw new AIError(`Anthropic API error: ${response.status} ${errorData}`);
        }
      }

      const data = await response.json();
      console.log(`[Anthropic] Response received, usage:`, data.usage);
      
      const content = data.content?.[0]?.text;
      if (!content) {
        throw new AIError('No content received from Anthropic API');
      }

      return parseAIResponse(content);
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Anthropic] Attempt ${attempt} failed:`, lastError);
      
      if (error instanceof AIError) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  throw new AIError(
    `Anthropic API failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
    lastError || undefined
  );
}

function fixControlCharactersInJSON(jsonStr: string): string {
  let result = '';
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    
    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      result += char;
      escapeNext = true;
      continue;
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString;
      result += char;
      continue;
    }
    
    if (inString) {
      switch (char) {
        case '\n':
          result += '\\n';
          break;
        case '\r':
          result += '\\r';
          break;
        case '\t':
          result += '\\t';
          break;
        case '\b':
          result += '\\b';
          break;
        case '\f':
          result += '\\f';
          break;
        default:
          if (char.charCodeAt(0) < 32) {
            result += '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0');
          } else {
            result += char;
          }
          break;
      }
    } else {
      result += char;
    }
  }
  
  return result;
}

function parseAIResponse(content: string): Finding[] {
  try {
    console.log(`[ParseAI] Parsing AI response, length: ${content.length}`);
    console.log(`[ParseAI] Raw response (first 500 chars):`, content.substring(0, 500));
    console.log(`[ParseAI] Raw response (last 100 chars):`, content.substring(Math.max(0, content.length - 100)));
    
    let jsonStr = content.trim();
    
    if (jsonStr.startsWith('[')) {
      console.log(`[ParseAI] Response starts with [, trying direct parse first`);
      console.log(`[ParseAI] JSON string length: ${jsonStr.length}`);
      console.log(`[ParseAI] First 100 chars: ${jsonStr.substring(0, 100)}`);
      console.log(`[ParseAI] Last 50 chars: ${jsonStr.substring(Math.max(0, jsonStr.length - 50))}`);
      
      try {
        const directParse = JSON.parse(jsonStr);
        if (Array.isArray(directParse)) {
          console.log(`[ParseAI] Direct parse successful, found ${directParse.length} findings`);
          return validateAndTransformFindings(directParse);
        }
      } catch (directParseError) {
        const error = directParseError as Error;
        console.log(`[ParseAI] Direct parse failed:`, error);
        console.log(`[ParseAI] Parse error details:`, {
          name: error.name,
          message: error.message,
          position: error.message.match(/position (\d+)/)?.[1]
        });
        
        const posMatch = error.message.match(/position (\d+)/);
        if (posMatch) {
          const pos = parseInt(posMatch[1]);
          const start = Math.max(0, pos - 50);
          const end = Math.min(jsonStr.length, pos + 50);
          console.log(`[ParseAI] Context around error position ${pos}:`, jsonStr.substring(start, end));
        }
      }
    }
    
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    } else {
      const arrayStartIndex = jsonStr.indexOf('[');
      if (arrayStartIndex !== -1) {
        let bracketCount = 0;
        let arrayEndIndex = -1;
        
        for (let i = arrayStartIndex; i < jsonStr.length; i++) {
          if (jsonStr[i] === '[') {
            bracketCount++;
          } else if (jsonStr[i] === ']') {
            bracketCount--;
            if (bracketCount === 0) {
              arrayEndIndex = i;
              break;
            }
          }
        }
        
        if (arrayEndIndex !== -1) {
          jsonStr = jsonStr.substring(arrayStartIndex, arrayEndIndex + 1);
        }
      }
    }
    
    jsonStr = jsonStr
      .replace(/,\s*]/g, ']') 
      .replace(/,\s*}/g, '}') 
      .trim();
    
    if (jsonStr.includes('"lines":') && jsonStr.match(/\d+,?\s*$/)) {
      console.log(`[ParseAI] Detected truncated lines array, attempting smart repair`);
      
      let depth = 0;
      let inString = false;
      let escape = false;
      let lastObjectEnd = -1;
      
      for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr[i];
        
        if (escape) {
          escape = false;
          continue;
        }
        
        if (char === '\\') {
          escape = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') {
            depth++;
          } else if (char === '}') {
            depth--;
            if (depth === 1) { 
              lastObjectEnd = i;
            }
          }
        }
      }
      
      if (lastObjectEnd > 0) {
        jsonStr = jsonStr.substring(0, lastObjectEnd + 1) + ']';
        console.log(`[ParseAI] Truncated at last complete object position ${lastObjectEnd}`);
      }
    }
    
    jsonStr = fixControlCharactersInJSON(jsonStr);
    
    console.log(`[ParseAI] Cleaned JSON string: ${jsonStr.substring(0, 200)}...`);
    console.log(`[ParseAI] JSON string ends with: ${jsonStr.substring(Math.max(0, jsonStr.length - 50))}`);
    
    let findings;
    try {
      findings = JSON.parse(jsonStr);
    } catch (parseError) {
      console.log(`[ParseAI] JSON parse failed:`, parseError);
      console.log(`[ParseAI] Failed JSON string:`, jsonStr);
      console.log(`[ParseAI] Attempting to fix malformed JSON...`);
      let fixedJson = jsonStr;
      
      fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
      
      let openObjects = 0;
      let openArrays = 0;
      let inString = false;
      let escapeNext = false;
      
      for (let i = 0; i < fixedJson.length; i++) {
        const char = fixedJson[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{') openObjects++;
          else if (char === '}') openObjects--;
          else if (char === '[') openArrays++;
          else if (char === ']') openArrays--;
        }
      }
      
      while (openObjects > 0) {
        fixedJson += '}';
        openObjects--;
      }
      while (openArrays > 0) {
        fixedJson += ']';
        openArrays--;
      }
      
      if (inString) {
        console.log(`[ParseAI] Detected unclosed string, attempting to close it`);
        fixedJson += '"';
        while (openObjects > 0) {
          fixedJson += '}';
          openObjects--;
        }
        while (openArrays > 0) {
          fixedJson += ']';
          openArrays--;
        }
      }
      
      fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
      
      if (!fixedJson.trim().endsWith(']')) {
        const lastCommaIndex = fixedJson.lastIndexOf(',');
        if (lastCommaIndex > -1 && lastCommaIndex > fixedJson.lastIndexOf('}')) {
          fixedJson = fixedJson.substring(0, lastCommaIndex) + ']';
        } else {
          let tempJson = fixedJson.trim();
                    
          if (tempJson.match(/"\s*:\s*"[^"]*$/)) {
            console.log(`[ParseAI] Detected incomplete string value, attempting to close it`);
            tempJson += '"';
          }
          
          if (tempJson.match(/\d+,\s*$/)) {
            console.log(`[ParseAI] Detected truncated line numbers array, attempting to close it`);
            tempJson = tempJson.replace(/,\s*$/, '');
          }
          
          if (tempJson.match(/\[\s*\d+(?:\s*,\s*\d+)*\s*$/)) {
            console.log(`[ParseAI] Detected unclosed numbers array, attempting to close it`);
            tempJson += ']';
          }
          
          if (tempJson.endsWith(',')) {
            tempJson = tempJson.slice(0, -1);
          }
          
          if (!tempJson.endsWith(']')) {
            let openBrackets = 0;
            let inStr = false;
            let escape = false;
            
            for (let i = 0; i < tempJson.length; i++) {
              const ch = tempJson[i];
              if (escape) {
                escape = false;
                continue;
              }
              if (ch === '\\') {
                escape = true;
                continue;
              }
              if (ch === '"') {
                inStr = !inStr;
                continue;
              }
              if (!inStr) {
                if (ch === '{') openBrackets++;
                else if (ch === '}') openBrackets--;
              }
            }
            
            while (openBrackets > 0) {
              tempJson += '}';
              openBrackets--;
            }
            
            if (!tempJson.endsWith(']')) {
              tempJson += ']';
            }
          }
          
          fixedJson = tempJson;
        }
      }
      
      try {
        findings = JSON.parse(fixedJson);
        console.log(`[ParseAI] Successfully parsed fixed JSON`);
      } catch (secondParseError) {
        console.log(`[ParseAI] Both JSON parsing attempts failed:`, secondParseError);
        console.log(`[ParseAI] Fixed JSON string (first 200 chars):`, fixedJson.substring(0, 200));
        console.log(`[ParseAI] Fixed JSON string (last 100 chars):`, fixedJson.substring(Math.max(0, fixedJson.length - 100)));
        console.log(`[ParseAI] Using fallback extraction`);
        findings = extractFindingsFromText(content);
      }
    }
    
    if (!Array.isArray(findings)) {
      throw new Error('Response is not an array');
    }
    
    return validateAndTransformFindings(findings);
    
  } catch (error) {
    console.error(`[ParseAI] Failed to parse AI response:`, error);
    
    console.log(`[ParseAI] Attempting text extraction fallback...`);
    return extractFindingsFromText(content);
  }
}

function validateAndTransformFindings(findings: any[]): Finding[] {
  const validatedFindings: Finding[] = findings.map((finding: any, index: number) => {
    if (!finding || typeof finding !== 'object') {
      throw new Error(`Finding ${index} is not an object`);
    }
    
    const standards = mapFindingToStandards(finding.category, finding.description || '');
    
    return {
      id: finding.id || uuidv4(),
      category: finding.category || 'Unknown',
      severity: ['low', 'medium', 'high', 'critical'].includes(finding.severity) 
        ? finding.severity 
        : 'medium',
      swc_id: finding.swc_id || standards.swc_id || undefined,
      cwe_id: finding.cwe_id || standards.cwe_id || undefined,
      title: finding.title || 'Security Issue',
      description: finding.description || 'No description provided',
      lines: Array.isArray(finding.lines) ? finding.lines : [],
        code_snippet: finding.code_snippet || finding.codeSnippet || undefined,
        codeSnippet: finding.codeSnippet || finding.code_snippet || undefined,
        location: finding.location || undefined,
        recommendation: finding.recommendation || 'Review and fix this issue',
        confidence: typeof finding.confidence === 'number' ? finding.confidence : 75,
        impact: finding.impact || undefined
      };
    });
    
    console.log(`[ParseAI] Successfully validated ${validatedFindings.length} findings`);
    return validatedFindings;
}

function extractFindingsFromText(content: string): Finding[] {
  const findings: Finding[] = [];
  
  console.log(`[ExtractText] Attempting fallback text extraction from ${content.length} characters`);
  
  if (content.toLowerCase().includes('no issues') || 
      content.toLowerCase().includes('no vulnerabilities') ||
      content.toLowerCase().includes('no security concerns') ||
      content.toLowerCase().includes('contract appears secure')) {
    console.log(`[ExtractText] AI indicated no issues found`);
    return [];
  }
  
  const lines = content.split('\n');
  let currentFinding: Partial<Finding> = {};
  let inFinding = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    if (!trimmedLine) continue;
    
    const findingPatterns = [
      /^\d+\.\s*(.*)/,  
      /^-\s*(.*)/,      
      /^\*\s*(.*)/,    
      /^##?\s*(.*)/    
    ];
    
    let findingMatch = null;
    for (const pattern of findingPatterns) {
      findingMatch = trimmedLine.match(pattern);
      if (findingMatch) break;
    }
    
    if (findingMatch) {
      if (currentFinding.title && currentFinding.severity) {
        findings.push(createFindingFromPartial(currentFinding));
      }
      
      currentFinding = {
        title: findingMatch[1].substring(0, 100),
        description: findingMatch[1]
      };
      inFinding = true;
      continue;
    }
    
    if (inFinding) {
      const severityMatch = trimmedLine.match(/\b(critical|high|medium|low)\b/i);
      if (severityMatch && !currentFinding.severity) {
        currentFinding.severity = severityMatch[1].toLowerCase() as any;
      }
      
      const vulnTypes = ['reentrancy', 'overflow', 'underflow', 'access control', 'dos', 'timestamp', 'randomness'];
      for (const vulnType of vulnTypes) {
        if (trimmedLine.toLowerCase().includes(vulnType) && !currentFinding.category) {
          currentFinding.category = vulnType.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
      }
      
      const swcMatch = trimmedLine.match(/SWC-(\d+)/i);
      if (swcMatch) {
        currentFinding.swc_id = `SWC-${swcMatch[1]}`;
      }
      
      const cweMatch = trimmedLine.match(/CWE-(\d+)/i);
      if (cweMatch) {
        currentFinding.cwe_id = `CWE-${cweMatch[1]}`;
      }
      
      const lineMatch = trimmedLine.match(/line[s]?\s*:?\s*(\d+(?:\s*[-,]\s*\d+)*)/i);
      if (lineMatch) {
        const lineStr = lineMatch[1];
        currentFinding.lines = lineStr.split(/[-,]/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
      }
      
      if (trimmedLine.length > 20 && !trimmedLine.match(/^(severity|swc|cwe|line)/i)) {
        currentFinding.description = (currentFinding.description || '') + ' ' + trimmedLine;
      }
    }
  }
  
  if (currentFinding.title && currentFinding.severity) {
    findings.push(createFindingFromPartial(currentFinding));
  }
  
  console.log(`[ExtractText] Extracted ${findings.length} findings from text`);
  
  if (findings.length === 0 && content.length > 50) {
    const contentPreview = content.substring(0, 300).replace(/\n/g, ' ').trim();
    
    const looksLikeJSON = content.trim().startsWith('[') && content.includes('"id"') && content.includes('"severity"');
    
    if (looksLikeJSON) {
      findings.push({
        id: uuidv4(),
        category: 'Analysis Issue',
        severity: 'low',
        title: 'JSON Parsing Error',
        description: `The AI returned what appears to be valid JSON findings, but there was a parsing error. This might be due to truncated response or encoding issues. Response preview: "${contentPreview}${content.length > 300 ? '...' : ''}"`,
        recommendation: 'The analysis likely succeeded but encountered a technical parsing issue. Try running the audit again, or check the server logs for more details about the JSON parsing error.',
        lines: [],
        confidence: 0.5
      });
    } else {
      findings.push({
        id: uuidv4(),
        category: 'Analysis Issue', 
        severity: 'low',
        title: 'AI Response Format Issue',
        description: `The AI analysis completed but returned an unexpected format that could not be parsed as structured findings. Response preview: "${contentPreview}${content.length > 300 ? '...' : ''}"`,
        recommendation: 'Review the contract manually, check the AI service configuration, or try the analysis again. The AI may have provided analysis in a non-standard format.',
        lines: [],
        confidence: 0.5
      });
    }
  }
  
  return findings;
}

function createFindingFromPartial(partial: Partial<Finding>): Finding {
  return {
    id: uuidv4(),
    category: partial.category || 'Security Issue',
    severity: partial.severity || 'medium',
    title: partial.title || 'Security Finding',
    description: partial.description || partial.title || 'Security issue identified during analysis',
    swc_id: partial.swc_id,
    cwe_id: partial.cwe_id,
    lines: partial.lines || [],
    recommendation: partial.recommendation || 'Review and address this security issue',
    confidence: partial.confidence || 0.8
  };
}

export async function startAudit(address: string): Promise<string> {
  const jobId = uuidv4();
  
  const job: AuditJob = {
    id: jobId,
    address,
    status: 'pending',
    progress: 0,
    createdAt: new Date(),
  };
  
  auditJobs.set(jobId, job);
  
  processAudit(jobId).catch(error => {
    console.error(`Error during audit ${jobId}:`, error);
    const failedJob = auditJobs.get(jobId);
    if (failedJob) {
      failedJob.status = 'failed';
      failedJob.errorMessage = error.message || 'Unknown error';
      auditJobs.set(jobId, failedJob);
    }
  });
  
  return jobId;
}

async function processAudit(jobId: string): Promise<void> {
  const job = auditJobs.get(jobId);
  if (!job) {
    console.log(`[ProcessAudit] Job ${jobId} not found`);
    return;
  }

  console.log(`[ProcessAudit] Starting audit for job ${jobId}, address: ${job.address}`);

  try {
    job.status = 'processing';
    job.progress = 10;
    auditJobs.set(jobId, job);
    console.log(`[ProcessAudit] Job ${jobId} set to processing, progress: 10%`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    job.progress = 30;
    auditJobs.set(jobId, job);
    console.log(`[ProcessAudit] Job ${jobId} progress: 30%, fetching source code...`);
    
    const source = await getContractSource(job.address);
    console.log(`[ProcessAudit] Job ${jobId} source code fetched, length: ${source.length}`);
    
    job.progress = 60;
    auditJobs.set(jobId, job);
    console.log(`[ProcessAudit] Job ${jobId} progress: 60%, analyzing source code with AI and static tools...`);
    
    const contractName = `Contract_${job.address.slice(-8)}.sol`;
    const findings = await analyzeSource(source, contractName);
    console.log(`[ProcessAudit] Job ${jobId} analysis complete, findings: ${findings.length}`);
    
    job.progress = 80;
    auditJobs.set(jobId, job);
    console.log(`[ProcessAudit] Job ${jobId} progress: 80%, generating reports...`);
    
    const reports = generateReports(findings);
    console.log(`[ProcessAudit] Job ${jobId} reports generated`);
    
    job.status = 'completed';
    job.progress = 100;
    job.findings = findings;
    job.reports = reports;
    job.result = 'Audit completed successfully';
    
    auditJobs.set(jobId, job);
    console.log(`[ProcessAudit] Job ${jobId} completed successfully`);
    
  } catch (error) {
    console.error(`[ProcessAudit] Job ${jobId} failed:`, error);
    job.status = 'failed';
    job.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    auditJobs.set(jobId, job);
    console.log(`[ProcessAudit] Job ${jobId} marked as failed with error: ${job.errorMessage}`);
  }
}

export async function getAuditStatus(jobId: string): Promise<AuditJob | null> {
  return auditJobs.get(jobId) || null;
}

async function saveAuditReportToDatabase(
  contractAddress: string,
  report: Report,
  processingTimeMs: number,
  toolsUsed: string[]
): Promise<any> {
  try {
    console.log(`[SaveToDatabase] Saving audit report for ${contractAddress}`);
    
    const auditReportData: AuditReportInsert = {
      contract_address: contractAddress.toLowerCase(),
      report_json: report.json,
      report_markdown: report.markdown,
      findings_count: report.findings.length,
      critical_findings: report.summary.severityCounts.critical,
      high_findings: report.summary.severityCounts.high,
      medium_findings: report.summary.severityCounts.medium,
      low_findings: report.summary.severityCounts.low,
      audit_status: 'completed',
      processing_time_ms: processingTimeMs,
      audit_engine_version: '1.0.0', // Version of our audit engine
      static_analysis_tools: toolsUsed
    };
    
    const savedReport = await insertAuditReport(auditReportData);
    
    if (savedReport) {
      console.log(`[SaveToDatabase] Successfully saved audit report with ID: ${savedReport.id}`);
      return savedReport;
    } else {
      console.error(`[SaveToDatabase] Failed to save audit report for ${contractAddress}`);
      return null;
    }
  } catch (error) {
    console.error(`[SaveToDatabase] Error saving audit report for ${contractAddress}:`, error);
    throw error;
  }
}

async function saveFailedAuditToDatabase(
  contractAddress: string,
  errorMessage: string,
  processingTimeMs: number,
  toolsUsed: string[]
): Promise<any> {
  try {
    console.log(`[SaveFailedToDatabase] Saving failed audit for ${contractAddress}`);
    
    const failedAuditData: AuditReportInsert = {
      contract_address: contractAddress.toLowerCase(),
      report_json: {},
      report_markdown: '',
      findings_count: 0,
      critical_findings: 0,
      high_findings: 0,
      medium_findings: 0,
      low_findings: 0,
      audit_status: 'failed',
      processing_time_ms: processingTimeMs,
      error_message: errorMessage,
      audit_engine_version: '1.0.0',
      static_analysis_tools: toolsUsed
    };
    
    const savedReport = await insertAuditReport(failedAuditData);
    
    if (savedReport) {
      console.log(`[SaveFailedToDatabase] Successfully saved failed audit with ID: ${savedReport.id}`);
      return savedReport;
    } else {
      console.error(`[SaveFailedToDatabase] Failed to save failed audit for ${contractAddress}`);
      return null;
    }
  } catch (error) {
    console.error(`[SaveFailedToDatabase] Error saving failed audit for ${contractAddress}:`, error);
    throw error;
  }
}
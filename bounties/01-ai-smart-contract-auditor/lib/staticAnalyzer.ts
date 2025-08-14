import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export interface StaticFinding {
  id: string;
  tool: 'slither' | 'mythril';
  swc_id?: string;
  cwe_id?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  lines?: number[];
  file?: string;
  impact?: string;
  confidence?: string;
}

export interface SourceFile {
  name: string;
  content: string;
}

interface SlitherFinding {
  check: string;
  confidence: string;
  impact: string;
  description: string;
  elements: Array<{
    name: string;
    source_mapping: {
      start: number;
      length: number;
      filename_relative: string;
      filename_absolute: string;
      lines: number[];
    };
  }>;
}

interface MythrilFinding {
  title: string;
  swc_id: string;
  description: {
    head: string;
    tail: string;
  };
  severity: string;
  lineno: number;
  filename: string;
}

// Mapping of Slither detectors to SWC/CWE IDs
const SLITHER_TO_SWC_CWE: Record<string, { swc?: string; cwe?: string }> = {
  'reentrancy-eth': { swc: 'SWC-107', cwe: 'CWE-362' },
  'reentrancy-no-eth': { swc: 'SWC-107', cwe: 'CWE-362' },
  'reentrancy-benign': { swc: 'SWC-107', cwe: 'CWE-362' },
  'reentrancy-events': { swc: 'SWC-107', cwe: 'CWE-362' },
  'tx-origin': { swc: 'SWC-115', cwe: 'CWE-477' },
  'unchecked-transfer': { swc: 'SWC-104', cwe: 'CWE-252' },
  'low-level-calls': { swc: 'SWC-112', cwe: 'CWE-20' },
  'timestamp': { swc: 'SWC-116', cwe: 'CWE-829' },
  'assembly': { swc: 'SWC-119', cwe: 'CWE-20' },
  'incorrect-equality': { swc: 'SWC-132', cwe: 'CWE-697' },
  'write-after-write': { swc: 'SWC-124', cwe: 'CWE-563' },
  'boolean-equal': { swc: 'SWC-104', cwe: 'CWE-697' },
  'divide-before-multiply': { swc: 'SWC-101', cwe: 'CWE-682' },
  'uninitialized-state': { swc: 'SWC-109', cwe: 'CWE-824' },
  'uninitialized-storage': { swc: 'SWC-109', cwe: 'CWE-824' },
  'arbitrary-send': { swc: 'SWC-105', cwe: 'CWE-862' },
  'controlled-delegatecall': { swc: 'SWC-112', cwe: 'CWE-829' },
  'delegatecall-loop': { swc: 'SWC-112', cwe: 'CWE-829' },
  'msg-value-loop': { swc: 'SWC-113', cwe: 'CWE-400' },
  'incorrect-shift': { swc: 'SWC-124', cwe: 'CWE-682' },
  'multiple-constructors': { swc: 'SWC-118', cwe: 'CWE-665' },
  'name-reused': { swc: 'SWC-119', cwe: 'CWE-710' },
  'protected-vars': { swc: 'SWC-108', cwe: 'CWE-284' },
  'public-mappings-nested': { swc: 'SWC-108', cwe: 'CWE-200' },
  'rtlo': { swc: 'SWC-130', cwe: 'CWE-451' },
  'shadowing-state': { swc: 'SWC-119', cwe: 'CWE-710' },
  'suicidal': { swc: 'SWC-106', cwe: 'CWE-284' },
  'uninitialized-local': { swc: 'SWC-109', cwe: 'CWE-824' },
  'unused-return': { swc: 'SWC-104', cwe: 'CWE-252' },
  'incorrect-modifier': { swc: 'SWC-118', cwe: 'CWE-665' },
  'constant-function-asm': { swc: 'SWC-119', cwe: 'CWE-710' },
  'constant-function-state': { swc: 'SWC-108', cwe: 'CWE-665' }
};

function mapSlitherSeverity(impact: string, confidence: string): 'low' | 'medium' | 'high' | 'critical' {
  const impactLevel = impact.toLowerCase();
  const confidenceLevel = confidence.toLowerCase();

  // Critical: High impact + High confidence
  if (impactLevel === 'high' && confidenceLevel === 'high') {
    return 'critical';
  }
  
  // High: High impact + Medium confidence OR Medium impact + High confidence
  if ((impactLevel === 'high' && confidenceLevel === 'medium') ||
      (impactLevel === 'medium' && confidenceLevel === 'high')) {
    return 'high';
  }
  
  // Medium: Medium impact + Medium confidence OR High impact + Low confidence
  if ((impactLevel === 'medium' && confidenceLevel === 'medium') ||
      (impactLevel === 'high' && confidenceLevel === 'low')) {
    return 'medium';
  }
  
  // Low: Everything else
  return 'low';
}

function mapMythrilSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
  const severityLevel = severity.toLowerCase();
  switch (severityLevel) {
    case 'high':
      return 'critical';
    case 'medium':
      return 'high';
    case 'low':
      return 'medium';
    default:
      return 'low';
  }
}

async function writeSourceFilesToWorkspace(sourceFiles: SourceFile[], workspaceId: string): Promise<string> {
  const workspacePath = `/tmp/analysis-${workspaceId}`;
  
  try {
    await fs.mkdir(workspacePath, { recursive: true });
    
    for (const sourceFile of sourceFiles) {
      const filePath = path.join(workspacePath, sourceFile.name);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, sourceFile.content, 'utf8');
    }
    
    console.log(`[StaticAnalysis] Written ${sourceFiles.length} source files to ${workspacePath}`);
    return workspacePath;
  } catch (error) {
    console.error('[StaticAnalysis] Error writing source files:', error);
    throw error;
  }
}

async function runSlitherAnalysis(workspacePath: string): Promise<StaticFinding[]> {
  console.log('[StaticAnalysis] Starting Slither analysis...');
  
  try {
    // Copy files to the shared workspace volume that containers can access first
    const containerWorkspace = `/workspace`;
    console.log(`[StaticAnalysis] Copying files from ${workspacePath} to container workspace...`);
    const copyCmd = `docker exec ai-auditor-slither rm -rf ${containerWorkspace}/* && docker cp ${workspacePath}/. ai-auditor-slither:${containerWorkspace}/`;
    await execAsync(copyCmd);
    console.log('[StaticAnalysis] Files copied successfully to Slither container');
    
    // Find the main contract file in the container (list files in container after copying)
    console.log('[StaticAnalysis] Listing files in Slither container workspace...');
    const { stdout: lsOutput } = await execAsync(`docker exec ai-auditor-slither ls ${containerWorkspace}`);
    const files = lsOutput.trim().split('\n').filter(f => f && f.trim());
    const solidityFiles = files.filter(f => f.endsWith('.sol'));
    console.log(`[StaticAnalysis] Found files in container: ${files.join(', ')}`);
    console.log(`[StaticAnalysis] Solidity files: ${solidityFiles.join(', ')}`);
    
    if (solidityFiles.length === 0) {
      console.warn('[StaticAnalysis] No Solidity files found for Slither analysis');
      return [];
    }
    
    const mainFile = solidityFiles[0]; // Use first file as entry point
    
    // Detect and set the correct Solidity version
    const containerTargetFile = `${containerWorkspace}/${mainFile}`;
    console.log(`[StaticAnalysis] Detecting Solidity version for ${mainFile}...`);
    await setCorrectSolidityVersion(containerTargetFile);
    
    // Run Slither with JSON output on the copied files
    const slitherCmd = `docker exec ai-auditor-slither slither ${containerTargetFile} --json -`;
    console.log(`[StaticAnalysis] Running: ${slitherCmd}`);
    
    let stdout, stderr;
    try {
      const result = await execAsync(slitherCmd, { 
        timeout: 60000, // 60 second timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error: any) {
      // Slither returns exit code 255 when findings are found - this is normal
      if (error.code === 255 && error.stdout) {
        console.log('[StaticAnalysis] Slither completed with findings (exit code 255)');
        stdout = error.stdout;
        stderr = error.stderr;
      } else {
        throw error; // Re-throw if it's a real error
      }
    }
    
    if (stderr && !stderr.includes('INFO') && !stderr.includes('WARNING')) {
      console.warn('[StaticAnalysis] Slither stderr:', stderr);
    }
    
    if (!stdout.trim()) {
      console.log('[StaticAnalysis] Slither produced no output');
      return [];
    }
    
    const slitherResults = JSON.parse(stdout);
    const findings: StaticFinding[] = [];
    
    if (slitherResults.results?.detectors) {
      for (const detector of slitherResults.results.detectors) {
        const mapping = SLITHER_TO_SWC_CWE[detector.check] || {};
        
        findings.push({
          id: uuidv4(),
          tool: 'slither',
          swc_id: mapping.swc,
          cwe_id: mapping.cwe,
          severity: mapSlitherSeverity(detector.impact, detector.confidence),
          title: `Slither: ${detector.check}`,
          description: detector.description,
          lines: detector.elements?.[0]?.source_mapping?.lines || [],
          file: detector.elements?.[0]?.source_mapping?.filename_relative,
          impact: detector.impact,
          confidence: detector.confidence
        });
      }
    }
    
    console.log(`[StaticAnalysis] Slither analysis completed: ${findings.length} findings`);
    return findings;
    
  } catch (error) {
    console.error('[StaticAnalysis] Slither analysis failed:', error);
    return [];
  }
}

async function runMythrilAnalysis(workspacePath: string): Promise<StaticFinding[]> {
  console.log('[StaticAnalysis] Starting Mythril analysis...');
  
  try {
    // Copy files to the shared workspace volume that containers can access first
    const containerWorkspace = `/workspace`;
    console.log(`[StaticAnalysis] Copying files from ${workspacePath} to Mythril container workspace...`);
    const copyCmd = `docker exec ai-auditor-mythril rm -rf ${containerWorkspace}/* && docker cp ${workspacePath}/. ai-auditor-mythril:${containerWorkspace}/`;
    await execAsync(copyCmd);
    console.log('[StaticAnalysis] Files copied successfully to Mythril container');
    
    // Find the main contract file in the container (list files in container after copying)
    console.log('[StaticAnalysis] Listing files in Mythril container workspace...');
    const { stdout: lsOutput } = await execAsync(`docker exec ai-auditor-mythril ls ${containerWorkspace}`);
    const files = lsOutput.trim().split('\n').filter(f => f && f.trim());
    const solidityFiles = files.filter(f => f.endsWith('.sol'));
    console.log(`[StaticAnalysis] Found files in Mythril container: ${files.join(', ')}`);
    console.log(`[StaticAnalysis] Mythril Solidity files: ${solidityFiles.join(', ')}`);
    
    if (solidityFiles.length === 0) {
      console.warn('[StaticAnalysis] No Solidity files found for Mythril analysis');
      return [];
    }
    
    const mainFile = solidityFiles[0];
    
    // Run Mythril with JSON output on the copied files (shorter timeout for faster analysis)
    const containerTargetFile = `${containerWorkspace}/${mainFile}`;
    const mythrilCmd = `docker exec ai-auditor-mythril myth analyze ${containerTargetFile} --outform json --execution-timeout 30`;
    console.log(`[StaticAnalysis] Running: ${mythrilCmd}`);
    
    const { stdout, stderr } = await execAsync(mythrilCmd, { 
      timeout: 45000, // 45 second timeout (including 30s execution timeout)
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    if (stderr && !stderr.includes('INFO') && !stderr.includes('WARNING')) {
      console.warn('[StaticAnalysis] Mythril stderr:', stderr);
    }
    
    if (!stdout.trim()) {
      console.log('[StaticAnalysis] Mythril produced no output');
      return [];
    }
    
    const mythrilResults = JSON.parse(stdout);
    const findings: StaticFinding[] = [];
    
    if (mythrilResults.issues) {
      for (const issue of mythrilResults.issues) {
        findings.push({
          id: uuidv4(),
          tool: 'mythril',
          swc_id: issue.swc_id,
          cwe_id: undefined, // Mythril primarily uses SWC IDs
          severity: mapMythrilSeverity(issue.severity),
          title: issue.title,
          description: `${issue.description.head} ${issue.description.tail}`.trim(),
          lines: issue.lineno ? [issue.lineno] : [],
          file: issue.filename
        });
      }
    }
    
    console.log(`[StaticAnalysis] Mythril analysis completed: ${findings.length} findings`);
    return findings;
    
  } catch (error) {
    console.error('[StaticAnalysis] Mythril analysis failed:', error);
    return [];
  }
}

async function cleanupWorkspace(workspacePath: string): Promise<void> {
  try {
    await fs.rm(workspacePath, { recursive: true, force: true });
    console.log(`[StaticAnalysis] Cleaned up workspace: ${workspacePath}`);
  } catch (error) {
    console.warn('[StaticAnalysis] Failed to cleanup workspace:', error);
  }
}

export async function runStaticAnalysis(sourceFiles: SourceFile[]): Promise<StaticFinding[]> {
  console.log(`[StaticAnalysis] Starting static analysis with Slither and Mythril`);
  
  if (!sourceFiles || sourceFiles.length === 0) {
    console.warn('[StaticAnalysis] No source files provided, returning empty results');
    return [];
  }

  const workspaceId = uuidv4();
  let workspacePath: string | null = null;
  
  try {
    // Write source files to temporary workspace
    workspacePath = await writeSourceFilesToWorkspace(sourceFiles, workspaceId);
    
    // Run both tools in parallel (they handle copying internally)
    const [slitherFindings, mythrilFindings] = await Promise.allSettled([
      runSlitherAnalysis(workspacePath),
      runMythrilAnalysis(workspacePath)
    ]);
    
    const allFindings: StaticFinding[] = [];
    
    if (slitherFindings.status === 'fulfilled') {
      allFindings.push(...slitherFindings.value);
    } else {
      console.warn('[StaticAnalysis] Slither analysis failed:', slitherFindings.reason);
    }
    
    if (mythrilFindings.status === 'fulfilled') {
      allFindings.push(...mythrilFindings.value);
    } else {
      console.warn('[StaticAnalysis] Mythril analysis failed:', mythrilFindings.reason);
    }
    
    console.log(`[StaticAnalysis] Static analysis completed: ${allFindings.length} total findings`);
    console.log(`[StaticAnalysis] Slither: ${slitherFindings.status === 'fulfilled' ? slitherFindings.value.length : 0} findings`);
    console.log(`[StaticAnalysis] Mythril: ${mythrilFindings.status === 'fulfilled' ? mythrilFindings.value.length : 0} findings`);
    
    return allFindings;
    
  } catch (error) {
    console.error('[StaticAnalysis] Static analysis failed:', error);
    return [];
  } finally {
    // Cleanup
    if (workspacePath) {
      await cleanupWorkspace(workspacePath);
    }
  }
}

/**
 * Detect Solidity version from contract and set it in Slither container
 */
async function setCorrectSolidityVersion(contractPath: string): Promise<void> {
  try {
    // Read the contract to detect pragma version
    const { stdout: contractContent } = await execAsync(`docker exec ai-auditor-slither cat ${contractPath}`);
    
    // Extract pragma solidity version with regex
    const pragmaMatch = contractContent.match(/pragma\s+solidity\s+([^;]+);/i);
    if (!pragmaMatch) {
      console.log('[StaticAnalysis] No pragma solidity found, using default version');
      return;
    }
    
    const pragmaVersion = pragmaMatch[1].trim();
    console.log(`[StaticAnalysis] Found pragma: ${pragmaVersion}`);
    
    // Extract exact version (e.g., "=0.5.16", "^0.8.0", ">=0.7.0 <0.9.0")
    let targetVersion = '0.8.19'; // default
    
    // Extract the numeric version from the pragma
    const versionMatch = pragmaVersion.match(/(\d+\.\d+(?:\.\d+)?)/);
    if (!versionMatch) {
      console.log(`[StaticAnalysis] Could not parse version from: ${pragmaVersion}, using default`);
      return;
    }
    
    const numericVersion = versionMatch[1];
    const [major, minor] = numericVersion.split('.');
    
    // Map to available versions based on major.minor
    if (major === '0' && minor === '4') targetVersion = '0.4.26';
    else if (major === '0' && minor === '5') targetVersion = '0.5.16';
    else if (major === '0' && minor === '6') targetVersion = '0.6.12';
    else if (major === '0' && minor === '7') targetVersion = '0.7.6';
    else if (major === '0' && minor === '8') targetVersion = '0.8.21';
    else {
      console.log(`[StaticAnalysis] Unsupported version ${numericVersion}, using default 0.8.19`);
    }
    
    console.log(`[StaticAnalysis] Setting Solidity version to: ${targetVersion}`);
    
    // Check if version is available, install if needed
    const { stdout: availableVersions } = await execAsync('docker exec ai-auditor-slither solc-select versions');
    if (!availableVersions.includes(targetVersion)) {
      console.log(`[StaticAnalysis] Installing Solidity ${targetVersion}...`);
      await execAsync(`docker exec ai-auditor-slither solc-select install ${targetVersion}`);
    }
    
    // Set the version
    await execAsync(`docker exec ai-auditor-slither solc-select use ${targetVersion}`);
    console.log(`[StaticAnalysis] Solidity version set to: ${targetVersion}`);
    
  } catch (error) {
    console.warn('[StaticAnalysis] Failed to set Solidity version, using default:', error);
  }
}

/**
 * Check if static analysis tools are available
 */
export async function checkStaticAnalysisAvailable(): Promise<{ slither: boolean; mythril: boolean }> {
  try {
    const [slitherCheck, mythrilCheck] = await Promise.allSettled([
      execAsync('docker exec ai-auditor-slither slither --version', { timeout: 5000 }),
      execAsync('docker exec ai-auditor-mythril myth version', { timeout: 5000 })
    ]);
    
    return {
      slither: slitherCheck.status === 'fulfilled',
      mythril: mythrilCheck.status === 'fulfilled'
    };
  } catch (error) {
    console.warn('[StaticAnalysis] Error checking tool availability:', error);
    return { slither: false, mythril: false };
  }
}
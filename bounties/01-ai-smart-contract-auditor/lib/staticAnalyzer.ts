import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
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

class StaticAnalysisError extends Error {
  constructor(message: string, public tool: string, public cause?: Error) {
    super(message);
    this.name = 'StaticAnalysisError';
  }
}

/**
 * Run static analysis (Docker-based tools disabled, returns empty array for AI-only analysis)
 */
export async function runStaticAnalysis(sourceFiles: SourceFile[]): Promise<StaticFinding[]> {
  console.log(`[StaticAnalysis] Static analysis tools (Slither/Mythril) disabled - using AI-only analysis`);
  
  if (!sourceFiles || sourceFiles.length === 0) {
    console.warn('[StaticAnalysis] No source files provided, returning empty results');
    return [];
  }

  console.log(`[StaticAnalysis] Skipping Docker-based static analysis for ${sourceFiles.length} source files`);
  console.log(`[StaticAnalysis] Total findings: 0 (AI analysis will be performed separately)`);
  
  return [];
}

// Docker-based functions removed - using AI-only analysis
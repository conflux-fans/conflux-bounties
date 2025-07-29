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


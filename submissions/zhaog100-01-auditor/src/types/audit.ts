export interface AuditFinding {
  id: string;
  category: 'security' | 'gas' | 'quality';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  swc?: string;
  cwe?: string;
  title: string;
  description: string;
  lines: number[];
  codeSnippet?: string;
  recommendation: string;
}

export interface AuditSummary {
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  overallRisk: 'critical' | 'high' | 'medium' | 'low';
}

export interface AuditReport {
  contract: {
    address: string;
    name: string;
    compiler: string;
  };
  analysis: {
    engine: string;
    timestamp: string;
    duration: number;
  };
  summary: AuditSummary;
  findings: AuditFinding[];
  gasOptimizations: AuditFinding[];
  codeQuality: AuditFinding[];
}

export interface AnalysisJobResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  contractAddress: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

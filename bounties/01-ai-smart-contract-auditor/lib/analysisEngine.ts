import { v4 as uuidv4 } from 'uuid';

interface AuditJob {
  id: string;
  address: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  result?: string;
  errorMessage?: string;
}

// In-memory storage (stub for database)
const auditJobs = new Map<string, AuditJob>();

export async function startAudit(address: string): Promise<string> {
  const jobId = uuidv4();
  
  const job: AuditJob = {
    id: jobId,
    address,
    status: 'pending',
    progress: 0,
    createdAt: new Date(),
  };
  
  // Save job to database (stub)
  auditJobs.set(jobId, job);
  
  return jobId;
}

export async function getAuditStatus(jobId: string): Promise<AuditJob | null> {
  return auditJobs.get(jobId) || null;
}
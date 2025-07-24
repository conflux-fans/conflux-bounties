import { v4 as uuidv4 } from 'uuid';

interface AuditJob {
  id: string;
  address: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  result?: string;
}

// In-memory storage (stub for database)
const auditJobs = new Map<string, AuditJob>();

export async function startAudit(address: string): Promise<string> {
  const jobId = uuidv4();
  
  const job: AuditJob = {
    id: jobId,
    address,
    status: 'pending',
    createdAt: new Date(),
  };
  
  // Save job to database (stub)
  auditJobs.set(jobId, job);
  
  return jobId;
}

export async function getAuditStatus(jobId: string): Promise<AuditJob | null> {
  return auditJobs.get(jobId) || null;
}
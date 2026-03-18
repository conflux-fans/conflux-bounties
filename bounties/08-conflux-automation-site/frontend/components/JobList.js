'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { formatDistanceToNow } from 'date-fns';

const JOB_TYPES = ['Limit Buy', 'Limit Sell', 'DCA Buy', 'DCA Sell'];
const JOB_STATUS = ['Active', 'Paused', 'Cancelled', 'Completed'];
const STATUS_COLORS = ['green', 'yellow', 'red', 'blue'];

export default function JobList() {
  const { address } = useAccount();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (address) {
      fetchJobs();
    }
  }, [address]);

  const fetchJobs = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      setJobs(data);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateJobStatus = async (jobId, status) => {
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      fetchJobs();
    } catch (error) {
      console.error('Failed to update job:', error);
    }
  };

  const cancelJob = async (jobId) => {
    if (!confirm('Are you sure you want to cancel this job?')) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      fetchJobs();
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  };

  if (loading) {
    return <div className="card text-center py-8">Loading jobs...</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="card text-center py-16">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="text-xl font-semibold mb-2">No Jobs Yet</h3>
        <p className="text-gray-400">Create your first automation job to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <div key={job.id} className="card">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold">{JOB_TYPES[job.job_type]}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${STATUS_COLORS[job.status]}-900 text-${STATUS_COLORS[job.status]}-300`}>
                  {JOB_STATUS[job.status]}
                </span>
              </div>
              <p className="text-sm text-gray-400">
                Created {formatDistanceToNow(job.created_at, { addSuffix: true })}
              </p>
            </div>
            
            <div className="flex gap-2">
              {job.status === 0 && (
                <>
                  <button
                    onClick={() => updateJobStatus(job.id, 1)}
                    className="btn-secondary text-sm"
                  >
                    Pause
                  </button>
                  <button
                    onClick={() => cancelJob(job.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
              {job.status === 1 && (
                <button
                  onClick={() => updateJobStatus(job.id, 0)}
                  className="btn-primary text-sm"
                >
                  Resume
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Amount</p>
              <p className="font-mono">{job.amount}</p>
            </div>
            <div>
              <p className="text-gray-400">Target Price</p>
              <p className="font-mono">${job.target_price}</p>
            </div>
            <div>
              <p className="text-gray-400">Executions</p>
              <p className="font-mono">{job.executions} / {job.max_executions || '∞'}</p>
            </div>
            <div>
              <p className="text-gray-400">Interval</p>
              <p className="font-mono">{job.interval > 0 ? `${job.interval / 3600}h` : 'Once'}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-500">
            <p>Token In: {job.token_in}</p>
            <p>Token Out: {job.token_out}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

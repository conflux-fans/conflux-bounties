'use client';

import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { ethers } from 'ethers';

const JOB_TYPES = [
  { value: 0, label: 'Limit Buy', description: 'Buy when price reaches target' },
  { value: 1, label: 'Limit Sell', description: 'Sell when price reaches target' },
  { value: 2, label: 'DCA Buy', description: 'Buy at regular intervals' },
  { value: 3, label: 'DCA Sell', description: 'Sell at regular intervals' },
];

const INTERVALS = [
  { value: 3600, label: '1 Hour' },
  { value: 21600, label: '6 Hours' },
  { value: 43200, label: '12 Hours' },
  { value: 86400, label: '1 Day' },
  { value: 604800, label: '1 Week' },
];

export default function CreateJob({ onSuccess }) {
  const { address, signMessageAsync } = useAccount();
  const [formData, setFormData] = useState({
    jobType: 0,
    tokenIn: '',
    tokenOut: '',
    amount: '',
    targetPrice: '',
    maxSlippage: 100,
    interval: 86400,
    maxExecutions: 0,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get or create auth token
      let token = localStorage.getItem('auth_token');
      
      if (!token) {
        // Sign message for authentication
        const message = `Sign this message to authenticate with Conflux Automation.\n\nAddress: ${address}\nTimestamp: ${Date.now()}`;
        const signature = await signMessageAsync({ message });
        
        // Verify signature with backend
        const authRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, signature }),
        });
        
        const authData = await authRes.json();
        token = authData.token;
        localStorage.setItem('auth_token', token);
      }

      // Create job
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          amount: ethers.parseEther(formData.amount).toString(),
          targetPrice: formData.targetPrice,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create job');
      }

      // Reset form
      setFormData({
        jobType: 0,
        tokenIn: '',
        tokenOut: '',
        amount: '',
        targetPrice: '',
        maxSlippage: 100,
        interval: 86400,
        maxExecutions: 0,
      });

      onSuccess();
      alert('Job created successfully!');
    } catch (error) {
      console.error('Failed to create job:', error);
      alert('Failed to create job: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const isLimitOrder = formData.jobType === 0 || formData.jobType === 1;
  const isDCA = formData.jobType === 2 || formData.jobType === 3;

  return (
    <div className="card max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Create Automation Job</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Job Type */}
        <div>
          <label className="label">Job Type</label>
          <div className="grid grid-cols-2 gap-3">
            {JOB_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData({ ...formData, jobType: type.value })}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  formData.jobType === type.value
                    ? 'border-conflux-primary bg-conflux-primary/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="font-semibold">{type.label}</div>
                <div className="text-xs text-gray-400 mt-1">{type.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Token Addresses */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Token In</label>
            <input
              type="text"
              value={formData.tokenIn}
              onChange={(e) => setFormData({ ...formData, tokenIn: e.target.value })}
              placeholder="0x..."
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Token Out</label>
            <input
              type="text"
              value={formData.tokenOut}
              onChange={(e) => setFormData({ ...formData, tokenOut: e.target.value })}
              placeholder="0x..."
              className="input"
              required
            />
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="label">Amount per Execution</label>
          <input
            type="number"
            step="0.0001"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            placeholder="10.0"
            className="input"
            required
          />
        </div>

        {/* Target Price (for limit orders) */}
        {isLimitOrder && (
          <div>
            <label className="label">Target Price (USD)</label>
            <input
              type="number"
              step="0.01"
              value={formData.targetPrice}
              onChange={(e) => setFormData({ ...formData, targetPrice: e.target.value })}
              placeholder="1.50"
              className="input"
              required
            />
          </div>
        )}

        {/* Slippage */}
        <div>
          <label className="label">Max Slippage: {formData.maxSlippage / 100}%</label>
          <input
            type="range"
            min="10"
            max="1000"
            value={formData.maxSlippage}
            onChange={(e) => setFormData({ ...formData, maxSlippage: parseInt(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0.1%</span>
            <span>10%</span>
          </div>
        </div>

        {/* Interval (for DCA) */}
        {isDCA && (
          <>
            <div>
              <label className="label">Execution Interval</label>
              <select
                value={formData.interval}
                onChange={(e) => setFormData({ ...formData, interval: parseInt(e.target.value) })}
                className="input"
              >
                {INTERVALS.map((int) => (
                  <option key={int.value} value={int.value}>
                    {int.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Max Executions (0 = unlimited)</label>
              <input
                type="number"
                min="0"
                value={formData.maxExecutions}
                onChange={(e) => setFormData({ ...formData, maxExecutions: parseInt(e.target.value) })}
                placeholder="10"
                className="input"
              />
            </div>
          </>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create Job'}
        </button>
      </form>

      <div className="mt-6 p-4 bg-yellow-900/30 rounded-lg border border-yellow-700">
        <p className="text-sm text-yellow-300">
          ⚠️ <strong>Important:</strong> Make sure to approve the contract to spend your tokens before creating a job.
          Jobs are non-custodial - your tokens stay in your wallet until execution.
        </p>
      </div>
    </div>
  );
}

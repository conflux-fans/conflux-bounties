'use client';

import { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import JobList from '../components/JobList';
import CreateJob from '../components/CreateJob';
import ExecutionHistory from '../components/ExecutionHistory';

export default function Home() {
  const [activeTab, setActiveTab] = useState('jobs');
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="gradient-bg shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Conflux Automation</h1>
              <p className="text-sm text-blue-100">Non-custodial limit orders & DCA</p>
            </div>
            
            <div className="flex items-center gap-4">
              {isConnected ? (
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <span className="text-blue-200">Connected:</span>
                    <span className="ml-2 font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
                  </div>
                  <button 
                    onClick={() => disconnect()}
                    className="btn-secondary text-sm"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => connect({ connector: connectors[0] })}
                  className="btn-primary"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {!isConnected ? (
          <div className="card text-center py-16">
            <div className="text-6xl mb-4">🔐</div>
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6">Connect your wallet to manage automation jobs</p>
            <button 
              onClick={() => connect({ connector: connectors[0] })}
              className="btn-primary text-lg px-8 py-3"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setActiveTab('jobs')}
                className={`px-6 py-2 rounded-lg font-semibold ${
                  activeTab === 'jobs' ? 'bg-conflux-primary text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                My Jobs
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`px-6 py-2 rounded-lg font-semibold ${
                  activeTab === 'create' ? 'bg-conflux-primary text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                Create Job
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-2 rounded-lg font-semibold ${
                  activeTab === 'history' ? 'bg-conflux-primary text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                History
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'jobs' && <JobList />}
            {activeTab === 'create' && <CreateJob onSuccess={() => setActiveTab('jobs')} />}
            {activeTab === 'history' && <ExecutionHistory />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-8 text-center text-gray-500 text-sm">
        <p>⚠️ Experimental - Use at your own risk</p>
        <p className="mt-2">Non-custodial automation on Conflux eSpace</p>
      </footer>
    </div>
  );
}

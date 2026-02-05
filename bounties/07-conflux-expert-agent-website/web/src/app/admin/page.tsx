'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Stats {
    totalDocuments: number;
    sectionBreakdown: Record<string, number>;
    recentDocuments: { doc_id: string; title: string; section: string; created_at: string }[];
    lastUpdated: string;
}

interface SyncStatus {
    isRunning: boolean;
    lastRun: string | null;
    lastStatus: 'idle' | 'running' | 'success' | 'error';
    lastMessage: string;
    progress: number;
}

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [stats, setStats] = useState<Stats | null>(null);
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const authHeader = useCallback(() => {
        return 'Basic ' + btoa('admin:' + password);
    }, [password]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/stats', {
                headers: { 'Authorization': authHeader() }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }, [authHeader]);

    const fetchSyncStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/sync', {
                headers: { 'Authorization': authHeader() }
            });
            if (res.ok) {
                const data = await res.json();
                setSyncStatus(data);
            }
        } catch (error) {
            console.error('Failed to fetch sync status:', error);
        }
    }, [authHeader]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchStats();
            fetchSyncStatus();
            // Poll sync status every 2 seconds if running
            const interval = setInterval(() => {
                if (syncStatus?.isRunning) {
                    fetchSyncStatus();
                }
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [isAuthenticated, syncStatus?.isRunning, fetchStats, fetchSyncStatus]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch('/api/admin/stats', {
                headers: { 'Authorization': authHeader() }
            });

            if (res.ok) {
                setIsAuthenticated(true);
                const data = await res.json();
                setStats(data);
                await fetchSyncStatus();
            } else {
                setError('Invalid password');
            }
        } catch {
            setError('Connection failed');
        } finally {
            setIsLoading(false);
        }
    };

    const triggerSync = async () => {
        try {
            const res = await fetch('/api/admin/sync', {
                method: 'POST',
                headers: { 'Authorization': authHeader() }
            });
            const data = await res.json();
            setSyncStatus(data.status);
        } catch (error) {
            console.error('Sync trigger failed:', error);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                                <span className="text-white font-bold">C</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold text-white">Admin Panel</h1>
                                <p className="text-xs text-zinc-500">Confluxpedia Management</p>
                            </div>
                        </div>

                        <form onSubmit={handleLogin}>
                            <label className="block text-sm text-zinc-400 mb-2">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white mb-4 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                placeholder="Enter admin password"
                            />
                            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition"
                            >
                                {isLoading ? 'Logging in...' : 'Login'}
                            </button>
                        </form>

                        <p className="text-center text-zinc-500 text-sm mt-6">
                            Default password: <code className="text-zinc-400">conflux-admin-2024</code>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            {/* Header */}
            <header className="border-b border-zinc-800 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                            <span className="font-bold">C</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold">Admin Panel</h1>
                            <p className="text-xs text-zinc-500">Confluxpedia Management</p>
                        </div>
                    </div>
                    <Link href="/chat" className="text-sm text-violet-400 hover:text-violet-300">
                        ← Back to Chat
                    </Link>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6">
                {/* Stats Cards */}
                <div className="grid md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <p className="text-zinc-500 text-sm mb-1">Total Documents</p>
                        <p className="text-3xl font-bold">{stats?.totalDocuments || 0}</p>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <p className="text-zinc-500 text-sm mb-1">Sections</p>
                        <p className="text-3xl font-bold">{Object.keys(stats?.sectionBreakdown || {}).length}</p>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <p className="text-zinc-500 text-sm mb-1">Last Updated</p>
                        <p className="text-lg font-medium">
                            {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'N/A'}
                        </p>
                    </div>
                </div>

                {/* Sync Section */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold">Content Sync</h2>
                            <p className="text-sm text-zinc-500">Manually trigger document ingestion</p>
                        </div>
                        <button
                            onClick={triggerSync}
                            disabled={syncStatus?.isRunning}
                            className="px-6 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {syncStatus?.isRunning ? 'Syncing...' : 'Start Sync'}
                        </button>
                    </div>

                    {/* Progress Bar */}
                    {syncStatus?.isRunning && (
                        <div className="mb-4">
                            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                                    style={{ width: `${syncStatus.progress}%` }}
                                />
                            </div>
                            <p className="text-sm text-zinc-400 mt-2">{syncStatus.lastMessage}</p>
                        </div>
                    )}

                    {/* Last Sync Status */}
                    {syncStatus?.lastRun && !syncStatus.isRunning && (
                        <div className={`flex items-center gap-2 text-sm ${syncStatus.lastStatus === 'success' ? 'text-emerald-400' :
                                syncStatus.lastStatus === 'error' ? 'text-red-400' : 'text-zinc-400'
                            }`}>
                            <span>{syncStatus.lastStatus === 'success' ? '✓' : syncStatus.lastStatus === 'error' ? '✗' : '•'}</span>
                            <span>{syncStatus.lastMessage}</span>
                            <span className="text-zinc-500">
                                ({new Date(syncStatus.lastRun).toLocaleString()})
                            </span>
                        </div>
                    )}
                </div>

                {/* Section Breakdown */}
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-4">Section Breakdown</h2>
                        <div className="space-y-3">
                            {Object.entries(stats?.sectionBreakdown || {}).map(([section, count]) => (
                                <div key={section} className="flex items-center justify-between">
                                    <span className="text-zinc-300 capitalize">{section}</span>
                                    <span className="px-3 py-1 bg-zinc-800 rounded-full text-sm">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-4">Recent Documents</h2>
                        <div className="space-y-3">
                            {stats?.recentDocuments.map(doc => (
                                <div key={doc.doc_id} className="border-b border-zinc-800 pb-3 last:border-0">
                                    <p className="text-zinc-300 font-medium truncate">{doc.title}</p>
                                    <p className="text-xs text-zinc-500">
                                        {doc.section} • {new Date(doc.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

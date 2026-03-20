'use client'
import { useState, useEffect } from 'react'

interface GatingResult { name: string; pass: boolean; balance: string }

export default function Protected() {
  const [results, setResults] = useState<GatingResult[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/gating/check', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setResults(null); setLoading(false); return }
        setResults(data.results)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-20"><p className="text-slate-400">Checking token holdings...</p></div>

  if (!results) return <div className="text-center py-20"><p className="text-red-400">Please connect your wallet first</p><a href="/" className="text-cyan-400 underline">Go Home</a></div>

  const allPassed = results.every(r => r.pass)

  return (
    <div className="max-w-2xl mx-auto py-10">
      <h2 className="text-3xl font-bold mb-6">🛡️ Gating Check Results</h2>
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        {results.map((r, i) => (
          <div key={i} className="flex justify-between items-center border-b border-slate-700 pb-3">
            <span>{r.name}</span>
            <span className={r.pass ? 'text-green-400' : 'text-red-400'}>
              {r.pass ? `✅ ${r.balance}` : `❌ ${r.balance}`}
            </span>
          </div>
        ))}
      </div>
      {allPassed ? (
        <div className="mt-8 bg-green-900/30 border border-green-700 rounded-lg p-6 text-center">
          <h3 className="text-2xl font-bold text-green-400 mb-2">🎉 Access Granted!</h3>
          <p className="text-slate-300">Welcome to the exclusive content area.</p>
          <div className="mt-4 bg-slate-800 p-4 rounded">
            <p className="text-lg">This is your protected content. Only token holders can see this.</p>
          </div>
        </div>
      ) : (
        <div className="mt-8 bg-red-900/30 border border-red-700 rounded-lg p-6 text-center">
          <h3 className="text-2xl font-bold text-red-400 mb-2">🚫 Access Denied</h3>
          <p className="text-slate-300">You need to hold the required tokens to access this content.</p>
        </div>
      )}
    </div>
  )
}

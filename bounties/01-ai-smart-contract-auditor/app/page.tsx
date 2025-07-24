'use client';

import { useState } from 'react';

export default function Home() {
  const [address, setAddress] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartAudit = async () => {
    if (!address.trim()) {
      setError('Veuillez entrer une adresse valide');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/audit/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du lancement de l\'audit');
      }

      setJobId(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Auditeur de Smart Contracts
          </h1>
        </div>

        <div className="bg-white py-8 px-6 shadow rounded-lg">
          {!jobId ? (
            <div className="space-y-6">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse du contrat
                </label>
                <input
                  type="text"
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleStartAudit}
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Lancement en cours...' : 'Lancer l\'audit'}
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="text-lg font-medium text-gray-900">
                Audit en attente...
              </h2>
              <p className="text-sm text-gray-600">
                Job ID: {jobId}
              </p>
              <p className="text-sm text-gray-500">
                L'audit de votre contrat est en cours de traitement.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
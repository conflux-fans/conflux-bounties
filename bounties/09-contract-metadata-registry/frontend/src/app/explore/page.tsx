'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getMetadataSearch } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [results, setResults] = useState<Array<{ id: string; name?: string; contractAddress: string; description?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await getMetadataSearch({ q: query || undefined, tag: tag || undefined });
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getMetadataSearch({}).then(setResults).catch(() => undefined).finally(() => setInitialLoading(false));
  }, []);

  return (
    <div className="page-section container-wide">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[rgb(var(--color-text))] sm:text-4xl">
          Explore contracts
        </h1>
        <p className="mt-2 text-[rgb(var(--color-text-muted))]">
          Search approved metadata by name, description, or tag.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:min-w-[200px]">
          <Input
            label="Search"
            placeholder="Name or description"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <Input
            label="Tag"
            placeholder="e.g. dex"
            value={tag}
            onChange={e => setTag(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" loading={loading} className="w-full sm:w-auto">
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </form>

      {error && (
        <div className="mb-6 rounded-lg border border-[rgb(var(--color-danger))]/50 bg-[rgb(var(--color-danger))]/10 p-4 text-sm text-[rgb(var(--color-danger))]">
          {error}
        </div>
      )}

      {initialLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[rgb(var(--color-text-muted))]">
          <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading…
        </div>
      ) : results.length === 0 ? (
        <div className="py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-[rgb(var(--color-text-muted))]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <p className="mt-3 text-[rgb(var(--color-text-muted))]">No results found. Try a different search or tag.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r) => (
            <Link key={r.id} href={`/contract/${r.contractAddress}`}>
              <Card className="h-full transition-all hover:border-[rgb(var(--color-accent))]/40 hover:shadow-glow">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-[rgb(var(--color-text))] line-clamp-1">
                    {r.name || 'Unnamed Contract'}
                  </h2>
                  <Badge variant="success">Approved</Badge>
                </div>
                <p className="mt-2 font-mono text-xs text-[rgb(var(--color-text-muted))] break-all">
                  {r.contractAddress}
                </p>
                {r.description && (
                  <p className="mt-3 line-clamp-3 text-sm text-[rgb(var(--color-text-muted))]">
                    {r.description}
                  </p>
                )}
                <span className="mt-4 inline-block text-sm font-medium text-[rgb(var(--color-accent))]">
                  View details →
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

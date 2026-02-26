'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { getMetadata, getContractVersionHistory } from '@/services/api';
import { REGISTRY_ADDRESS, REGISTRY_ABI, MetadataStatus } from '@/lib/registry';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { FullMetadata } from '@/lib/server-api';

const IPFS_GATEWAY = (process.env.NEXT_PUBLIC_IPFS_GATEWAY as string) || 'https://gateway.pinata.cloud';

const STATUS_LABEL: Record<number, string> = {
  [MetadataStatus.None]: 'None',
  [MetadataStatus.Pending]: 'Pending',
  [MetadataStatus.Approved]: 'Approved',
  [MetadataStatus.Rejected]: 'Rejected',
};

function buildGatewayUrl(cid: string) {
  return `${IPFS_GATEWAY.replace(/\/$/, '')}/ipfs/${cid}`;
}

export interface ContractPageClientProps {
  address: string;
  /** Initial record from API (SSR) */
  initialSummary?: { status: string; version?: number; cid: string; checksum: string } | null;
  /** Initial full metadata from API (SSR) */
  initialFullMetadata?: FullMetadata | null;
}

export default function ContractPageClient({
  address,
  initialSummary = undefined,
  initialFullMetadata = undefined,
}: ContractPageClientProps) {
  const { address: connectedAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [summary, setSummary] = useState<{ status: string; version?: number; cid: string; checksum: string } | null>(
    initialSummary ?? null
  );
  const [fullMetadata, setFullMetadata] = useState<{
    name?: string;
    description?: string;
    website?: string;
    abi?: unknown[];
  } | null>(initialFullMetadata ?? null);
  const [loading, setLoading] = useState(typeof initialSummary === 'undefined' && typeof initialFullMetadata === 'undefined');
  const [versionHistory, setVersionHistory] = useState<
    Array<{ id: string; version?: number | null; status: string; cid: string; createdAt: string; name?: string }>
  >([]);

  const { data: onChainRecord, refetch: refetchRecord } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getRecord',
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address && REGISTRY_ADDRESS !== '0x0000000000000000000000000000000000000000',
    },
  });

  const record = onChainRecord as
    | {
      owner?: `0x${string}`;
      resolver?: `0x${string}`;
      version?: bigint;
      status?: number;
      metadataCid?: string;
      submitter?: `0x${string}`;
      lastUpdated?: bigint;
    }
    | undefined;

  const onChainVersion = record?.version != null ? Number(record.version) : 0;
  const hasOnChainRecord = onChainVersion > 0;

  const lastUpdatedFormatted =
    hasOnChainRecord && record?.lastUpdated != null
      ? new Date(Number(record.lastUpdated) * 1000).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
      : null;

  const isOwner =
    hasOnChainRecord &&
    !!connectedAddress &&
    !!record?.owner &&
    record.owner !== '0x0000000000000000000000000000000000000000' &&
    connectedAddress.toLowerCase() === (record.owner as string).toLowerCase();

  useEffect(() => {
    if (initialSummary !== undefined && initialFullMetadata !== undefined) {
      setLoading(false);
      return;
    }
    const load = async () => {
      if (!address) return;
      try {
        const s = await getMetadata(address);
        if (!s) {
          setSummary(null);
          return;
        }
        setSummary(s);
        const res = await fetch(buildGatewayUrl(s.cid));
        if (res.ok) {
          const m = await res.json();
          setFullMetadata(m);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [address, initialSummary, initialFullMetadata]);

  useEffect(() => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return;
    getContractVersionHistory(address)
      .then((rows: Array<{ id: string; version?: number | null; status: string; cid: string; createdAt: string; name?: string }>) => {
        setVersionHistory(Array.isArray(rows) ? rows : []);
      })
      .catch(() => setVersionHistory([]));
  }, [address]);

  const abi = useMemo(() => fullMetadata?.abi ?? [], [fullMetadata?.abi]);
  const abiFunctions = useMemo(
    () => (Array.isArray(abi) ? abi.filter((item: unknown) => (item as { type?: string }).type === 'function') : []),
    [abi]
  );

  const [ownerAction, setOwnerAction] = useState<'transfer' | 'resolver' | 'addDelegate' | 'removeDelegate' | null>(null);
  const [transferTo, setTransferTo] = useState('');
  const [resolverAddress, setResolverAddress] = useState('');
  const [delegateAddress, setDelegateAddress] = useState('');
  const [delegateExpiry, setDelegateExpiry] = useState('');
  const [txPending, setTxPending] = useState(false);

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTo.trim()) return;
    setTxPending(true);
    try {
      await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'transferOwnership',
        args: [address as `0x${string}`, transferTo.trim() as `0x${string}`],
      });
      setOwnerAction(null);
      setTransferTo('');
      await refetchRecord();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setTxPending(false);
    }
  };

  const handleSetResolver = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxPending(true);
    try {
      await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'setResolver',
        args: [address as `0x${string}`, resolverAddress.trim() as `0x${string}`],
      });
      setOwnerAction(null);
      setResolverAddress('');
      await refetchRecord();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Set resolver failed');
    } finally {
      setTxPending(false);
    }
  };

  const handleAddDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateAddress.trim()) return;
    const expiry = delegateExpiry.trim() ? BigInt(Math.floor(new Date(delegateExpiry).getTime() / 1000)) : BigInt(0);
    setTxPending(true);
    try {
      await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'addDelegate',
        args: [address as `0x${string}`, delegateAddress.trim() as `0x${string}`, expiry],
      });
      setOwnerAction(null);
      setDelegateAddress('');
      setDelegateExpiry('');
      await refetchRecord();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Add delegate failed');
    } finally {
      setTxPending(false);
    }
  };

  const handleRemoveDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateAddress.trim()) return;
    setTxPending(true);
    try {
      await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'removeDelegate',
        args: [address as `0x${string}`, delegateAddress.trim() as `0x${string}`],
      });
      setOwnerAction(null);
      setDelegateAddress('');
      await refetchRecord();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Remove delegate failed');
    } finally {
      setTxPending(false);
    }
  };

  if (loading) {
    return (
      <div className="page-section container-narrow flex min-h-[40vh] items-center justify-center">
        <div className="flex gap-2 text-[rgb(var(--color-text-muted))]">
          <svg className="h-6 w-6 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading…
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="page-section container-narrow text-center">
        <h1 className="text-2xl font-semibold text-[rgb(var(--color-text))]">Not found</h1>
        <p className="mt-2 text-[rgb(var(--color-text-muted))]">This contract is not registered or not verified.</p>
        <Link href="/explore" className="btn-primary mt-6 inline-flex">
          Explore contracts
        </Link>
      </div>
    );
  }

  const onChainStatus = hasOnChainRecord && record?.status !== undefined ? STATUS_LABEL[record.status] ?? 'Unknown' : null;

  return (
    <div className="page-section container-narrow">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--color-text))] sm:text-4xl">
            {fullMetadata?.name || 'Unknown Project'}
          </h1>
          <p className="mt-2 break-all font-mono text-sm text-[rgb(var(--color-text-muted))]">{address}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="success">{summary.status}</Badge>
            {(summary.version != null || (hasOnChainRecord && onChainVersion)) && (
              <Badge variant="muted">Version {summary.version ?? onChainVersion}</Badge>
            )}
            {hasOnChainRecord && onChainStatus && (
              <Badge variant="default">On-chain: {onChainStatus}</Badge>
            )}
          </div>
        </div>
        <Link href="/explore" className="btn-secondary shrink-0 self-start sm:self-auto">
          ← Back to Explore
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-[rgb(var(--color-text-muted))]">Status</dt>
              <dd className="mt-0.5 text-[rgb(var(--color-text))]">{summary.status}</dd>
            </div>
            <div>
              <dt className="font-medium text-[rgb(var(--color-text-muted))]">Version</dt>
              <dd className="mt-0.5 text-[rgb(var(--color-text))]">
                {summary.version ?? (hasOnChainRecord ? onChainVersion : null) ?? '—'}
              </dd>
            </div>
            {hasOnChainRecord && record?.owner && record.owner !== '0x0000000000000000000000000000000000000000' && (
              <div>
                <dt className="font-medium text-[rgb(var(--color-text-muted))]">Registry owner</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-[rgb(var(--color-text))]">{record.owner}</dd>
              </div>
            )}
            {hasOnChainRecord && record?.resolver && record.resolver !== '0x0000000000000000000000000000000000000000' && (
              <div>
                <dt className="font-medium text-[rgb(var(--color-text-muted))]">Resolver</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-[rgb(var(--color-text))]">{record.resolver}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-[rgb(var(--color-text-muted))]">Description</dt>
              <dd className="mt-0.5 text-[rgb(var(--color-text))]">{fullMetadata?.description || '—'}</dd>
            </div>
            <div>
              <dt className="font-medium text-[rgb(var(--color-text-muted))]">Website</dt>
              <dd className="mt-0.5">
                {fullMetadata?.website ? (
                  <a
                    href={fullMetadata.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[rgb(var(--color-accent))] hover:underline"
                  >
                    {fullMetadata.website}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resources</CardTitle>
          </CardHeader>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium text-[rgb(var(--color-text-muted))]">CID</dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-[rgb(var(--color-text))]">{summary.cid}</dd>
            </div>
            <div>
              <dt className="font-medium text-[rgb(var(--color-text-muted))]">Checksum</dt>
              <dd className="mt-0.5 break-all font-mono text-xs text-[rgb(var(--color-text))]">{summary.checksum}</dd>
            </div>
            {lastUpdatedFormatted && (
              <div>
                <dt className="font-medium text-[rgb(var(--color-text-muted))]">Last update (on-chain)</dt>
                <dd className="mt-0.5 text-sm text-[rgb(var(--color-text))]">{lastUpdatedFormatted}</dd>
              </div>
            )}
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
              <a
                href={buildGatewayUrl(summary.cid)}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary text-sm"
              >
                Download metadata JSON
              </a>
              {Array.isArray(abi) && abi.length > 0 && (
                <a
                  href={`data:application/json,${encodeURIComponent(JSON.stringify(abi, null, 2))}`}
                  download="abi.json"
                  className="btn-secondary text-sm"
                >
                  Download ABI
                </a>
              )}
            </div>
          </dl>
        </Card>
      </div>

      {versionHistory.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Version history</CardTitle>
          </CardHeader>
          <p className="mb-4 text-sm text-[rgb(var(--color-text-muted))]">
            All submissions for this contract, retained in the database.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--color-border))] text-left">
                  <th className="py-2 pr-4 font-medium text-[rgb(var(--color-text-muted))]">Version</th>
                  <th className="py-2 pr-4 font-medium text-[rgb(var(--color-text-muted))]">Status</th>
                  <th className="py-2 pr-4 font-medium text-[rgb(var(--color-text-muted))]">Submitted</th>
                  <th className="py-2 pr-4 font-medium text-[rgb(var(--color-text-muted))]">CID</th>
                  <th className="py-2 font-medium text-[rgb(var(--color-text-muted))]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {versionHistory.map((row) => (
                  <tr key={row.id} className="border-b border-[rgb(var(--color-border))]/50 last:border-0">
                    <td className="py-3 pr-4 font-mono text-[rgb(var(--color-text))]">
                      {row.version != null ? `v${row.version}` : '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant={
                          row.status === 'APPROVED'
                            ? 'success'
                            : row.status === 'REJECTED'
                              ? 'danger'
                              : 'muted'
                        }
                      >
                        {row.status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-[rgb(var(--color-text-muted))]">
                      {new Date(row.createdAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-[rgb(var(--color-text))] break-all max-w-[200px] truncate">
                      {row.cid}
                    </td>
                    <td className="py-3">
                      <a
                        href={buildGatewayUrl(row.cid)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[rgb(var(--color-accent))] hover:underline text-sm"
                      >
                        View on IPFS
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {isOwner && REGISTRY_ADDRESS !== '0x0000000000000000000000000000000000000000' && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Owner actions</CardTitle>
          </CardHeader>
          <p className="mb-4 text-sm text-[rgb(var(--color-text-muted))]">
            You are the registered owner of this contract. You can update metadata, transfer ownership, set a resolver,
            or manage delegates.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/submit?update=${encodeURIComponent(address)}`} className="btn-primary text-sm">
              Update metadata
            </Link>
            {!ownerAction ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setOwnerAction('transfer')}>
                  Transfer ownership
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setOwnerAction('resolver')}>
                  Set resolver
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setOwnerAction('addDelegate')}>
                  Add delegate
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setOwnerAction('removeDelegate')}>
                  Remove delegate
                </Button>
              </>
            ) : null}
          </div>
          {ownerAction === 'transfer' && (
            <form onSubmit={handleTransferOwnership} className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <Input
                label="New owner address"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                placeholder="0x..."
                className="w-full sm:max-w-xs"
              />
              <Button type="submit" variant="primary" size="sm" loading={txPending} disabled={txPending}>
                Submit
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOwnerAction(null)}>
                Cancel
              </Button>
            </form>
          )}
          {ownerAction === 'resolver' && (
            <form onSubmit={handleSetResolver} className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <Input
                label="Resolver address"
                value={resolverAddress}
                onChange={(e) => setResolverAddress(e.target.value)}
                placeholder="0x... or 0x0 to clear"
                className="w-full sm:max-w-xs"
              />
              <Button type="submit" variant="primary" size="sm" loading={txPending} disabled={txPending}>
                Submit
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOwnerAction(null)}>
                Cancel
              </Button>
            </form>
          )}
          {ownerAction === 'addDelegate' && (
            <form onSubmit={handleAddDelegate} className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <Input
                label="Delegate address"
                value={delegateAddress}
                onChange={(e) => setDelegateAddress(e.target.value)}
                placeholder="0x..."
                className="w-full sm:max-w-xs"
              />
              <Input
                label="Expiry (optional, ISO date)"
                type="datetime-local"
                value={delegateExpiry}
                onChange={(e) => setDelegateExpiry(e.target.value)}
                className="w-full sm:max-w-xs"
              />
              <Button type="submit" variant="primary" size="sm" loading={txPending} disabled={txPending}>
                Add
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOwnerAction(null)}>
                Cancel
              </Button>
            </form>
          )}
          {ownerAction === 'removeDelegate' && (
            <form onSubmit={handleRemoveDelegate} className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <Input
                label="Delegate address"
                value={delegateAddress}
                onChange={(e) => setDelegateAddress(e.target.value)}
                placeholder="0x..."
                className="w-full sm:max-w-xs"
              />
              <Button type="submit" variant="danger" size="sm" loading={txPending} disabled={txPending}>
                Remove
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOwnerAction(null)}>
                Cancel
              </Button>
            </form>
          )}
        </Card>
      )}

      {abiFunctions.length > 0 && (
        <Card className="mt-10">
          <CardHeader>
            <CardTitle>ABI viewer</CardTitle>
          </CardHeader>
          <div className="max-h-[420px] overflow-auto rounded-lg border border-[rgb(var(--color-border))]/50 bg-[rgb(var(--color-bg))] p-4 font-mono text-sm">
            {abiFunctions.map((fn: unknown, idx: number) => {
              const f = fn as {
                name?: string;
                stateMutability?: string;
                inputs?: { type: string; name: string }[];
              };
              return (
                <div
                  key={idx}
                  className="border-b border-[rgb(var(--color-border))]/30 py-3 last:border-0"
                >
                  <span className="text-[rgb(var(--color-accent))]">{f.stateMutability || 'nonpayable'}</span>{' '}
                  <span className="font-semibold text-[rgb(var(--color-text))]">{f.name}</span>(
                  {f.inputs?.map((input, i) => (
                    <span key={i} className="text-[rgb(var(--color-text-muted))]">
                      {input.type} {input.name}
                      {i < (f.inputs?.length ?? 0) - 1 ? ', ' : ''}
                    </span>
                  ))}
                  )
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

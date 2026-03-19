'use client';

import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { useState, useEffect } from 'react';
import { getSubmissions, approveSubmission, rejectSubmission } from '../../services/api';
import { REGISTRY_ADDRESS, REGISTRY_ABI, MetadataStatus } from '../../lib/registry';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

type Submission = {
  id: string;
  contractAddress: string;
  status: string;
  checksum: string;
  cid: string;
  createdAt: string;
  version?: number;
};

export default function AdminPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const { writeContractAsync } = useWriteContract();

  const { data: moderatorRole } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'MODERATOR_ROLE',
    query: { enabled: !!REGISTRY_ADDRESS && REGISTRY_ADDRESS !== '0x0000000000000000000000000000000000000000' },
  });

  const { data: hasRole } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'hasRole',
    args: moderatorRole && address ? [moderatorRole as `0x${string}`, address] : undefined,
    query: { enabled: !!REGISTRY_ADDRESS && !!moderatorRole && !!address },
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getSubmissions('PENDING,VERIFIED');
        setSubmissions(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load submissions');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleApprove = async (sub: Submission) => {
    if (!REGISTRY_ADDRESS || REGISTRY_ADDRESS === '0x0000000000000000000000000000000000000000' || !publicClient) {
      alert('Registry not configured or wallet not ready');
      return;
    }
    setApprovingId(sub.id);
    try {
      const record = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'getRecord',
        args: [sub.contractAddress as `0x${string}`],
      });
      const version = typeof record?.version === 'bigint' ? record.version : BigInt(record?.version ?? 0);
      const status = typeof record?.status === 'number' ? record.status : Number(record?.status ?? 0);
      if (Number(version) === 0 || status === MetadataStatus.None) {
        alert('No pending record on-chain for this contract. The submitter may not have sent the transaction yet.');
        return;
      }
      if (status !== MetadataStatus.Pending) {
        alert('On-chain record is not pending. It may already be approved or rejected.');
        return;
      }
      const hash = await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'approve',
        args: [sub.contractAddress as `0x${string}`, version],
      });
      await approveSubmission(sub.id, {
        txHash: hash,
        version: Number(version),
        moderatorAddress: address ?? undefined
      });
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (sub: Submission) => {
    if (!REGISTRY_ADDRESS || REGISTRY_ADDRESS === '0x0000000000000000000000000000000000000000' || !publicClient) {
      alert('Registry not configured or wallet not ready');
      return;
    }
    const reason = typeof window !== 'undefined' ? prompt('Reason for rejection?') ?? undefined : undefined;
    setRejectingId(sub.id);
    try {
      const record = await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'getRecord',
        args: [sub.contractAddress as `0x${string}`],
      });
      const version = typeof record?.version === 'bigint' ? record.version : BigInt(record?.version ?? 0);
      const status = typeof record?.status === 'number' ? record.status : Number(record?.status ?? 0);
      if (Number(version) === 0 || status === MetadataStatus.None) {
        await rejectSubmission(sub.id, reason, address ?? undefined);
        setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
        return;
      }
      await writeContractAsync({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'reject',
        args: [sub.contractAddress as `0x${string}`, version, reason ?? ''],
      });
      await rejectSubmission(sub.id, reason, address ?? undefined);
      setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div className="page-section container-wide">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[rgb(var(--color-text))] sm:text-4xl">
          Moderator dashboard
        </h1>
        <p className="mt-2 text-[rgb(var(--color-text-muted))]">
          Review and approve or reject pending metadata submissions. Requires MODERATOR_ROLE on the registry.
        </p>
      </div>

      {!address ? (
        <Card padding="lg">
          <p className="text-[rgb(var(--color-text-muted))]">Please connect your wallet to access the dashboard.</p>
        </Card>
      ) : REGISTRY_ADDRESS !== '0x0000000000000000000000000000000000000000' && hasRole === false ? (
        <Card padding="lg">
          <p className="text-[rgb(var(--color-danger))]">Your wallet does not have MODERATOR_ROLE on the registry.</p>
        </Card>
      ) : (
        <Card padding="none">
          {error && (
            <div className="border-b border-[rgb(var(--color-border))]/50 bg-[rgb(var(--color-danger))]/10 px-6 py-3 text-sm text-[rgb(var(--color-danger))]">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-[rgb(var(--color-text-muted))]">
              <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="divide-y divide-[rgb(var(--color-border))]/30 sm:hidden">
                {submissions.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <svg className="mx-auto h-10 w-10 text-[rgb(var(--color-text-muted))]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="mt-2 text-sm text-[rgb(var(--color-text-muted))]">No pending submissions.</p>
                  </div>
                ) : (
                  submissions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex flex-col gap-3 px-4 py-4"
                    >
                      <p className="break-all font-mono text-xs text-[rgb(var(--color-text))]">
                        {sub.contractAddress}
                      </p>
                      <p className="truncate font-mono text-xs text-[rgb(var(--color-text-muted))]">
                        CID: {sub.cid}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleApprove(sub)}
                          disabled={approvingId !== null}
                          loading={approvingId === sub.id}
                          className="flex-1 sm:flex-none"
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleReject(sub)}
                          disabled={rejectingId !== null}
                          loading={rejectingId === sub.id}
                          className="flex-1 sm:flex-none"
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <table className="hidden w-full text-left text-sm sm:table">
                <thead>
                  <tr className="border-b border-[rgb(var(--color-border))]/50 bg-[rgb(var(--color-bg-muted))]/30">
                    <th className="px-4 py-4 font-medium text-[rgb(var(--color-text))] sm:px-6">Address</th>
                    <th className="px-4 py-4 font-medium text-[rgb(var(--color-text))] sm:px-6">CID</th>
                    <th className="px-4 py-4 font-medium text-[rgb(var(--color-text))] sm:px-6">Checksum</th>
                    <th className="px-4 py-4 font-medium text-[rgb(var(--color-text))] sm:px-6">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-[rgb(var(--color-text-muted))]">
                        No pending submissions.
                      </td>
                    </tr>
                  ) : (
                    submissions.map((sub) => (
                      <tr
                        key={sub.id}
                        className="border-b border-[rgb(var(--color-border))]/30 transition-colors hover:bg-[rgb(var(--color-bg-muted))]/20"
                      >
                        <td className="px-4 py-4 font-mono text-xs text-[rgb(var(--color-text))] sm:px-6">
                          {sub.contractAddress}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-4 font-mono text-xs text-[rgb(var(--color-text-muted))] sm:px-6">
                          {sub.cid}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-4 font-mono text-xs text-[rgb(var(--color-text-muted))] sm:px-6">
                          {sub.checksum}
                        </td>
                        <td className="px-4 py-4 sm:px-6">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleApprove(sub)}
                              disabled={approvingId !== null}
                              loading={approvingId === sub.id}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleReject(sub)}
                              disabled={rejectingId !== null}
                              loading={rejectingId === sub.id}
                            >
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

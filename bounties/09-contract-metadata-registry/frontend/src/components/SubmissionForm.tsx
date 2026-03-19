'use client';

import { useState, useEffect } from 'react';

function parseRevertReason(raw: string): string {
    if (raw.includes('NotContractOwner')) {
        return 'The contract address must be a deployed contract with an owner() function, and your connected wallet must be its owner. If you used your wallet address, use a contract address instead (e.g. deploy MockOwnable for testing).';
    }
    if (raw.includes('InvalidSignature')) {
        return 'Ownership verification failed. Ensure your connected wallet is the owner of the contract at the given address.';
    }
    if (raw.includes('InvalidContractAddress')) {
        return 'Invalid contract address. It must be a non-zero address.';
    }
    if (raw.includes('SignatureExpired')) {
        return 'Your signature has expired. Please submit again.';
    }
    if (raw.includes('SignatureReplay')) {
        return 'This signature was already used. Please submit again with a new signature.';
    }
    return raw;
}
import { useSearchParams } from 'next/navigation';
import { useAccount, useSignTypedData, useChainId, useWriteContract } from 'wagmi';
import { prepareSubmission, finalizeSubmission, uploadLogo } from '../services/api';
import { REGISTRY_ADDRESS, REGISTRY_ABI, REGISTRY_IMPLEMENTATION_ADDRESS } from '../lib/registry';
import { Button } from './ui/Button';
import { Input, Textarea } from './ui/Input';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

export function SubmissionForm() {
    const searchParams = useSearchParams();
    const updateAddress = searchParams.get('update');
    const isUpdateMode = !!updateAddress && /^0x[a-fA-F0-9]{40}$/.test(updateAddress);

    const { address } = useAccount();
    const chainId = useChainId();
    const { signTypedDataAsync } = useSignTypedData();
    const { writeContractAsync } = useWriteContract();

    const [contractAddress, setContractAddress] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [abiJson, setAbiJson] = useState('');
    const [website, setWebsite] = useState('');
    const [tags, setTags] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ submissionId?: string; message?: string } | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [contractAddressError, setContractAddressError] = useState<string | null>(null);

    useEffect(() => {
        if (isUpdateMode && updateAddress) {
            setContractAddress(updateAddress);
        }
    }, [isUpdateMode, updateAddress]);

    const norm = (a: string) => a?.toLowerCase().trim() || '';
    const isRegistryProxy = REGISTRY_ADDRESS !== '0x0000000000000000000000000000000000000000' && norm(contractAddress) === norm(REGISTRY_ADDRESS);
    const isRegistryImplementation = !!REGISTRY_IMPLEMENTATION_ADDRESS && norm(contractAddress) === norm(REGISTRY_IMPLEMENTATION_ADDRESS);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setContractAddressError(null);
        if (!address) {
            setContractAddressError('Connect wallet first');
            return;
        }
        if (isRegistryProxy) {
            setContractAddressError('This is the registry (proxy) address. Enter the address of the contract whose metadata you want to register (e.g. your token or NFT contract), not the registry.');
            return;
        }
        if (isRegistryImplementation) {
            setContractAddressError('This is the registry implementation address. Enter the address of your contract (e.g. your token or NFT contract). Do not use the implementation address here.');
            return;
        }
        setLoading(true);
        setResult(null);
        setSubmitError(null);

        try {
            if (!address || !chainId) throw new Error('Wallet not connected');

            let logoUrl: string | undefined;
            if (logoFile) {
                const uploaded = await uploadLogo(logoFile);
                logoUrl = uploaded.url;
            }

            const metadata = {
                name,
                description,
                abi: JSON.parse(abiJson),
                bytecodeHash: '0x' + '0'.repeat(64),
                compiler: {
                    version: '0.8.26',
                    optimizerRuns: 200,
                    language: 'Solidity',
                },
                logoUrl,
                website: website || undefined,
                tags: tags
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
            };

            const { cid, checksum } = await prepareSubmission(metadata);

            const domain = {
                name: 'ConfluxMetadataRegistry',
                version: '1',
                chainId,
                verifyingContract: REGISTRY_ADDRESS as `0x${string}`,
            } as const;

            const types = {
                Submission: [
                    { name: 'contractAddress', type: 'address' },
                    { name: 'metadataCid', type: 'string' },
                    { name: 'checksum', type: 'bytes32' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' },
                ],
            } as const;

            const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
            const nonce = BigInt(Date.now());

            const signature = await signTypedDataAsync({
                domain,
                types,
                primaryType: 'Submission',
                message: {
                    contractAddress: contractAddress as `0x${string}`,
                    metadataCid: cid,
                    checksum: checksum as `0x${string}`,
                    nonce,
                    deadline,
                },
            });

            const r = signature.slice(0, 66) as `0x${string}`;
            const s = (`0x${signature.slice(66, 130)}`) as `0x${string}`;
            const vHex = signature.slice(130, 132);
            const v = parseInt(vHex, 16);
            const proof = { v, r, s, nonce, deadline };

            if (isUpdateMode) {
                if (REGISTRY_ADDRESS === '0x0000000000000000000000000000000000000000') {
                    throw new Error('Registry not configured');
                }
                await writeContractAsync({
                    address: REGISTRY_ADDRESS,
                    abi: REGISTRY_ABI,
                    functionName: 'updateMetadata',
                    args: [
                        contractAddress as `0x${string}`,
                        cid,
                        checksum as `0x${string}`,
                        proof,
                    ],
                });
                setResult({ message: 'Metadata update submitted on-chain. A new pending version was created.' });
                return;
            }

            const data = await finalizeSubmission({
                contractAddress,
                cid,
                checksum,
                signature,
                submitter: address,
                metadata,
            });

            if (REGISTRY_ADDRESS && REGISTRY_ADDRESS !== '0x0000000000000000000000000000000000000000') {
                await writeContractAsync({
                    address: REGISTRY_ADDRESS,
                    abi: REGISTRY_ABI,
                    functionName: 'submitMetadata',
                    args: [
                        contractAddress as `0x${string}`,
                        cid,
                        checksum as `0x${string}`,
                        proof,
                    ],
                });
            }

            setResult(data);
        } catch (err: unknown) {
            let message = err instanceof Error ? err.message : 'Submission failed';
            if (message.includes('revert') || message.includes('reverted')) {
                message = parseRevertReason(message);
            }
            setSubmitError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card padding="lg">
            {isUpdateMode && (
                <div className="mb-4 rounded-lg border border-[rgb(var(--color-accent))]/40 bg-[rgb(var(--color-accent))]/10 px-4 py-2 text-sm text-[rgb(var(--color-accent))]">
                    Update mode: submitting new metadata for this contract will create a new pending version on-chain.
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                    label="Contract address"
                    value={contractAddress}
                    onChange={(e) => { setContractAddress(e.target.value); setContractAddressError(null); }}
                    placeholder="0x... (must be a contract you own with owner())"
                    required
                    readOnly={isUpdateMode}
                    error={contractAddressError ?? undefined}
                />
                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    The address must be a deployed contract that has an <code className="font-mono">owner()</code> function (e.g. OpenZeppelin Ownable). Your connected wallet must be the owner. Do not use your wallet address.
                </p>
                <Input
                    label="Project name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My DApp"
                    required
                />
                <Textarea
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description of the contract or project."
                    rows={3}
                />
                <Input
                    label="Website (optional)"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                />
                <Input
                    label="Tags (comma-separated, optional)"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="dex, lending, nft"
                />
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-[rgb(var(--color-text))]">
                        Logo (optional)
                    </label>
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml"
                        onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                        className="input-base file:mr-3 file:rounded-lg file:border-0 file:bg-[rgb(var(--color-accent))]/20 file:px-3 file:py-1.5 file:text-sm file:text-[rgb(var(--color-accent))]"
                    />
                </div>
                <Textarea
                    label="ABI (JSON)"
                    value={abiJson}
                    onChange={(e) => setAbiJson(e.target.value)}
                    placeholder='[{"type":"function","name":"balanceOf",...}]'
                    className="font-mono text-xs min-h-[140px]"
                    rows={6}
                    required
                />
                <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    loading={loading}
                    className="py-3"
                >
                    {loading ? 'Processing…' : isUpdateMode ? 'Update metadata (on-chain)' : 'Submit metadata'}
                </Button>
                {result && (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[rgb(var(--color-success))]/30 bg-[rgb(var(--color-success))]/10 p-4">
                        <Badge variant="success">Success</Badge>
                        <span className="text-sm text-[rgb(var(--color-text))]">
                            {result.submissionId ? (
                                <>Submission ID: <code className="font-mono text-xs">{result.submissionId}</code></>
                            ) : (
                                result.message
                            )}
                        </span>
                    </div>
                )}
                {submitError && (
                    <div className="flex flex-col gap-2 rounded-lg border border-[rgb(var(--color-danger))]/30 bg-[rgb(var(--color-danger))]/10 p-4">
                        <div className="flex items-center gap-2">
                            <Badge variant="danger">Error</Badge>
                            <span className="text-sm text-[rgb(var(--color-danger))]">{submitError}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSubmitError(null)}
                            className="self-end text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                )}
            </form>
        </Card>
    );
}

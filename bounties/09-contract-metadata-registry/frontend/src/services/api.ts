const API_URL = typeof window === 'undefined'
    ? (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1')
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1');

export async function prepareSubmission(metadata: any) {
    const response = await fetch(`${API_URL}/submissions/prepare`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Preparation failed');
    }

    return response.json();
}

export async function finalizeSubmission(data: any) {
    const response = await fetch(`${API_URL}/submissions/finalize`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Finalization failed');
    }

    return response.json();
}

export async function getMetadata(address: string) {
    const response = await fetch(`${API_URL}/metadata/${address}`);
    if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Fetch failed');
    }
    return response.json();
}

export async function uploadLogo(file: File) {
    const form = new FormData();
    form.append('file', file);

    const res = await fetch(`${API_URL}/assets/logo`, {
        method: 'POST',
        body: form
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Logo upload failed');
    }
    return res.json();
}

export async function getMetadataSearch(params: { q?: string; tag?: string }) {
    const url = new URL(`${API_URL}/metadata/`);
    if (params.q) url.searchParams.set('q', params.q);
    if (params.tag) url.searchParams.set('tag', params.tag);

    const res = await fetch(url.toString());
    if (!res.ok) {
        throw new Error('Search failed');
    }
    return res.json();
}

/** Fetch submissions. status: single or comma-separated, e.g. PENDING,VERIFIED */
export async function getSubmissions(status?: string) {
    const url = new URL(`${API_URL}/submissions`);
    if (status) url.searchParams.set('status', status);

    const res = await fetch(url.toString());
    if (!res.ok) {
        throw new Error('Failed to load submissions');
    }
    return res.json();
}

/** Version history for a contract */
export async function getContractVersionHistory(contractAddress: string) {
    const url = new URL(`${API_URL}/submissions`);
    url.searchParams.set('contractAddress', contractAddress);

    const res = await fetch(url.toString());
    if (!res.ok) {
        throw new Error('Failed to load version history');
    }
    return res.json();
}

export async function approveSubmission(
    id: string,
    options?: { txHash?: string; version?: number; moderatorAddress?: string }
) {
    const res = await fetch(`${API_URL}/submissions/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options ?? {})
    });
    if (!res.ok) {
        throw new Error('Failed to approve submission');
    }
    return res.json();
}

export async function rejectSubmission(id: string, reason?: string, moderatorAddress?: string) {
    const res = await fetch(`${API_URL}/submissions/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, moderatorAddress })
    });
    if (!res.ok) {
        throw new Error('Failed to reject submission');
    }
    return res.json();
}

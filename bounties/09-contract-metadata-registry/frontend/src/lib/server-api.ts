/** Fetches metadata from API for SSR. Used by the contract page. */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

export interface MetadataRecord {
  contractAddress: string;
  version?: number;
  cid: string;
  checksum: string;
  status: string;
}

export interface FullMetadata extends MetadataRecord {
  name?: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  tags?: string[];
  abi?: unknown[];
  [key: string]: unknown;
}

export async function getMetadataRecord(address: string): Promise<MetadataRecord | null> {
  try {
    const res = await fetch(`${API_URL}/metadata/${address}`, {
      next: { revalidate: 60 },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getFullMetadata(address: string): Promise<FullMetadata | null> {
  try {
    const res = await fetch(`${API_URL}/metadata/${address}/full`, {
      next: { revalidate: 60 },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

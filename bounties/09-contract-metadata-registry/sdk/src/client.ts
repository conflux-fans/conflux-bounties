import fetch from 'cross-fetch';

export interface MetadataResponse {
  contractAddress: string;
  version: number;
  cid: string;
  checksum: string;
  status: string;
  metadata?: any;
}

export interface SdkOptions {
  baseUrl?: string;
}

const DEFAULT_BASE_URL = 'http://localhost:3000/v1';

export class ConfluxMetadataClient {
  private readonly baseUrl: string;

  constructor(options?: SdkOptions) {
    this.baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  }

  /** Registry record – CID, checksum, version. Use for on-chain proof. */
  async getMetadata(address: string): Promise<MetadataResponse | null> {
    const res = await fetch(`${this.baseUrl}/metadata/${address}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Failed to fetch metadata (${res.status})`);
    }
    return res.json() as Promise<MetadataResponse>;
  }

  /** Full metadata from IPFS. Pass options.etag for caching; 304 returns { notModified: true }. */
  async getMetadataFull(
    address: string,
    options?: { etag?: string }
  ): Promise<
    | { data: MetadataResponse & Record<string, unknown>; etag: string | null }
    | { notModified: true }
    | null
  > {
    const headers: Record<string, string> = {};
    if (options?.etag) headers['If-None-Match'] = options.etag;
    const res = await fetch(`${this.baseUrl}/metadata/${address}/full`, { headers });
    if (res.status === 404) return null;
    if (res.status === 304) return { notModified: true };
    if (!res.ok) {
      throw new Error(`Failed to fetch full metadata (${res.status})`);
    }
    const etag = res.headers.get('ETag');
    const data = (await res.json()) as MetadataResponse & Record<string, unknown>;
    return { data, etag };
  }
}


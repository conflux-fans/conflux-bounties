/**
 * Conflux Contract Metadata Registry SDK
 *
 * Lightweight client for wallets and explorers to fetch contract metadata.
 *
 * @example
 * ```ts
 * import { RegistryClient } from '@conflux-registry/sdk';
 *
 * const client = new RegistryClient('https://registry-api.example.com');
 * const metadata = await client.getMetadata('0x1234...');
 * console.log(metadata.name, metadata.abi);
 * ```
 */

export interface ContractMetadata {
  name: string;
  description?: string;
  abi: any[];
  compiler?: {
    name: string;
    version: string;
  };
  bytecodeHash?: string;
  website?: string;
  tags?: string[];
}

export interface ContractRecord {
  id: number;
  contractAddress: string;
  submitterAddress: string;
  metadataCid: string | null;
  contentHash: string | null;
  rawMetadata: ContractMetadata;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchOptions {
  tag?: string;
  query?: string;
  page?: number;
  limit?: number;
}

export interface SearchResult {
  data: ContractRecord[];
  page: number;
  limit: number;
}

export interface CacheOptions {
  /** Time-to-live in milliseconds. Default: 5 minutes */
  ttl?: number;
  /** Custom cache implementation */
  cache?: Map<string, { data: any; expires: number }>;
}

/**
 * Client for the Conflux Contract Metadata Registry API.
 */
export class RegistryClient {
  private baseUrl: string;
  private cache: Map<string, { data: any; expires: number }>;
  private ttl: number;

  /**
   * Create a new registry client.
   * @param baseUrl - The base URL of the registry API (e.g., 'http://localhost:3001')
   * @param options - Optional caching configuration
   */
  constructor(baseUrl: string, options?: CacheOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.cache = options?.cache || new Map();
    this.ttl = options?.ttl ?? 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Get metadata for a contract address.
   * Returns the latest approved metadata or null if not found.
   *
   * @example
   * ```ts
   * const meta = await client.getMetadata('0x1234...');
   * if (meta) {
   *   console.log('Contract name:', meta.rawMetadata.name);
   *   console.log('ABI:', meta.rawMetadata.abi);
   * }
   * ```
   */
  async getMetadata(contractAddress: string): Promise<ContractRecord | null> {
    const key = `contract:${contractAddress.toLowerCase()}`;
    const cached = this.getFromCache(key);
    if (cached) return cached;

    const res = await fetch(`${this.baseUrl}/api/contracts/${contractAddress}`);

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch metadata: ${res.statusText}`);
    }

    const data = await res.json();
    this.setCache(key, data);
    return data;
  }

  /**
   * Search for contracts by tag or query string.
   *
   * @example
   * ```ts
   * // Find all ERC20 tokens
   * const tokens = await client.search({ tag: 'ERC20' });
   *
   * // Search by name
   * const results = await client.search({ query: 'Token' });
   * ```
   */
  async search(options: SearchOptions = {}): Promise<SearchResult> {
    const params = new URLSearchParams();
    if (options.tag) params.set("tag", options.tag);
    if (options.query) params.set("q", options.query);
    if (options.page) params.set("page", options.page.toString());
    if (options.limit) params.set("limit", options.limit.toString());

    const url = `${this.baseUrl}/api/contracts?${params}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Search failed: ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Get the ABI for a contract address.
   * Convenience method that returns just the ABI array.
   *
   * @example
   * ```ts
   * const abi = await client.getABI('0x1234...');
   * const contract = new ethers.Contract(address, abi, provider);
   * ```
   */
  async getABI(contractAddress: string): Promise<any[] | null> {
    const metadata = await this.getMetadata(contractAddress);
    return metadata?.rawMetadata?.abi ?? null;
  }

  /**
   * Check the status of a submission.
   *
   * @example
   * ```ts
   * const status = await client.getSubmissionStatus(123);
   * console.log(status.status); // 'pending' | 'approved' | 'rejected' | etc.
   * ```
   */
  async getSubmissionStatus(submissionId: number): Promise<ContractRecord | null> {
    const res = await fetch(`${this.baseUrl}/api/submissions/${submissionId}`);

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch submission: ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Get IPFS gateway URL for a metadata CID.
   *
   * @example
   * ```ts
   * const meta = await client.getMetadata('0x1234...');
   * if (meta?.metadataCid) {
   *   const url = client.getIPFSUrl(meta.metadataCid);
   *   // https://gateway.pinata.cloud/ipfs/Qm...
   * }
   * ```
   */
  getIPFSUrl(cid: string, gateway = "https://gateway.pinata.cloud"): string {
    return `${gateway}/ipfs/${cid}`;
  }

  /**
   * Clear the local cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttl,
    });
  }
}

export default RegistryClient;

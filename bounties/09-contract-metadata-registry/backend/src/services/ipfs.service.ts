import { env } from "../config/env";

interface PinResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export class IpfsService {
  private baseUrl = "https://api.pinata.cloud";
  private headers: Record<string, string>;

  constructor() {
    this.headers = {
      Authorization: `Bearer ${env.PINATA_JWT}`,
      "Content-Type": "application/json",
    };
  }

  async pinJSON(data: unknown, name: string): Promise<PinResponse> {
    const res = await fetch(`${this.baseUrl}/pinning/pinJSONToIPFS`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        pinataContent: data,
        pinataMetadata: { name },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pinata pin failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<PinResponse>;
  }

  async unpin(cid: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/pinning/unpin/${cid}`, {
      method: "DELETE",
      headers: this.headers,
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`Pinata unpin failed (${res.status})`);
    }
  }

  async fetchFromGateway(cid: string): Promise<unknown> {
    const res = await fetch(`${env.PINATA_GATEWAY}/ipfs/${cid}`);
    if (!res.ok) {
      throw new Error(`IPFS gateway fetch failed (${res.status})`);
    }
    return res.json();
  }

  async checkPinStatus(cid: string): Promise<string> {
    const res = await fetch(
      `${this.baseUrl}/data/pinList?hashContains=${cid}&status=pinned`,
      { headers: this.headers }
    );

    if (!res.ok) {
      throw new Error(`Pinata status check failed (${res.status})`);
    }

    const data = (await res.json()) as { count: number };
    return data.count > 0 ? "pinned" : "not_found";
  }
}

export const ipfsService = new IpfsService();

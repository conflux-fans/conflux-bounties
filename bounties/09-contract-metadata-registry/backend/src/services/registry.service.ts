import { ethers } from "ethers";
import { provider } from "../lib/rpc";
import { env } from "../config/env";
import { REGISTRY_ABI } from "../lib/abi";

export class RegistryService {
  private contract: ethers.Contract;

  constructor() {
    this.contract = new ethers.Contract(env.REGISTRY_ADDRESS, REGISTRY_ABI, provider);
  }

  async getRecord(contractAddr: string) {
    const record = await this.contract.getRecord(contractAddr);
    return {
      owner: record.owner,
      metadataCid: record.metadataCid,
      contentHash: record.contentHash,
      version: Number(record.version),
      status: Number(record.status),
      lastUpdated: Number(record.lastUpdated),
    };
  }

  async isDelegate(contractAddr: string, delegate: string): Promise<boolean> {
    return this.contract.isDelegate(contractAddr, delegate);
  }

  async getResolver(contractAddr: string): Promise<string> {
    return this.contract.getResolver(contractAddr);
  }
}

export const registryService = new RegistryService();

import { ethers } from "ethers";
import { provider } from "../lib/rpc";

export class VerificationService {
  /**
   * Check if `claimedOwner` is the owner of the contract at `contractAddr`
   * by calling owner() on the target contract.
   */
  async verifyOwnership(contractAddr: string, claimedOwner: string): Promise<boolean> {
    try {
      const contract = new ethers.Contract(
        contractAddr,
        ["function owner() view returns (address)"],
        provider
      );
      const owner: string = await contract.owner();
      return owner.toLowerCase() === claimedOwner.toLowerCase();
    } catch {
      // Contract may not have owner() — skip ownership check
      return false;
    }
  }

  /**
   * Fetch on-chain bytecode and return its keccak256 hash.
   */
  async getBytecodeHash(contractAddr: string): Promise<string | null> {
    try {
      const bytecode = await provider.getCode(contractAddr);
      if (bytecode === "0x") return null;
      return ethers.keccak256(bytecode);
    } catch {
      return null;
    }
  }

  /**
   * Verify that the claimed bytecodeHash matches the on-chain bytecode.
   */
  async verifyBytecodeChecksum(
    contractAddr: string,
    claimedHash: string
  ): Promise<boolean> {
    const actualHash = await this.getBytecodeHash(contractAddr);
    if (!actualHash) return false;
    return actualHash.toLowerCase() === claimedHash.toLowerCase();
  }
}

export const verificationService = new VerificationService();

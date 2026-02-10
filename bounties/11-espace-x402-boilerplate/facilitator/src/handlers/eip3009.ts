/**
 * EIP-3009 payment handler — gasless for buyer
 *
 * Used for tokens supporting transferWithAuthorization (USDT0 on mainnet).
 * Buyer signs EIP-712 typed data off-chain, facilitator executes on-chain.
 */

import { ethers } from 'ethers';
import { TRANSFER_AUTH_TYPES, ERC20_ABI, EIP3009_ABI } from '../config.js';

export async function verifyEip3009(
  body: any,
  provider: ethers.JsonRpcProvider,
): Promise<{ valid: boolean; reason?: string }> {
  const { payload, token, network, treasury } = body;

  try {
    if (payload.x402Version !== 2) return { valid: false, reason: 'Unsupported x402 version' };
    if (payload.network !== network.caip2) return { valid: false, reason: `Wrong network: ${payload.network}` };

    const { from, to, value, validAfter, validBefore, nonce } = payload.payload.authorization;

    // Verify EIP-712 signature
    const domain = {
      name: token.eip712Name,
      version: token.eip712Version,
      chainId: network.chainId,
      verifyingContract: token.address,
    };

    const message = { from, to, value, validAfter, validBefore, nonce };
    const recovered = ethers.verifyTypedData(domain, TRANSFER_AUTH_TYPES, message, payload.payload.signature);

    if (recovered.toLowerCase() !== from.toLowerCase()) {
      return { valid: false, reason: 'Invalid signature' };
    }

    if (to.toLowerCase() !== treasury.toLowerCase()) {
      return { valid: false, reason: 'Wrong payment destination' };
    }

    // Check balance
    const erc20 = new ethers.Contract(token.address, ERC20_ABI, provider);
    const balance = await erc20.balanceOf(from);
    if (balance < BigInt(value)) {
      return { valid: false, reason: 'Insufficient balance' };
    }

    // Check time window
    const now = Math.floor(Date.now() / 1000);
    if (now < Number(validAfter) || now > Number(validBefore)) {
      return { valid: false, reason: 'Authorization expired or not yet valid' };
    }

    // Check amount
    if (BigInt(value) < BigInt(token.pricePerQuery)) {
      return { valid: false, reason: 'Insufficient amount' };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: err.message };
  }
}

export async function settleEip3009(
  body: any,
  wallet: ethers.Wallet,
): Promise<{ success: boolean; transaction?: string; payer?: string; error?: string }> {
  const { payload, token } = body;

  try {
    const { from, to, value, validAfter, validBefore, nonce } = payload.payload.authorization;
    const contract = new ethers.Contract(token.address, EIP3009_ABI, wallet);

    const tx = await contract.transferWithAuthorization(
      from, to, value, validAfter, validBefore, nonce,
      payload.payload.signature,
      { gasLimit: 200_000 },
    );

    console.log(`[eip3009] TX sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[eip3009] Confirmed in block ${receipt!.blockNumber}`);

    return { success: true, transaction: receipt!.hash, payer: from };
  } catch (err: any) {
    console.error('[eip3009] Settle error:', err.message);
    return { success: false, error: err.reason || err.message };
  }
}

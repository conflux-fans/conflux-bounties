/**
 * Native CFX payment handler — direct transfer
 *
 * Buyer sends a CFX transaction to the PaymentReceiver contract
 * calling payNative(invoiceId). Facilitator verifies the TX.
 */

import { ethers } from 'ethers';

export async function verifyNative(
  body: any,
  provider: ethers.JsonRpcProvider,
): Promise<{ valid: boolean; reason?: string }> {
  const { payload, token, treasury } = body;

  try {
    if (payload.x402Version !== 2) return { valid: false, reason: 'Unsupported x402 version' };

    const { txHash, from, amount } = payload.payload;

    if (!txHash) return { valid: false, reason: 'Missing txHash' };

    // Verify transaction
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return { valid: false, reason: 'Transaction not found' };
    if (receipt.status !== 1) return { valid: false, reason: 'Transaction failed' };

    // Verify the transaction sent enough CFX
    const tx = await provider.getTransaction(txHash);
    if (!tx) return { valid: false, reason: 'Transaction data not found' };

    if (tx.value < BigInt(amount || token.pricePerQuery)) {
      return { valid: false, reason: 'Insufficient CFX amount' };
    }

    // Verify sender
    if (from && tx.from.toLowerCase() !== from.toLowerCase()) {
      return { valid: false, reason: 'Sender mismatch' };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: err.message };
  }
}

export async function settleNative(
  body: any,
  _wallet: ethers.Wallet,
): Promise<{ success: boolean; transaction?: string; payer?: string; error?: string }> {
  const { payload } = body;

  try {
    // For native CFX, the buyer already sent the transaction.
    // Settlement is just confirming it's on-chain (verified above).
    const { txHash, from } = payload.payload;

    return { success: true, transaction: txHash, payer: from };
  } catch (err: any) {
    console.error('[native] Settle error:', err.message);
    return { success: false, error: err.message };
  }
}

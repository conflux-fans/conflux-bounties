/**
 * ERC-20 payment handler — approve + transferFrom
 *
 * Used for tokens without EIP-3009 (USDT, USDC, AxCNH, testnet faucet tokens).
 * Flow: buyer calls approve() on token → submits tx hash → facilitator verifies.
 *
 * The buyer sends the approve TX hash in the payload. Facilitator checks that:
 *   1. approve() was called with correct spender and amount
 *   2. Calls transferFrom via the X402PaymentReceiver contract
 */

import { ethers } from 'ethers';
import { ERC20_ABI, PAYMENT_RECEIVER_ABI } from '../config.js';

export async function verifyErc20(
  body: any,
  provider: ethers.JsonRpcProvider,
): Promise<{ valid: boolean; reason?: string }> {
  const { payload, token, treasury, paymentContract } = body;

  try {
    if (payload.x402Version !== 2) return { valid: false, reason: 'Unsupported x402 version' };

    const { from, amount, approveTxHash } = payload.payload;

    if (!from || !amount) return { valid: false, reason: 'Missing from or amount' };

    // If approve TX hash provided, verify it's confirmed
    if (approveTxHash) {
      const receipt = await provider.getTransactionReceipt(approveTxHash);
      if (!receipt || receipt.status !== 1) {
        return { valid: false, reason: 'Approve transaction not confirmed' };
      }
    }

    // Check allowance
    const erc20 = new ethers.Contract(token.address, ERC20_ABI, provider);

    // The spender is the PaymentReceiver contract
    const spender = paymentContract;
    if (!spender) return { valid: false, reason: 'Payment contract not configured' };

    const allowance = await erc20.allowance(from, spender);
    if (allowance < BigInt(amount)) {
      return { valid: false, reason: `Insufficient allowance: ${allowance} < ${amount}` };
    }

    // Check balance
    const balance = await erc20.balanceOf(from);
    if (balance < BigInt(amount)) {
      return { valid: false, reason: 'Insufficient balance' };
    }

    // Check amount
    if (BigInt(amount) < BigInt(token.pricePerQuery)) {
      return { valid: false, reason: 'Insufficient amount' };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: err.message };
  }
}

export async function settleErc20(
  body: any,
  wallet: ethers.Wallet,
): Promise<{ success: boolean; transaction?: string; payer?: string; error?: string }> {
  const { payload, token, paymentContract } = body;

  try {
    const { from, amount, invoiceId } = payload.payload;

    if (!paymentContract) return { success: false, error: 'Payment contract not configured' };

    const contract = new ethers.Contract(paymentContract, PAYMENT_RECEIVER_ABI, wallet);

    // Convert invoiceId string to bytes32
    const invoiceBytes = ethers.zeroPadValue(
      ethers.toUtf8Bytes(invoiceId?.substring(0, 31) || 'x402'),
      32,
    );

    const tx = await contract.payWithTokenFrom(
      token.address,
      from,
      amount,
      invoiceBytes,
      { gasLimit: 300_000 },
    );

    console.log(`[erc20] TX sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[erc20] Confirmed in block ${receipt!.blockNumber}`);

    return { success: true, transaction: receipt!.hash, payer: from };
  } catch (err: any) {
    console.error('[erc20] Settle error:', err.message);
    return { success: false, error: err.reason || err.message };
  }
}

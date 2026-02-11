/**
 * x402 Client — handles HTTP 402 flow in the browser
 *
 * 1. Send request → receive 402 + PAYMENT-REQUIRED header
 * 2. Parse payment requirements
 * 3. Execute payment (native / erc20 / eip3009)
 * 4. Retry request with PAYMENT-SIGNATURE header
 */

import { ethers } from 'ethers';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

const PAYMENT_ABI = [
  'function payNative(bytes32 invoiceId) external payable',
  'function payWithToken(address token, uint256 amount, bytes32 invoiceId) external',
];

const TRANSFER_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

export interface PaymentRequirements {
  x402Version: number;
  resource: { url: string; description: string };
  accepts: Array<{
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    extra: {
      paymentMethod: string;
      symbol: string;
      decimals: number;
      name?: string;
      version?: string;
      paymentContract?: string;
    };
  }>;
}

export interface PaymentResult {
  success: boolean;
  data?: any;
  txHash?: string;
  error?: string;
}

export function formatAmount(amount: string, decimals: number): string {
  const val = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const whole = val / divisor;
  const frac = val % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

/**
 * Execute the full x402 pay-and-fetch flow
 */
export async function payAndFetch(
  url: string,
  signer: ethers.Signer,
  onStatus?: (msg: string) => void,
): Promise<PaymentResult> {
  const log = onStatus || (() => {});

  // Step 1: Request → 402
  log('Requesting API...');
  const res1 = await fetch(url);

  if (res1.status !== 402) {
    if (res1.ok) {
      const data = await res1.json();
      return { success: true, data };
    }
    return { success: false, error: `Unexpected status: ${res1.status}` };
  }

  // Step 2: Parse requirements
  const reqHeader = res1.headers.get('PAYMENT-REQUIRED') || res1.headers.get('payment-required');
  if (!reqHeader) {
    return { success: false, error: 'Missing PAYMENT-REQUIRED header' };
  }

  const envelope: PaymentRequirements = JSON.parse(atob(reqHeader));
  const req = envelope.accepts[0];
  const method = req.extra.paymentMethod;

  log(`Payment required: ${formatAmount(req.amount, req.extra.decimals)} ${req.extra.symbol} (${method})`);

  // Step 3: Execute payment
  let x402Payload: any;

  try {
    if (method === 'eip3009') {
      x402Payload = await payEip3009(signer, req);
      log('EIP-3009 signature created');
    } else if (method === 'erc20') {
      x402Payload = await payErc20(signer, req, log);
      log('ERC-20 payment prepared');
    } else {
      x402Payload = await payNative(signer, req, log);
      log('Native CFX payment sent');
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Payment failed' };
  }

  // Step 4: Retry with payment signature
  log('Sending paid request...');
  const paymentSig = btoa(JSON.stringify(x402Payload));

  const res2 = await fetch(url, {
    headers: { 'PAYMENT-SIGNATURE': paymentSig },
  });

  const data = await res2.json();

  if (!res2.ok || !data.success) {
    return { success: false, error: data.message || data.error || 'Settlement failed' };
  }

  return {
    success: true,
    data: data.data,
    txHash: data.data?.payment?.tx_hash,
  };
}

async function payEip3009(signer: ethers.Signer, req: any) {
  const address = await signer.getAddress();
  const chainId = parseInt(req.network.split(':')[1]);
  const nonce = ethers.hexlify(ethers.randomBytes(32));
  const now = Math.floor(Date.now() / 1000);

  const domain = {
    name: req.extra.name,
    version: req.extra.version,
    chainId,
    verifyingContract: req.asset,
  };

  const message = {
    from: address,
    to: req.payTo,
    value: req.amount,
    validAfter: 0,
    validBefore: now + 3600,
    nonce,
  };

  const signature = await (signer as ethers.Wallet).signTypedData(domain, TRANSFER_AUTH_TYPES, message);

  return {
    x402Version: 2,
    scheme: 'exact',
    network: req.network,
    payload: {
      signature,
      authorization: {
        ...message,
        validAfter: '0',
        validBefore: String(now + 3600),
      },
    },
  };
}

async function payErc20(signer: ethers.Signer, req: any, log: (msg: string) => void) {
  const address = await signer.getAddress();
  const paymentContract = req.extra.paymentContract;
  const erc20 = new ethers.Contract(req.asset, ERC20_ABI, signer);

  // Check allowance
  const allowance = await erc20.allowance(address, paymentContract);
  if (allowance < BigInt(req.amount)) {
    log('Approving token spend...');
    const tx = await erc20.approve(paymentContract, req.amount);
    await tx.wait();
    log('Approved');
  }

  return {
    x402Version: 2,
    scheme: 'exact',
    network: req.network,
    payload: {
      from: address,
      amount: req.amount,
      invoiceId: crypto.randomUUID().replace(/-/g, ''),
      approveTxHash: null,
    },
  };
}

async function payNative(signer: ethers.Signer, req: any, log: (msg: string) => void) {
  const address = await signer.getAddress();
  const paymentContract = req.extra.paymentContract;
  const contract = new ethers.Contract(paymentContract, PAYMENT_ABI, signer);
  const invoiceId = ethers.zeroPadValue(ethers.toUtf8Bytes('x402-web'), 32);

  log('Sending CFX transaction...');
  const tx = await contract.payNative(invoiceId, {
    value: req.amount,
    gasLimit: 100_000,
  });
  const receipt = await tx.wait();

  return {
    x402Version: 2,
    scheme: 'exact',
    network: req.network,
    payload: {
      txHash: receipt!.hash,
      from: address,
      amount: req.amount,
    },
  };
}

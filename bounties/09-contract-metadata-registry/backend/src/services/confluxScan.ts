import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.CONFLUXSCAN_API_URL;
const API_KEY = process.env.CONFLUXSCAN_API_KEY;

export interface ConfluxScanVerificationResult {
  success: boolean;
  message?: string;
}

export async function verifyWithConfluxScan(address: string): Promise<ConfluxScanVerificationResult> {
  if (!API_URL) {
    return { success: true };
  }

  try {
    const url = `${API_URL.replace(/\/$/, '')}/contract/info?address=${address}`;
    const res = await fetch(url, {
      headers: API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : undefined
    });
    if (!res.ok) {
      return { success: false, message: `ConfluxScan HTTP ${res.status}` };
    }
    const data: any = await res.json();
    if (data?.status !== 'success') {
      return { success: false, message: 'Contract not verified on ConfluxScan' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message ?? 'ConfluxScan error' };
  }
}


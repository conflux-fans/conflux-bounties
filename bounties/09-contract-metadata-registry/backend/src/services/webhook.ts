import dotenv from 'dotenv';

dotenv.config();

const WEBHOOK_URL = process.env.WEBHOOK_URL;

export interface WebhookPayload {
  event: 'METADATA_APPROVED';
  contractAddress: string;
  version: number;
  cid: string;
  checksum: string;
  status: string;
  approvedAt: string;
}

export async function notifyMetadataApproved(payload: WebhookPayload): Promise<void> {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to send webhook', err);
  }
}


import { getFullMetadata, getMetadataRecord } from '../../../lib/server-api';
import ContractPageClient from './ContractPageClient';

interface PageProps {
  params: { address: string };
}

/** Fetches metadata server-side for first paint; client uses wagmi for on-chain. */
export default async function ContractPage({ params }: PageProps) {
  const { address } = params;
  const [record, full] = await Promise.all([getMetadataRecord(address), getFullMetadata(address)]);

  const initialSummary =
    record != null
      ? { status: record.status, version: record.version, cid: record.cid, checksum: record.checksum }
      : null;
  const initialFullMetadata = full ?? null;

  return (
    <ContractPageClient
      address={address}
      initialSummary={initialSummary}
      initialFullMetadata={initialFullMetadata}
    />
  );
}

import { PrismaClient } from '@prisma/client';
import pinataSDK from '@pinata/sdk';
import { keccak256 } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const pinata = new pinataSDK({
  pinataJWTKey: process.env.PINATA_JWT
});

type Args = {
  address?: string;
  version?: number;
  cid?: string;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Args = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--address') out.address = args[++i];
    else if (a === '--version') out.version = parseInt(args[++i] || '0', 10);
    else if (a === '--cid') out.cid = args[++i];
  }
  return out;
}

async function fetchBytesForCid(cid: string): Promise<Buffer> {
  const gateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';
  const url = `${gateway.replace(/\/$/, '')}/ipfs/${cid}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch CID ${cid}: ${res.status} ${res.statusText}`);
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

async function main() {
  const { address, version, cid } = parseArgs();

  if (!cid && !address) {
    console.error('Usage: ts-node src/scripts/ipfs-repin.ts --cid <cid> | --address <addr> [--version <v>]');
    process.exit(1);
  }

  const targets: { cid: string; checksum: string; address?: string; version?: number }[] = [];

  if (cid) {
    const submissions = await prisma.submission.findMany({
      where: { cid },
      take: 1
    });
    const checksum = submissions[0]?.checksum ?? '0x';
    targets.push({ cid, checksum, address: submissions[0]?.contractAddress, version: submissions[0]?.version ?? undefined });
  } else if (address && version != null) {
    const s = await prisma.submission.findFirst({
      where: { contractAddress: address, version, status: 'APPROVED' }
    });
    if (!s) {
      console.error(`No approved submission found for ${address} version ${version}`);
      process.exit(1);
    }
    targets.push({ cid: s.cid, checksum: s.checksum, address, version });
  } else if (address) {
    const s = await prisma.submission.findFirst({
      where: { contractAddress: address, status: 'APPROVED' },
      orderBy: { version: 'desc' }
    });
    if (!s) {
      console.error(`No approved submission found for ${address}`);
      process.exit(1);
    }
    targets.push({ cid: s.cid, checksum: s.checksum, address, version: s.version ?? undefined });
  }

  for (const t of targets) {
    console.log(`Processing CID ${t.cid} (contract=${t.address ?? 'n/a'}, version=${t.version ?? 'n/a'})`);

    try {
      const bytes = await fetchBytesForCid(t.cid);
      const computed = keccak256(bytes);

      if (t.checksum !== '0x' && t.checksum.toLowerCase() !== computed.toLowerCase()) {
        console.warn(`Checksum mismatch for ${t.cid}. Stored=${t.checksum}, computed=${computed}`);
        console.warn('Remediation: update checksum in DB or re-generate metadata and resubmit.');
      } else {
        console.log(`Checksum OK for ${t.cid}`);
      }

      await pinata.pinByHash(t.cid);
      console.log(`Re-pinned CID ${t.cid} via Pinata`);

      await prisma.ipfsPin.upsert({
        where: { cid: t.cid },
        update: {
          provider: 'pinata',
          status: 'PINNED',
          attempts: { increment: 1 },
          lastError: null
        },
        create: {
          cid: t.cid,
          provider: 'pinata',
          status: 'PINNED',
          attempts: 1
        }
      });
    } catch (err: any) {
      console.error(`Failed to verify/re-pin CID ${t.cid}:`, err?.message ?? err);
      await prisma.ipfsPin.upsert({
        where: { cid: t.cid },
        update: {
          provider: 'pinata',
          status: 'FAILED',
          attempts: { increment: 1 },
          lastError: err?.message ?? 'Unknown error'
        },
        create: {
          cid: t.cid,
          provider: 'pinata',
          status: 'FAILED',
          attempts: 1,
          lastError: err?.message ?? 'Unknown error'
        }
      });
      console.warn('Remediation: check network, CID validity, and Pinata credentials, then retry the CLI.');
    }
  }

  await prisma.$disconnect();
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();


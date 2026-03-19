import { AUTOMATION_MANAGER_ABI } from '@cfxdevkit/sdk/automation';
import { createPublicClient, http, parseEventLogs } from 'viem';

function usage() {
  console.log(`Usage: pnpm dlx tsx scripts/fetch-user-jobs.ts --rpc <RPC_URL> --am <AutomationManagerAddress> --owner <ownerAddress> [--fromBlock <num>] [--toBlock <num>]

Example:
  pnpm dlx tsx scripts/fetch-user-jobs.ts --rpc https://evm.confluxrpc.com \\
    --am 0x9D5B131e5bA37A238cd1C485E2D9d7c2A68E1d0F --owner 0xYourAddress
`);
}

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const rpc = getArg('--rpc') || getArg('-r');
  const am = getArg('--am') || getArg('-a');
  const owner = getArg('--owner') || getArg('-o');
  const fromBlockArg = getArg('--fromBlock');
  const toBlockArg = getArg('--toBlock');

  if (!rpc || !am || !owner) {
    usage();
    process.exitCode = 2;
    return;
  }

  const client = createPublicClient({ transport: http(rpc) });

  const opts: any = { address: am };
  if (fromBlockArg) opts.fromBlock = BigInt(fromBlockArg);
  if (toBlockArg) opts.toBlock = BigInt(toBlockArg);

  console.log(`Fetching logs for AutomationManager=${am} from RPC=${rpc} ...`);
  const logs = await client.getLogs(opts);

  const events = parseEventLogs({
    abi: AUTOMATION_MANAGER_ABI as any,
    eventName: 'JobCreated',
    logs,
  });

  const filtered = events.filter(
    (ev: any) => ev.args.owner.toLowerCase() === owner.toLowerCase()
  );

  console.log(`Found ${filtered.length} JobCreated events for owner ${owner}`);

  const results: any[] = [];

  for (const ev of filtered) {
    const jobId = ev.args.jobId as `0x${string}`;
    try {
      const j = await client.readContract({
        address: am,
        abi: AUTOMATION_MANAGER_ABI as any,
        functionName: 'getJob',
        args: [jobId],
      });

      const statusNum = Number(j.status ?? 0);
      const status =
        ['active', 'executed', 'cancelled', 'expired'][statusNum] ?? 'unknown';
      results.push({ jobId, status, raw: j });
    } catch (err: unknown) {
      results.push({ jobId, error: String(err) });
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

void main().catch((err) => {
  console.error('Fatal error', err);
  process.exit(1);
});

/**
 * admin-set-max-jobs.ts
 *
 * Immediate unblock: raise the per-user job cap on the deployed AutomationManager.
 *
 * Usage:
 *   npx hardhat run scripts/admin-set-max-jobs.ts --network espaceMainnet
 *
 * The script also prints the current on-chain userJobs.length for the deployer
 * so you can see how many historical slots are occupied.
 */

import { ethers, network } from 'hardhat';

const AUTOMATION_MANAGER_ADDRESS =
  process.env.AUTOMATION_MANAGER_ADDRESS ?? '';

// ── New cap to set ────────────────────────────────────────────────────────────
// The old contract counts ALL jobs ever created (append-only array), not just
// active ones, so raise this well above the lifetime total you expect.
// After the contract is redeployed with `activeJobCount`, you can lower it
// back to a sensible per-user active limit (e.g. 20).
const NEW_MAX_JOBS = 500;

const ABI = [
  'function maxJobsPerUser() view returns (uint256)',
  'function setMaxJobsPerUser(uint256 _max) external',
  'function getUserJobs(address user) view returns (bytes32[])',
  'function owner() view returns (address)',
];

async function main() {
  if (!AUTOMATION_MANAGER_ADDRESS) {
    throw new Error('AUTOMATION_MANAGER_ADDRESS not set in .env');
  }

  const [deployer] = await ethers.getSigners();
  console.log(`\nNetwork   : ${network.name}`);
  console.log(`Caller    : ${deployer.address}`);
  console.log(`Contract  : ${AUTOMATION_MANAGER_ADDRESS}\n`);

  const contract = new ethers.Contract(
    AUTOMATION_MANAGER_ADDRESS,
    ABI,
    deployer,
  );

  // Verify caller is owner
  const owner: string = await contract.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(
      `Caller ${deployer.address} is not the contract owner (${owner}).\n` +
      'Set DEPLOYER_PRIVATE_KEY to the owner private key in .env and retry.',
    );
  }

  const currentMax: bigint = await contract.maxJobsPerUser();
  console.log(`Current maxJobsPerUser : ${currentMax}`);

  // Show how many lifetime slots are occupied for the deployer address
  const slots: string[] = await contract.getUserJobs(deployer.address);
  console.log(`Your lifetime job slots : ${slots.length} (append-only array — won't shrink until redeploy)`);

  if (BigInt(NEW_MAX_JOBS) <= currentMax) {
    console.log(`\nNew cap (${NEW_MAX_JOBS}) is not greater than current (${currentMax}) — nothing to do.`);
    return;
  }

  console.log(`\nRaising cap to ${NEW_MAX_JOBS}…`);
  const tx = await contract.setMaxJobsPerUser(NEW_MAX_JOBS);
  console.log(`  tx submitted: ${tx.hash}`);
  await tx.wait();
  console.log(`  confirmed ✓`);

  const newMax: bigint = await contract.maxJobsPerUser();
  console.log(`\nmaxJobsPerUser is now: ${newMax}`);
  console.log('\nYou can create new jobs. Remember to redeploy the contract with');
  console.log('the activeJobCount fix so the cap becomes meaningful again.');
}

main().catch(e => { console.error(e); process.exit(1); });

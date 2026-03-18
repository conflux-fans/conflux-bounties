import { ethers } from 'ethers';
import cron from 'node-cron';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  rpcUrl: process.env.CONFLUX_RPC_URL || 'https://test.confluxrpc.com',
  privateKey: process.env.PRIVATE_KEY_EXECUTOR,
  jobManagerAddress: process.env.JOB_MANAGER_ADDRESS,
  priceOracleAddress: process.env.PRICE_ORACLE_ADDRESS,
  databasePath: process.env.DATABASE_URL || path.join(__dirname, '../../data/automation.db'),
  pollInterval: process.env.POLL_INTERVAL || '*/30 * * * * *', // Every 30 seconds
  maxRetries: 3,
  gasLimit: 500000,
  gasPrice: ethers.parseUnits('1', 'gwei')
};

// Initialize provider and wallet
const provider = new ethers.JsonRpcProvider(config.rpcUrl);
const wallet = config.privateKey ? new ethers.Wallet(config.privateKey, provider) : null;

// Initialize database
const db = new Database(config.databasePath);

// Prepared statements
const statements = {
  getJobsForExecution: db.prepare(`
    SELECT * FROM jobs 
    WHERE status = 0 AND next_execution <= ?
    ORDER BY next_execution ASC
  `),
  updateJob: db.prepare(`
    UPDATE jobs SET
      next_execution = ?,
      executions = ?,
      status = ?,
      updated_at = ?
    WHERE id = ?
  `),
  createExecution: db.prepare(`
    INSERT INTO executions (
      job_id, tx_hash, amount_in, amount_out, price, success, error, executed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
};

// Job Manager Contract ABI
const jobManagerABI = [
  'function executeJob(uint256 jobId, uint256 amountOut, uint256 currentPrice) external',
  'function getJob(uint256 jobId) external view returns (tuple)',
  'function addExecutor(address executor) external',
  'function pause() external',
  'function unpause() external'
];

const jobManager = config.jobManagerAddress ? 
  new ethers.Contract(config.jobManagerAddress, jobManagerABI, wallet) : null;

/**
 * Fetch current price from DEX or price oracle
 */
async function getCurrentPrice(tokenIn, tokenOut) {
  // In production, this would query Swappi/Flux DEX or Chainlink oracle
  // For now, return a mock price
  // TODO: Integrate with actual price feeds
  
  try {
    // Mock price - replace with actual DEX API call
    const mockPrice = ethers.parseEther('1.5');
    console.log(`[Price] Token pair ${tokenIn}/${tokenOut}: ${ethers.formatEther(mockPrice)}`);
    return mockPrice;
  } catch (error) {
    console.error('[Price Error]', error);
    throw error;
  }
}

/**
 * Execute a job
 */
async function executeJob(job) {
  console.log(`[Execute] Processing job ${job.id} for ${job.owner}`);
  
  let retries = 0;
  
  while (retries < config.maxRetries) {
    try {
      // Get current price
      const currentPrice = await getCurrentPrice(job.token_in, job.token_out);
      
      // For limit orders, check if price target is met
      if (job.job_type === 0 || job.job_type === 1) { // LIMIT_BUY or LIMIT_SELL
        const targetPrice = ethers.parseEther(job.target_price);
        const maxSlippage = BigInt(job.max_slippage);
        const maxPrice = targetPrice + (targetPrice * maxSlippage / 10000n);
        
        if (currentPrice > maxPrice) {
          console.log(`[Skip] Job ${job.id}: Price ${ethers.formatEther(currentPrice)} > target ${ethers.formatEther(maxPrice)}`);
          return;
        }
      }
      
      // Calculate expected output (simplified)
      const amountIn = BigInt(job.amount);
      const amountOut = (amountIn * currentPrice) / ethers.parseEther('1');
      
      // Execute on blockchain
      if (jobManager && wallet) {
        console.log(`[Tx] Executing job ${job.id} on blockchain...`);
        
        const tx = await jobManager.executeJob(
          job.blockchain_job_id || job.id,
          amountOut,
          currentPrice,
          {
            gasLimit: config.gasLimit,
            gasPrice: config.gasPrice
          }
        );
        
        console.log(`[Tx] Hash: ${tx.hash}`);
        const receipt = await tx.wait();
        
        console.log(`[Tx] Confirmed in block ${receipt.blockNumber}`);
        
        // Record successful execution
        statements.createExecution.run(
          job.id,
          tx.hash,
          job.amount,
          amountOut.toString(),
          currentPrice.toString(),
          1, // success
          null,
          Date.now()
        );
        
        // Update job state
        const newExecutions = job.executions + 1;
        let newStatus = 0; // ACTIVE
        
        // Check if max executions reached
        if (job.max_executions > 0 && newExecutions >= job.max_executions) {
          newStatus = 3; // COMPLETED
        }
        
        statements.updateJob.run(
          job.job_type === 0 || job.job_type === 1 ? 
            job.next_execution : // Keep same for limit orders (single execution)
            Date.now() + job.interval, // Update for DCA
          newExecutions,
          newStatus,
          Date.now(),
          job.id
        );
        
        console.log(`[Success] Job ${job.id} executed successfully`);
        return;
      } else {
        // Simulation mode (no blockchain)
        console.log(`[Simulate] Job ${job.id} would execute: ${job.amount} tokens`);
        
        statements.createExecution.run(
          job.id,
          null,
          job.amount,
          amountOut.toString(),
          currentPrice.toString(),
          1, // success
          null,
          Date.now()
        );
        
        const newExecutions = job.executions + 1;
        let newStatus = 0;
        
        if (job.max_executions > 0 && newExecutions >= job.max_executions) {
          newStatus = 3; // COMPLETED
        }
        
        statements.updateJob.run(
          Date.now() + job.interval,
          newExecutions,
          newStatus,
          Date.now(),
          job.id
        );
        
        return;
      }
      
    } catch (error) {
      retries++;
      console.error(`[Error] Job ${job.id} attempt ${retries}:`, error.message);
      
      if (retries >= config.maxRetries) {
        // Record failed execution
        statements.createExecution.run(
          job.id,
          null,
          job.amount,
          '0',
          '0',
          0, // failed
          error.message,
          Date.now()
        );
        
        console.error(`[Failed] Job ${job.id} failed after ${retries} attempts`);
      } else {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}

/**
 * Poll for jobs to execute
 */
async function pollJobs() {
  console.log('[Poll] Checking for jobs to execute...');
  
  try {
    const now = Date.now();
    const jobs = statements.getJobsForExecution.all(now);
    
    console.log(`[Poll] Found ${jobs.length} jobs ready for execution`);
    
    for (const job of jobs) {
      await executeJob(job);
    }
  } catch (error) {
    console.error('[Poll Error]', error);
  }
}

/**
 * Start the worker
 */
function start() {
  console.log('🤖 Conflux Automation Worker starting...');
  
  if (!wallet) {
    console.warn('⚠️  No private key provided - running in simulation mode');
  }
  
  if (!config.jobManagerAddress) {
    console.warn('⚠️  No JobManager address - running in simulation mode');
  }
  
  // Schedule polling
  cron.schedule(config.pollInterval, pollJobs);
  
  console.log(`✅ Worker scheduled: ${config.pollInterval}`);
  
  // Run initial poll
  pollJobs();
}

// CLI commands
const args = process.argv.slice(2);

if (args[0] === 'run') {
  start();
} else if (args[0] === 'poll') {
  pollJobs().then(() => process.exit(0));
} else {
  console.log(`
Conflux Automation Worker

Commands:
  run   - Start the worker (continuous)
  poll  - Execute one polling cycle

Environment variables:
  CONFLUX_RPC_URL        - RPC endpoint
  PRIVATE_KEY_EXECUTOR   - Executor private key
  JOB_MANAGER_ADDRESS    - JobManager contract address
  DATABASE_URL           - Database path
  POLL_INTERVAL          - Cron schedule (default: */30 * * * * *)
`);
  process.exit(0);
}

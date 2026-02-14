import { viemClient } from './client.js';
import type { Block, Transaction, TokenTransfer } from '@conflux-analytics/shared';
import { ERC20_TRANSFER_TOPIC, ZERO_ADDRESS } from '@conflux-analytics/shared';

/**
 * Fetch a single block with its transactions and receipts from the RPC.
 * Returns the parsed block, transactions, and any ERC-20 transfer events.
 */
export async function fetchBlock(blockNumber: bigint): Promise<{
  block: Block;
  transactions: Transaction[];
  transfers: TokenTransfer[];
}> {
  const rawBlock = await viemClient.getBlock({
    blockNumber,
    includeTransactions: true,
  });

  const block: Block = {
    number: Number(rawBlock.number),
    hash: rawBlock.hash,
    parentHash: rawBlock.parentHash,
    timestamp: Number(rawBlock.timestamp),
    gasUsed: rawBlock.gasUsed.toString(),
    gasLimit: rawBlock.gasLimit.toString(),
    baseFeePerGas: rawBlock.baseFeePerGas?.toString() ?? null,
    txCount: rawBlock.transactions.length,
    miner: rawBlock.miner.toLowerCase(),
  };

  const transactions: Transaction[] = [];
  const transfers: TokenTransfer[] = [];

  /** Process each transaction and its receipt in parallel */
  const receiptPromises = rawBlock.transactions.map((tx) =>
    viemClient.getTransactionReceipt({ hash: tx.hash }),
  );
  const receipts = await Promise.all(receiptPromises);

  for (let i = 0; i < rawBlock.transactions.length; i++) {
    const tx = rawBlock.transactions[i];
    const receipt = receipts[i];

    transactions.push({
      hash: tx.hash,
      blockNumber: Number(rawBlock.number),
      from: tx.from.toLowerCase(),
      to: tx.to?.toLowerCase() ?? null,
      value: tx.value.toString(),
      gasUsed: receipt.gasUsed.toString(),
      gasPrice: (receipt.effectiveGasPrice ?? tx.gasPrice ?? 0n).toString(),
      maxFeePerGas: tx.maxFeePerGas?.toString() ?? null,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString() ?? null,
      status: receipt.status === 'success' ? 'success' : 'failure',
      timestamp: Number(rawBlock.timestamp),
      input: tx.input,
    });

    /** Decode ERC-20 Transfer events from receipt logs */
    for (const log of receipt.logs) {
      if (
        log.topics[0] === ERC20_TRANSFER_TOPIC &&
        log.topics.length === 3 &&
        log.data !== '0x'
      ) {
        const from = '0x' + (log.topics[1]?.slice(26) ?? ZERO_ADDRESS.slice(2));
        const to = '0x' + (log.topics[2]?.slice(26) ?? ZERO_ADDRESS.slice(2));

        transfers.push({
          txHash: tx.hash,
          logIndex: log.logIndex ?? 0,
          tokenAddress: log.address.toLowerCase(),
          from: from.toLowerCase(),
          to: to.toLowerCase(),
          value: BigInt(log.data).toString(),
          blockNumber: Number(rawBlock.number),
          timestamp: Number(rawBlock.timestamp),
        });
      }
    }
  }

  return { block, transactions, transfers };
}

/**
 * Get the latest block number from the chain.
 */
export async function getLatestBlockNumber(): Promise<number> {
  const n = await viemClient.getBlockNumber();
  return Number(n);
}

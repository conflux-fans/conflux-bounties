import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { IEventListener } from './interfaces';
import { BlockchainConnection } from './BlockchainConnection';
import { EventSubscription, BlockchainEvent } from '../types';
import { NetworkConfig } from '../types/config';

import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const eventSignatures = [
  'Transfer(address indexed from, address indexed to, uint256 value)',
  'Deposit(address indexed dst, uint256 wad)',
  'Withdrawal(address indexed src, uint256 wad)',
  'Approval(address indexed owner, address indexed spender, uint256 value)'
];

export class EventListener extends EventEmitter implements IEventListener {
  private connection: BlockchainConnection;
  private subscriptions = new Map<string, EventSubscription>();
  // 支持存储合约对象或自定义监听对象
  private contractListeners = new Map<string, any>();
  private isRunning = false;

  // Simplified monitoring capabilities - focused on direct webhook delivery
  private startTime = Date.now();
  private eventCount = 0;
  private webhooksSent = 0;
  private webhooksFailed = 0;
  private eventsByContract = new Map<string, number>();
  private eventsByType = new Map<string, number>();
  private lastEventTime: Date | null = null;

  // Configuration from config.json and .env
  private configPath: string;

  constructor(networkConfig: NetworkConfig, configPath?: string) {
    super();
    this.connection = new BlockchainConnection(networkConfig);
    this.configPath = configPath || process.env['CONFIG_PATH'] || 'config.json';
    this.setupConnectionEventHandlers();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      await this.connection.connect();

      // Enable block monitoring for enhanced capabilities
      this.connection.enableBlockMonitoring();

      this.isRunning = true;
      this.startTime = Date.now();

      // Start monitoring all subscriptions (including those from config.json)
      await this.startAllSubscriptions();

      // Load and start monitoring wallet addresses from config.json
      await this.startWalletMonitoring();

      this.emit('started');
      console.log('📤 Events will be sent directly to webhook URLs');
      console.log('⏰ Waiting for events...\n');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('\n🛑 Stopping EventListener...');
    this.isRunning = false;

    // Stop all contract listeners
    await this.stopAllSubscriptions();

    // Disable block monitoring
    this.connection.disableBlockMonitoring();

    // Disconnect from blockchain
    await this.connection.disconnect();

    this.emit('stopped');
    console.log('✅ EventListener stopped');
  }

  addSubscription(subscription: EventSubscription): void {
    this.subscriptions.set(subscription.id, subscription);

    // Handle both single and multiple contract addresses
    const contractAddresses = Array.isArray(subscription.contractAddress)
      ? subscription.contractAddress
      : [subscription.contractAddress];

    // Add contracts to blockchain connection monitoring
    contractAddresses.forEach(address => {
      this.connection.addContractToMonitor(address);
    });

    if (this.isRunning && this.connection.isConnected()) {
      this.startSubscription(subscription);
    }

    console.log(`📋 Added subscription: ${subscription.id}`);
    console.log(`   📍 Contracts: ${contractAddresses.join(', ')}`);

    // Handle both single and multiple event signatures
    if (eventSignatures.length === 1 && eventSignatures[0]) {
      console.log(`   🎯 Event: ${this.parseEventName(eventSignatures[0])}`);
    } else {
      console.log(`   🎯 Events: ${eventSignatures.length} signatures`);
    }
    console.log(`   📤 Webhooks: ${subscription.webhooks.length} configured`);
  }

  removeSubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn(`⚠️ Subscription ${subscriptionId} not found`);
      return;
    }

    this.stopSubscription(subscriptionId);
    this.subscriptions.delete(subscriptionId);

    // Handle both single and multiple contract addresses
    const contractAddresses = Array.isArray(subscription.contractAddress)
      ? subscription.contractAddress
      : [subscription.contractAddress];

    // Remove contracts from monitoring if no other subscriptions use them
    contractAddresses.forEach(contractAddress => {
      const hasOtherSubscriptions = Array.from(this.subscriptions.values())
        .some(sub => {
          const subAddresses = Array.isArray(sub.contractAddress)
            ? sub.contractAddress
            : [sub.contractAddress];
          return subAddresses.some(addr => addr.toLowerCase() === contractAddress.toLowerCase());
        });

      if (!hasOtherSubscriptions) {
        this.connection.removeContractFromMonitor(contractAddress);
      }
    });

    console.log(`📴 Removed subscription: ${subscriptionId}`);
  }

  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  isListening(): boolean {
    return this.isRunning && this.connection.isConnected();
  }

  // Simplified monitoring methods focused on direct webhook delivery
  getEventStatistics(): {
    uptime: number;
    totalEvents: number;
    webhooksSent: number;
    webhooksFailed: number;
    successRate: number;
    eventsByContract: Record<string, number>;
    eventsByType: Record<string, number>;
    lastEventTime: Date | null;
    subscriptionCount: number;
  } {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const totalWebhooks = this.webhooksSent + this.webhooksFailed;
    const successRate = totalWebhooks > 0 ? Math.round((this.webhooksSent / totalWebhooks) * 100) : 0;

    return {
      uptime,
      totalEvents: this.eventCount,
      webhooksSent: this.webhooksSent,
      webhooksFailed: this.webhooksFailed,
      successRate,
      eventsByContract: Object.fromEntries(this.eventsByContract),
      eventsByType: Object.fromEntries(this.eventsByType),
      lastEventTime: this.lastEventTime,
      subscriptionCount: this.subscriptions.size
    };
  }

  displayEventStatus(): void {
    const stats = this.getEventStatistics();
    const minutes = Math.floor(stats.uptime / 60);
    const seconds = stats.uptime % 60;

    console.log(`\n📊 Event Listener Status:`);
    console.log(`   ⏰ Uptime: ${minutes}m ${seconds}s`);
    console.log(`   🎯 Events detected: ${stats.totalEvents}`);
    console.log(`   📤 Webhooks sent: ${stats.webhooksSent}`);
    console.log(`   ❌ Webhooks failed: ${stats.webhooksFailed}`);
    console.log(`   📊 Success rate: ${stats.successRate}%`);
    console.log(`   📋 Active subscriptions: ${stats.subscriptionCount}`);

    // Get connection status
    const connectionStatus = this.connection.getConnectionStatus();
    console.log(`   📡 Connection: ${connectionStatus.status === 'connected' ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`   📦 Blocks processed: ${connectionStatus.blockCount}`);
    console.log(`   📤 Transactions seen: ${connectionStatus.transactionCount}`);
    console.log(`   📋 Monitored contracts: ${connectionStatus.monitoredContracts}`);

    if (stats.lastEventTime) {
      const timeSinceLastEvent = Math.floor((Date.now() - stats.lastEventTime.getTime()) / 1000);
      console.log(`   🕐 Last event: ${timeSinceLastEvent}s ago`);
    } else {
      console.log(`   🕐 Last event: No events detected yet`);
    }

    if (Object.keys(stats.eventsByType).length > 0) {
      console.log(`   📊 Events by type:`);
      for (const [eventType, count] of Object.entries(stats.eventsByType)) {
        console.log(`      ${eventType}: ${count}`);
      }
    } else {
      console.log(`   📊 Events by type: No events yet`);
    }

    if (Object.keys(stats.eventsByContract).length > 0) {
      console.log(`   📋 Events by contract:`);
      for (const [contract, count] of Object.entries(stats.eventsByContract)) {
        console.log(`      ${contract}: ${count}`);
      }
    } else {
      console.log(`   📋 Events by contract: No events yet`);
    }

    console.log('');
  }

  private setupConnectionEventHandlers(): void {
    this.connection.on('connected', async () => {
      console.log('✅ Blockchain connection established');
      if (this.isRunning) {
        await this.startAllSubscriptions();
      }
    });

    this.connection.on('disconnected', () => {
      console.log('⚠️ Blockchain connection lost');
      this.stopAllSubscriptions();
    });

    this.connection.on('error', (error: Error) => {
      console.error('❌ Blockchain connection error:', error);
      this.emit('error', error);
    });

    this.connection.on('maxReconnectAttemptsReached', () => {
      console.error('❌ Max reconnection attempts reached');
      this.emit('connectionFailed');
    });

    // Listen for new blocks - basic information only
    this.connection.on('newBlock', (_blockData: any) => {
      // Block information is already logged by BlockchainConnection
      // EventListener focuses on contract events and webhook delivery
    });
  }

  private async startAllSubscriptions(): Promise<void> {
    // First, load subscriptions from config.json if they exist
    await this.loadConfigSubscriptions();

    // Then start all subscriptions (both programmatic and config-based)
    const promises = Array.from(this.subscriptions.values()).map(subscription =>
      this.startSubscription(subscription)
    );

    await Promise.allSettled(promises);
  }

  private async stopAllSubscriptions(): Promise<void> {
    const subscriptionIds = Array.from(this.subscriptions.keys());

    for (const subscriptionId of subscriptionIds) {
      this.stopSubscription(subscriptionId);
    }
  }

  /**
   * Load subscriptions from config.json and add them to the subscriptions map
   */
  private async loadConfigSubscriptions(): Promise<void> {
    try {
      console.log(`📋 Loading configuration from: ${this.configPath}`);
      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(configData);
      
      if (!config.subscriptions || !Array.isArray(config.subscriptions)) {
        console.warn('⚠️ No subscriptions found in config.json');
        return;
      }

      console.log(`📋 Found ${config.subscriptions.length} subscription(s) in config`);
      
      for (const subscription of config.subscriptions) {
        if (!subscription.contractAddress || !subscription.webhooks) {
          console.warn(`⚠️ Invalid subscription configuration:`, subscription);
          continue;
        }

        // Convert config subscription to EventSubscription format
        const eventSubscription: EventSubscription = {
          id: subscription.id,
          contractAddress: subscription.contractAddress,
          eventSignature: subscription.eventSignature || eventSignatures, // Use global eventSignatures as fallback
          filters: subscription.filters || {},
          webhooks: subscription.webhooks
        };

        // Add to subscriptions map (avoid duplicates)
        if (!this.subscriptions.has(eventSubscription.id)) {
          this.subscriptions.set(eventSubscription.id, eventSubscription);
          
          const contractAddresses = Array.isArray(eventSubscription.contractAddress)
            ? eventSubscription.contractAddress
            : [eventSubscription.contractAddress];
          
          console.log(`📋 Loaded subscription from config: ${eventSubscription.id}`);
          console.log(`   📍 Contracts: ${contractAddresses.join(', ')}`);
          console.log(`   📤 Webhooks: ${eventSubscription.webhooks.length} configured`);
        } else {
          console.log(`⚠️ Subscription ${eventSubscription.id} already exists, skipping config version`);
        }
      }
    } catch (error) {
      console.error('❌ Error loading configuration:', error);
      // Don't throw error here to allow the system to continue with programmatic subscriptions
    }
  }

  private async startSubscription(subscription: EventSubscription): Promise<void> {
    console.log(`🛑 startSubscription`)
    try {
      const provider = this.connection.getProvider();
      if (!provider) {
        throw new Error('Provider not available');
      }
      // 支持多个合约和多个事件签名
      const contractAddresses = Array.isArray(subscription.contractAddress)
        ? subscription.contractAddress
        : [subscription.contractAddress];

      // Use subscription's event signatures, fallback to global eventSignatures
      const subscriptionEventSignatures = Array.isArray(subscription.eventSignature)
        ? subscription.eventSignature
        : [subscription.eventSignature];

      if (!contractAddresses.length || !subscriptionEventSignatures.length) {
        throw new Error('Contract address and event signature are required');
      }

      for (const contractAddress of contractAddresses) {
        if (!contractAddress) continue;
        // 直接用 event ABI 字符串（带 event 关键字）
        const abi = subscriptionEventSignatures.filter(Boolean).map(sig => `event ${sig}`);
        if (!abi.length) continue;
        const contract = new ethers.Contract(contractAddress, abi, provider);
        // 打印所有 ABI 事件名，辅助调试
        const eventFragments = contract.interface.fragments.filter((f: any) => f.type === 'event');
        console.log('ABI events:', eventFragments.map((f: any) => f.name));
        // 记录所有监听器，便于 stop 时移除
        const listeners: Array<{ eventName: string, handler: (...args: any[]) => void }> = [];
        for (const sig of subscriptionEventSignatures) {
          if (!sig) continue;
          const eventName = this.parseEventName(sig);
          console.log(`eventName: ${eventName}`)
          // 监听事件
          const handler = async (...args: any[]) => {
            const event = args[args.length - 1];

            await this.handleContractEvent(subscription, event, args.slice(0, -1));
          };
          contract.on(eventName, handler);
          listeners.push({ eventName, handler });
          console.log(`✅ Listening for ${eventName} events on contract ${contractAddress}`);
        }
        // 存储合约和监听器信息，便于 stop
        const key = `${subscription.id}::${contractAddress}`;
        this.contractListeners.set(key, { contract: contract as any, listeners: listeners as any });
      }
    } catch (error) {
      console.error(`Failed to start subscription ${subscription.id}:`, error);
      this.emit('subscriptionError', subscription.id, error);
    }
  }

  private stopSubscription(subscriptionId: string): void {
    // 支持多合约监听的清理
    const keys = Array.from(this.contractListeners.keys()).filter(k => k.startsWith(subscriptionId + '::'));
    for (const key of keys) {
      const entry: any = this.contractListeners.get(key);
      if (entry && entry.contract && Array.isArray(entry.listeners)) {
        try {
          for (const l of entry.listeners) {
            entry.contract.off(l.eventName, l.handler);
          }
          this.contractListeners.delete(key);
          console.log(`📴 Stopped monitoring for ${key}`);
        } catch (error) {
          console.error(`Error stopping subscription ${key}:`, error);
        }
      }
    }
  }

  private async handleContractEvent(
    subscription: EventSubscription,
    event: any,
    args: any[]
  ): Promise<void> {

    try {
      this.eventCount++;
      this.lastEventTime = new Date();

      // Handle different event object structures from ethers.js v6
      const eventLog = event.log || event;

      const eventName = event.fragment?.name;

      // Handle multiple event signatures - filter eventName for backward compatibility
      const eventSignaturesArr = Array.isArray(subscription.eventSignature)
        ? subscription.eventSignature
        : [subscription.eventSignature];

      const eventSignature = eventSignaturesArr.filter(sig => {
        // If sig is an object with a name property, compare by name; otherwise, compare by parsing the event name from string
        if (typeof sig === 'string') {
          return this.parseEventName(sig) === eventName;
        } else if (typeof sig === 'object' && sig !== null && 'name' in sig && typeof (sig as any).name === 'string') {
          return (sig as { name: string }).name === eventName;
        }
        return false;
      });

      if (!eventSignature) {
        console.error('❌ Event signature is required');
        return;
      }

      // Update statistics
      const contractAddress = eventLog.address ? eventLog.address.toLowerCase() :
        (Array.isArray(subscription.contractAddress)
          ? (subscription.contractAddress[0] || '').toLowerCase()
          : (subscription.contractAddress || '').toLowerCase());
      this.eventsByContract.set(contractAddress, (this.eventsByContract.get(contractAddress) || 0) + 1);
      this.eventsByType.set(eventName, (this.eventsByType.get(eventName) || 0) + 1);

      console.log(`\n🚨 Contract EVENT #${this.eventCount} DETECTED!`);
      console.log(`📋 Contract: ${contractAddress}`);
      console.log(`🎯 Event: ${eventName}`);
      console.log(`📍 Address: ${eventLog.address || contractAddress}`);
      console.log(`📦 Block: ${eventLog.blockNumber || 'pending'}`);
      console.log(`📤 Transaction: ${eventLog.transactionHash || 'pending'}`);
      console.log(`🔢 Log Index: ${eventLog.index !== undefined ? eventLog.index : 'N/A'}`);
      console.log(`⏰ Time: ${this.lastEventTime.toISOString()}`);

      // Parse and display event arguments
      const parsedArgs = this.parseEventArgsEnhanced(eventSignature[0] ?? '', args);
      if (Object.keys(parsedArgs).length > 0) {
        console.log(`📊 Event Data:`);
        for (const [key, value] of Object.entries(parsedArgs)) {
          if (typeof value === 'string' && this.isBigIntString(value)) {
            const formattedValue = this.formatTokenAmount(value);
            console.log(`   ${key}: ${value}${formattedValue ? ` (${formattedValue})` : ''}`);
          } else {
            console.log(`   ${key}: ${value}`);
          }
        }
      }

      // Create webhook payload (same format as realtime-event-listener.js)
      const webhookPayload = {
        type: subscription.id,
        contractAddress,
        eventSignature: eventSignature[0] || '',
        blockNumber: eventLog.blockNumber,
        transactionHash: eventLog.transactionHash,
        logIndex: eventLog.index,
        args: parsedArgs,
        timestamp: this.lastEventTime.toISOString(),
      };

      // Display webhook payload
      console.log(`\n📤 Webhook Payload:`);
      console.log(JSON.stringify(webhookPayload, null, 2));

      // Send to all configured webhooks directly
      await this.sendToWebhooks(subscription, webhookPayload);

      // Still emit the event for compatibility with existing system
      const blockchainEvent: BlockchainEvent = {
        contractAddress,
        eventName,
        blockNumber: eventLog.blockNumber,
        transactionHash: eventLog.transactionHash,
        logIndex: eventLog.index,
        args: parsedArgs,
        timestamp: this.lastEventTime
      };

      this.emit('event', subscription, blockchainEvent);

      console.log(`\n${'='.repeat(80)}\n`);
    } catch (error) {
      console.error('❌ Error handling contract event:', error);
      this.emit('eventError', subscription.id, error);
    }
  }

  private parseEventName(eventSignature: string): string {
    // Extract event name from signature like "Transfer(address,address,uint256)"
    const match = eventSignature.match(/^(\w+)\(/);
    return match && match[1] ? match[1] : 'UnknownEvent';
  }





  // Enhanced argument parsing with better BigInt handling and parameter name extraction
  private parseEventArgsEnhanced(eventSignature: string, args: any[]): Record<string, any> {
    const result: Record<string, any> = {};

    // Add indexed arguments (convert BigInt to string)
    args.forEach((value, index) => {
      result[`arg${index}`] = typeof value === 'bigint' ? value.toString() : value;
    });

    // Try to parse parameter names from signature
    const match = eventSignature.match(/\(([^)]*)\)/);
    if (match && match[1]) {
      const params = match[1].split(',').map(p => p.trim());

      params.forEach((param, index) => {
        if (index < args.length) {
          // Extract parameter name
          const parts = param.split(/\s+/);
          let paramName = `param${index}`;

          if (parts.length > 1) {
            if (parts[1] === 'indexed' && parts.length > 2 && parts[2]) {
              paramName = parts[2];
            } else if (parts[1] && parts[1] !== 'indexed') {
              paramName = parts[1];
            }
          }

          // Convert BigInt to string for JSON serialization
          const value = args[index];
          result[paramName] = typeof value === 'bigint' ? value.toString() : value;
        }
      });
    }

    return result;
  }

  private isBigIntString(value: string): boolean {
    // Check if string represents a large number (likely from BigInt)
    return /^\d{10,}$/.test(value);
  }

  private formatTokenAmount(value: string): string {
    try {
      const bigIntValue = BigInt(value);
      if (bigIntValue > 0n) {
        const formatted = ethers.formatEther(bigIntValue);
        return `${formatted} tokens`;
      }
      return '';
    } catch {
      return '';
    }
  }

  // Direct webhook sending method inspired by realtime-event-listener.js
  private async sendToWebhooks(subscription: EventSubscription, payload: any): Promise<void> {
    const webhookPromises = subscription.webhooks.map(webhook =>
      this.sendWebhook(webhook.url, payload, webhook.id)
    );

    try {
      await Promise.allSettled(webhookPromises);
    } catch (error) {
      console.error(`Error sending webhooks for subscription ${subscription.id}:`, error);
    }
  }

  private async sendWebhook(url: string, payload: any, _webhookId: string): Promise<void> {
    try {
      console.log(`\n📤 Sending webhook to: ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Conflux-Webhook-Listener/1.0'
        },
        body: JSON.stringify(payload)
      });

      this.webhooksSent++;
      console.log(`   ✅ Webhook #${this.webhooksSent} sent successfully!`);
      console.log(`   📊 Status: ${response.status} ${response.statusText}`);

    } catch (error) {
      this.webhooksFailed++;
      console.error(`❌ Webhook delivery error:`, (error as Error).message);
    }
  }













  /**
   * Load wallet monitoring configuration from config.json and start monitoring wallet transfers
   */
  private async startWalletMonitoring(): Promise<void> {
    try {
      console.log(`📋 Loading wallet monitoring configuration from: ${this.configPath}`);

      // Read and parse config.json
      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(configData);

      if (!config.walletMonitoring || !Array.isArray(config.walletMonitoring)) {
        console.log('ℹ️ No wallet monitoring configuration found in config.json');
        return;
      }

      console.log(`📋 Found ${config.walletMonitoring.length} wallet monitoring configuration(s)`);

      // Process each wallet monitoring configuration
      for (const walletConfig of config.walletMonitoring) {
        if (!walletConfig.walletAddresses || !Array.isArray(walletConfig.walletAddresses) || !walletConfig.webhooks) {
          console.warn(`⚠️ Invalid wallet monitoring configuration:`, walletConfig);
          continue;
        }

        console.log(`🎯 Setting up wallet monitoring for ${walletConfig.walletAddresses.length} addresses`);
        console.log(`📤 Webhooks configured: ${walletConfig.webhooks.length}`);

        // Start monitoring transfers for these wallet addresses
        await this.startWalletTransferMonitoring(walletConfig);
      }

    } catch (error) {
      console.error('❌ Error loading wallet monitoring configuration:', error);
      // Don't throw error here, just log it so contract monitoring can continue
    }
  }

  /**
   * Monitor transfer transactions for specific wallet addresses
   */
  private async startWalletTransferMonitoring(walletConfig: any): Promise<void> {
    try {
      const provider = this.connection.getProvider();
      if (!provider) {
        throw new Error('Provider not available');
      }

      const walletAddresses = walletConfig.walletAddresses.map((addr: string) => addr.toLowerCase());

      console.log(`🎯 Starting wallet transfer monitoring for ${walletAddresses.length} addresses:`);
      walletAddresses.forEach((addr: string) => {
        console.log(`   📍 ${addr}`);
      });

      provider.on('block', async (blockNumber: number) => {
        try {

          const block = await provider.getBlock(blockNumber, false); // 不解码交易，返回哈希数组

          if (!block || !block.transactions) return;
          for (const txRaw of block.transactions) {
            let tx: any = txRaw;
            if (typeof txRaw === 'string') {
              try {
                tx = await provider.getTransaction(txRaw);
                if (!tx) {
                  console.log(`\n🔍 Failed to fetch tx for hash: ${txRaw}`);
                  continue;
                }
              } catch (err) {
                console.log(`\n🔍 Error fetching tx for hash: ${txRaw}`, err);
                continue;
              }
            }
            const fromAddress: string = tx.from?.toLowerCase();
            const toAddress: string = tx.to?.toLowerCase();

            const isFromMonitored = walletAddresses.includes(fromAddress);
            const isToMonitored = walletAddresses.includes(toAddress);
            let value = tx.value;
            if (typeof value === 'string') {
              try { value = BigInt(value); } catch { value = 0n; }
            }
            if ((isFromMonitored || isToMonitored) && value && value > 0n) {
              await this.handleWalletTransfer(walletConfig, { ...tx, value }, isFromMonitored, isToMonitored, blockNumber);
            }
          }
        } catch (error) {
          console.error(`Error processing block ${blockNumber} for wallet monitoring:`, error);
        }
      });

      // Store wallet monitoring info for cleanup
      const monitoringId = `wallet-monitoring-${walletConfig.id || 'default'}`;
      this.contractListeners.set(monitoringId, {
        removeAllListeners: () => {
          // block监听的清理由 provider.disconnect 统一处理
        },
        walletAddresses,
        config: walletConfig
      } as any);

      console.log(`✅ Started wallet transfer monitoring for ${walletAddresses.length} addresses`);
    } catch (error) {
      console.error(`❌ Failed to start wallet transfer monitoring:`, error);
      throw error;
    }
  }

  /**
   * Handle wallet transfer transactions
   */
  private async handleWalletTransfer(
    walletConfig: any,
    transaction: any,
    isFromMonitored: boolean,
    isToMonitored: boolean,
    confirmedBlockNumber?: number
  ): Promise<void> {

    try {
      this.eventCount++;
      this.lastEventTime = new Date();

      const fromAddress = transaction.from?.toLowerCase() || '';
      const toAddress = transaction.to?.toLowerCase() || '';
      const value = transaction.value || 0n;
      const txHash = transaction.hash;

      // Update statistics
      const eventType = 'WalletTransfer';
      this.eventsByType.set(eventType, (this.eventsByType.get(eventType) || 0) + 1);

      // Determine transfer direction
      let transferDirection = '';
      let monitoredAddress = '';

      if (isFromMonitored && isToMonitored) {
        transferDirection = 'internal'; // Between monitored addresses
        monitoredAddress = fromAddress;
      } else if (isFromMonitored) {
        transferDirection = 'outgoing';
        monitoredAddress = fromAddress;
      } else if (isToMonitored) {
        transferDirection = 'incoming';
        monitoredAddress = toAddress;
      }

      console.log(`\n🚨 WALLET TRANSFER #${this.eventCount} DETECTED!`);
      console.log(`👤 Wallet Address: ${monitoredAddress}`);
      console.log(`📍 From: ${fromAddress}`);
      console.log(`📍 To: ${toAddress || 'Contract Creation'}`);
      console.log(`💰 Value: ${this.formatEther(value)} CFX`);
      console.log(`🔄 Direction: ${transferDirection}`);
      console.log(`📤 Transaction: ${txHash}`);
      console.log(`📦 Block: ${confirmedBlockNumber}`);
      console.log(`⏰ Time: ${this.lastEventTime.toISOString()}`);

      // Create webhook payload for wallet transfer
      const webhookPayload = {
        type: walletConfig.id,
        walletAddress: monitoredAddress,
        fromAddress,
        toAddress: toAddress || null,
        value: value.toString(),
        valueInCFX: this.formatEther(value),
        transferDirection,
        transactionHash: txHash,
        blockNumber: confirmedBlockNumber,
        gasLimit: transaction.gasLimit?.toString() || null,
        gasPrice: transaction.gasPrice?.toString() || null,
        nonce: transaction.nonce || null,
        timestamp: this.lastEventTime.toISOString(),
      };

      // Display webhook payload
      console.log(`\n📤 Wallet Transfer Webhook Payload:`);
      console.log(JSON.stringify(webhookPayload, null, 2));

      // Send to all configured webhooks directly
      if (walletConfig.webhooks && Array.isArray(walletConfig.webhooks)) {
        const webhookPromises = walletConfig.webhooks.map((webhook: any) =>
          this.sendWebhook(webhook.url, webhookPayload, webhook.id)
        );
        await Promise.allSettled(webhookPromises);
      }

      console.log(`\n${'='.repeat(80)}\n`);

    } catch (error) {
      console.error('❌ Error handling wallet transfer:', error);
    }
  }

  /**
   * Format ether value for display
   */
  private formatEther(value: bigint): string {
    try {
      return ethers.formatEther(value);
    } catch {
      return value.toString();
    }
  }
}

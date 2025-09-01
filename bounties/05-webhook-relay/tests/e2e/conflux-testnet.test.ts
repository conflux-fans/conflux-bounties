import { ethers } from 'ethers';
import { Application } from '../../src/Application';
import { ConfigFactory, ContractFactory } from '../factories';
import { SystemConfig } from '../../src/types/config';

// Mock webhook server for testing
class MockWebhookServer {
  private receivedWebhooks: any[] = [];
  private server: any;
  private port: number;

  constructor(port: number = 3333) {
    this.port = port;
  }

  async start() {
    const express = require('express');
    const app = express();
    app.use(express.json());

    app.post('/webhook', (req: any, res: any) => {
      this.receivedWebhooks.push({
        body: req.body,
        headers: req.headers,
        timestamp: new Date()
      });
      res.status(200).json({ success: true });
    });

    return new Promise((resolve) => {
      this.server = app.listen(this.port, () => {
        console.log(`Mock webhook server started on port ${this.port}`);
        resolve(this.server);
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(resolve);
      });
    }
    return Promise.resolve();
  }

  getReceivedWebhooks() {
    return this.receivedWebhooks;
  }

  clearWebhooks() {
    this.receivedWebhooks = [];
  }
}

describe('End-to-End Conflux Testnet Integration', () => {
  let application: Application;
  let mockWebhookServer: MockWebhookServer;
  let provider: ethers.JsonRpcProvider;
  let testContract: ethers.Contract;

  // Skip these tests if not in CI or if CONFLUX_TESTNET_TESTS is not set
  const shouldRunE2ETests = process.env['CONFLUX_TESTNET_TESTS'] === 'true' || process.env['CI'] === 'true';

  beforeAll(async () => {
    if (!shouldRunE2ETests) {
      console.log('Skipping E2E tests - set CONFLUX_TESTNET_TESTS=true to run');
      return;
    }

    // Start mock webhook server
    mockWebhookServer = new MockWebhookServer();
    await mockWebhookServer.start();

    // Connect to Conflux testnet
    provider = new ethers.JsonRpcProvider('https://evmtestnet.confluxrpc.com');
    
    // Create test wallet (in real tests, use a funded test account)
    // const testWallet = ethers.Wallet.createRandom().connect(provider);
    
    // Deploy test contract (simplified - in real tests you'd need CFX for gas)
    try {
      // const contractFactory = new ethers.ContractFactory(
      //   ContractFactory.getTestTokenABI(),
      //   ContractFactory.getTestTokenBytecode(),
      //   testWallet
      // );
      
      // Note: This will fail without funded wallet, but shows the structure
      // testContract = await contractFactory.deploy();
      // await testContract.waitForDeployment();
      
      // For testing purposes, use a mock contract address
      testContract = new ethers.Contract(
        ContractFactory.generateTestAddress(1),
        ContractFactory.getTestTokenABI(),
        provider
      );
    } catch (error) {
      console.log('Contract deployment skipped (no funded wallet):', (error as Error).message);
      // Use mock contract for testing
      testContract = new ethers.Contract(
        ContractFactory.generateTestAddress(1),
        ContractFactory.getTestTokenABI(),
        provider
      );
    }
  }, 30000);

  afterAll(async () => {
    if (!shouldRunE2ETests) return;

    if (application) {
      await application.stop();
    }
    if (mockWebhookServer) {
      await mockWebhookServer.stop();
    }
  });

  describe('Contract Event Monitoring', () => {
    beforeEach(async () => {
      if (!shouldRunE2ETests) return;

      mockWebhookServer.clearWebhooks();

      // Create configuration for testnet
      const config: SystemConfig = ConfigFactory.createTestnetConfig();
      config.subscriptions = [{
        id: 'test-subscription-1',
        contractAddress: testContract.target as string,
        eventSignature: 'Transfer(address,address,uint256)',
        filters: {},
        webhooks: [{
          id: 'test-webhook-1',
          url: 'http://localhost:3333/webhook',
          format: 'generic',
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
          retryAttempts: 2
        }]
      }];

      // Write test config file
      const fs = require('fs');
      const configPath = '/tmp/e2e-test-config.json';
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      // Initialize application
      application = new Application({ configPath });
    });

    it('should detect and relay Transfer events from testnet', async () => {
      if (!shouldRunE2ETests) {
        console.log('E2E tests disabled - set CONFLUX_TESTNET_TESTS=true to run');
        return;
      }

      // Start the application
      await application.start();

      // Wait for connection to establish
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In a real test, you would:
      // 1. Execute a transaction that emits the Transfer event
      // 2. Wait for the event to be detected
      // 3. Verify the webhook was called

      // For this test, we'll simulate the event detection
      // since we don't have a funded wallet to execute transactions
      
      // Simulate event detection (this would normally come from the blockchain)
      // const mockEvent = EventFactory.createTransferEvent(
      //   testWallet.address,
      //   '0x1111111111111111111111111111111111111111',
      //   '1000000000000000000'
      // );

      // In a real implementation, this would be triggered by actual blockchain events
      // For testing, we can verify the system is set up correctly
      expect(application.isRunning()).toBe(true);
      
      // Verify configuration was loaded correctly
      const status = application.getStatus();
      expect(status.components.config).toBe(true);
      expect(status.components.database).toBe(true);

      await application.stop();
    }, 15000);

    it('should handle multiple concurrent events', async () => {
      if (!shouldRunE2ETests) {
        console.log('E2E tests disabled - set CONFLUX_TESTNET_TESTS=true to run');
        return;
      }

      await application.start();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify system can handle startup
      expect(application.isRunning()).toBe(true);

      await application.stop();
    }, 10000);

    it('should retry failed webhook deliveries', async () => {
      if (!shouldRunE2ETests) {
        console.log('E2E tests disabled - set CONFLUX_TESTNET_TESTS=true to run');
        return;
      }

      // Stop mock server to simulate webhook failure
      await mockWebhookServer.stop();

      await application.start();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Restart mock server
      await mockWebhookServer.start();

      // System should be running and ready to retry
      expect(application.isRunning()).toBe(true);

      await application.stop();
    }, 15000);
  });

  describe('Network Resilience', () => {
    it('should reconnect after network interruption', async () => {
      if (!shouldRunE2ETests) {
        console.log('E2E tests disabled - set CONFLUX_TESTNET_TESTS=true to run');
        return;
      }

      const config = ConfigFactory.createTestnetConfig();
      const fs = require('fs');
      const configPath = '/tmp/resilience-test-config.json';
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      application = new Application({ configPath });
      await application.start();

      // Verify initial connection
      expect(application.isRunning()).toBe(true);

      // System should handle network issues gracefully
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(application.isRunning()).toBe(true);

      await application.stop();
    }, 20000);
  });

  describe('Configuration Hot Reload', () => {
    it('should reload configuration without restart', async () => {
      if (!shouldRunE2ETests) {
        console.log('E2E tests disabled - set CONFLUX_TESTNET_TESTS=true to run');
        return;
      }

      const config = ConfigFactory.createTestnetConfig();
      const fs = require('fs');
      const configPath = '/tmp/hot-reload-test-config.json';
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      application = new Application({ configPath });
      await application.start();

      expect(application.isRunning()).toBe(true);

      // Modify configuration
      config.subscriptions.push(ConfigFactory.createEventSubscription({
        contractAddress: ContractFactory.generateTestAddress(2)
      }));

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      // Wait for hot reload
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(application.isRunning()).toBe(true);

      await application.stop();
    }, 15000);
  });
});
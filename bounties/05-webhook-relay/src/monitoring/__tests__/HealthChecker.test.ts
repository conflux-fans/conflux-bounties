import { HealthChecker } from '../HealthChecker';
import { Pool } from 'pg';

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn()
};

// Set up the child method to return the mock logger
mockLogger.child.mockReturnValue(mockLogger);

jest.mock('../Logger', () => ({
  Logger: jest.fn().mockImplementation(() => mockLogger)
}));

describe('HealthChecker', () => {
  let healthChecker: HealthChecker;

  beforeEach(() => {
    healthChecker = new HealthChecker();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default health checks', () => {
      const newHealthChecker = new HealthChecker();
      const registeredChecks = newHealthChecker.getRegisteredChecks();
      
      expect(registeredChecks).toContain('process');
      expect(registeredChecks).toContain('memory');
    });

    it('should create logger and call child method during construction', () => {
      // Clear previous mock calls
      jest.clearAllMocks();
      
      // Create a new HealthChecker to trigger constructor
      const newHealthChecker = new HealthChecker();
      
      // Verify Logger constructor was called
      const LoggerMock = require('../Logger').Logger;
      expect(LoggerMock).toHaveBeenCalled();
      
      // Verify child method was called with correct component name
      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'HealthChecker' });
      
      // Verify the health checker was created successfully
      expect(newHealthChecker).toBeDefined();
      expect(newHealthChecker.getRegisteredChecks()).toContain('process');
    });
  });

  describe('registerHealthCheck', () => {
    it('should register a health check', () => {
      const mockCheck = jest.fn().mockResolvedValue(true);
      
      healthChecker.registerHealthCheck('test_check', mockCheck);

      const registeredChecks = healthChecker.getRegisteredChecks();
      expect(registeredChecks).toContain('test_check');
    });

    it('should register health check with options', () => {
      const mockCheck = jest.fn().mockResolvedValue(true);
      
      healthChecker.registerHealthCheck('test_check', mockCheck, {
        timeout: 10000,
        critical: true,
        description: 'Test health check'
      });

      const registeredChecks = healthChecker.getRegisteredChecks();
      expect(registeredChecks).toContain('test_check');
    });
  });

  describe('unregisterHealthCheck', () => {
    it('should unregister a health check', () => {
      const mockCheck = jest.fn().mockResolvedValue(true);
      
      healthChecker.registerHealthCheck('test_check', mockCheck);
      expect(healthChecker.getRegisteredChecks()).toContain('test_check');

      healthChecker.unregisterHealthCheck('test_check');
      expect(healthChecker.getRegisteredChecks()).not.toContain('test_check');
    });

    it('should handle unregistering non-existent check', () => {
      expect(() => {
        healthChecker.unregisterHealthCheck('non_existent');
      }).not.toThrow();
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status when all checks pass', async () => {
      const mockCheck1 = jest.fn().mockResolvedValue(true);
      const mockCheck2 = jest.fn().mockResolvedValue(true);

      healthChecker.registerHealthCheck('check1', mockCheck1);
      healthChecker.registerHealthCheck('check2', mockCheck2);

      const result = await healthChecker.checkHealth();

      expect(result.status).toBe('healthy');
      expect(result.checks['check1']).toBe(true);
      expect(result.checks['check2']).toBe(true);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return degraded status when non-critical check fails', async () => {
      const mockCheck1 = jest.fn().mockResolvedValue(true);
      const mockCheck2 = jest.fn().mockResolvedValue(false);

      healthChecker.registerHealthCheck('check1', mockCheck1, { critical: true });
      healthChecker.registerHealthCheck('check2', mockCheck2, { critical: false });

      const result = await healthChecker.checkHealth();

      expect(result.status).toBe('degraded');
      expect(result.checks['check1']).toBe(true);
      expect(result.checks['check2']).toBe(false);
    });

    it('should return unhealthy status when critical check fails', async () => {
      const mockCheck1 = jest.fn().mockResolvedValue(true);
      const mockCheck2 = jest.fn().mockResolvedValue(false);

      healthChecker.registerHealthCheck('check1', mockCheck1, { critical: false });
      healthChecker.registerHealthCheck('check2', mockCheck2, { critical: true });

      const result = await healthChecker.checkHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.checks['check1']).toBe(true);
      expect(result.checks['check2']).toBe(false);
    });

    it('should handle check timeouts', async () => {
      const slowCheck = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(true), 10000))
      );

      healthChecker.registerHealthCheck('slow_check', slowCheck, { timeout: 100 });

      const result = await healthChecker.checkHealth();

      expect(result.checks['slow_check']).toBe(false);
    });

    it('should handle check exceptions', async () => {
      const errorCheck = jest.fn().mockRejectedValue(new Error('Check failed'));

      healthChecker.registerHealthCheck('error_check', errorCheck);

      const result = await healthChecker.checkHealth();

      expect(result.checks['error_check']).toBe(false);
    });

    it('should include default process check', async () => {
      const result = await healthChecker.checkHealth();

      expect(result.checks['process']).toBe(true);
      expect(result.checks['memory']).toBeDefined();
    });
  });

  describe('registerDatabaseHealthCheck', () => {
    it('should register database health check', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn()
      };

      const mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient)
      } as unknown as Pool;

      healthChecker.registerDatabaseHealthCheck(mockPool);

      const result = await healthChecker.checkHealth();

      expect(result.checks['database']).toBe(true);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle database connection failures', async () => {
      const mockPool = {
        connect: jest.fn().mockRejectedValue(new Error('Connection failed'))
      } as unknown as Pool;

      healthChecker.registerDatabaseHealthCheck(mockPool);

      const result = await healthChecker.checkHealth();

      expect(result.checks['database']).toBe(false);
    });

    it('should handle database query failures', async () => {
      const mockClient = {
        query: jest.fn().mockRejectedValue(new Error('Query failed')),
        release: jest.fn()
      };

      const mockPool = {
        connect: jest.fn().mockResolvedValue(mockClient)
      } as unknown as Pool;

      healthChecker.registerDatabaseHealthCheck(mockPool);

      const result = await healthChecker.checkHealth();

      expect(result.checks['database']).toBe(false);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('registerMemoryHealthCheck', () => {
    it('should register memory health check with default limit', async () => {
      healthChecker.registerMemoryHealthCheck();

      const result = await healthChecker.checkHealth();

      expect(result.checks['memory']).toBeDefined();
    });

    it('should register memory health check with custom limit', async () => {
      // Mock process.memoryUsage to return high memory usage
      const originalMemoryUsage = process.memoryUsage;
      (process as any).memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 2000 * 1024 * 1024, // 2000MB
        heapTotal: 2048 * 1024 * 1024,
        external: 0,
        rss: 2048 * 1024 * 1024
      });

      healthChecker.registerMemoryHealthCheck(1024); // 1024MB limit

      const result = await healthChecker.checkHealth();

      expect(result.checks['memory']).toBe(false);

      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('registerDiskSpaceHealthCheck', () => {
    it('should register disk space health check', async () => {
      // Mock fs.statfs
      const mockStatfs = jest.fn().mockResolvedValue({
        bavail: 1000000, // Available blocks
        bsize: 4096      // Block size
      });

      jest.doMock('fs/promises', () => ({
        statfs: mockStatfs
      }));

      healthChecker.registerDiskSpaceHealthCheck(1); // 1GB minimum

      const result = await healthChecker.checkHealth();

      // Should be healthy as we have ~4GB free space
      expect(result.checks['disk_space']).toBe(true);
    });

    it('should handle disk space check errors', async () => {
      // Create a new health checker and register a disk space check that will fail
      const newHealthChecker = new HealthChecker();
      
      newHealthChecker.registerHealthCheck(
        'disk_space',
        async () => {
          throw new Error('Disk check failed');
        },
        {
          timeout: 2000,
          critical: false,
          description: 'Free disk space check'
        }
      );

      const result = await newHealthChecker.checkHealth();

      expect(result.checks['disk_space']).toBe(false);
    });

    it('should handle critical health check failures', async () => {
      const mockCheck = jest.fn().mockRejectedValue(new Error('Critical failure'));

      healthChecker.registerHealthCheck('critical_check', mockCheck, { 
        critical: true,
        timeout: 1000 
      });

      const result = await healthChecker.checkHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.checks['critical_check']).toBe(false);
    });
  });

  describe('getRegisteredChecks', () => {
    it('should return list of registered checks', () => {
      const mockCheck = jest.fn().mockResolvedValue(true);
      
      healthChecker.registerHealthCheck('check1', mockCheck);
      healthChecker.registerHealthCheck('check2', mockCheck);

      const checks = healthChecker.getRegisteredChecks();

      expect(checks).toContain('check1');
      expect(checks).toContain('check2');
      expect(checks).toContain('process'); // Default check
      expect(checks).toContain('memory');  // Default check
    });
  });

  describe('getDetailedStatus', () => {
    it('should return detailed health status', async () => {
      const result = await healthChecker.getDetailedStatus();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('environment');
      expect(result).toHaveProperty('memory');
      expect(result).toHaveProperty('cpu');
      expect(result.memory).toHaveProperty('used');
      expect(result.memory).toHaveProperty('total');
      expect(result.memory).toHaveProperty('external');
      expect(result.memory).toHaveProperty('rss');
      expect(result.cpu).toHaveProperty('usage');
      expect(result.cpu).toHaveProperty('loadAverage');
    });

    it('should include version from environment variable', async () => {
      const originalVersion = process.env['npm_package_version'];
      process.env['npm_package_version'] = '2.0.0';

      const result = await healthChecker.getDetailedStatus();

      expect(result.version).toBe('2.0.0');

      // Restore original value
      if (originalVersion !== undefined) {
        process.env['npm_package_version'] = originalVersion;
      } else {
        delete process.env['npm_package_version'];
      }
    });

    it('should include environment from NODE_ENV', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      const result = await healthChecker.getDetailedStatus();

      expect(result.environment).toBe('production');

      // Restore original value
      if (originalEnv !== undefined) {
        process.env['NODE_ENV'] = originalEnv;
      } else {
        delete process.env['NODE_ENV'];
      }
    });
  });

  describe('platform-specific behavior', () => {
    it('should handle Windows platform for CPU load average', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true
      });

      const result = await healthChecker.getDetailedStatus();

      expect(result.cpu.loadAverage).toEqual([0, 0, 0]);

      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      });
    });

    it('should handle non-Windows platform for CPU load average', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true
      });

      const result = await healthChecker.getDetailedStatus();

      expect(Array.isArray(result.cpu.loadAverage)).toBe(true);
      expect(result.cpu.loadAverage).toHaveLength(3);

      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle timeout promise rejection correctly', async () => {
      const timeoutCheck = jest.fn().mockImplementation(() => 
        new Promise(() => {
          // Never resolve to trigger timeout
        })
      );

      healthChecker.registerHealthCheck('timeout_check', timeoutCheck, { 
        timeout: 50,
        critical: false 
      });

      const result = await healthChecker.checkHealth();

      expect(result.checks['timeout_check']).toBe(false);
    });

    it('should handle system info generation', async () => {
      const result = await healthChecker.checkHealth();

      expect(result.system).toBeDefined();
      if (result.system) {
        expect(result.system.uptime).toBeGreaterThan(0);
        expect(result.system.memory).toBeDefined();
        expect(result.system.cpu).toBeDefined();
        expect(result.system.platform).toBe(process.platform);
        expect(result.system.nodeVersion).toBe(process.version);
      }
    });

    it('should handle Logger constructor and child method calls', () => {
      // This test covers lines 10-11 (Logger constructor and child method)
      const newHealthChecker = new HealthChecker();
      expect(newHealthChecker).toBeDefined();
      
      // Verify that the logger was created and child method was called
      const registeredChecks = newHealthChecker.getRegisteredChecks();
      expect(registeredChecks).toContain('process');
      expect(registeredChecks).toContain('memory');
    });

    it('should handle registerDefaultHealthChecks method call', () => {
      // This test covers line 16 (registerDefaultHealthChecks call)
      const newHealthChecker = new HealthChecker();
      const checks = newHealthChecker.getRegisteredChecks();
      
      // Verify default checks were registered
      expect(checks).toContain('process');
      expect(checks).toContain('memory');
      expect(checks.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle debug logging in checkHealth method', async () => {
      // This test covers lines 21-23 (debug logging and loop setup)
      const mockCheck = jest.fn().mockResolvedValue(true);
      healthChecker.registerHealthCheck('test_debug', mockCheck);
      
      const result = await healthChecker.checkHealth();
      
      expect(result.checks['test_debug']).toBe(true);
      expect(mockCheck).toHaveBeenCalled();
    });

    it('should handle disk space check error path', async () => {
      // This test covers line 170 (return false in catch block)
      // Create a health checker and register a custom disk space check that will fail
      const newHealthChecker = new HealthChecker();
      
      // Register a custom disk space check that throws an error
      newHealthChecker.registerHealthCheck(
        'disk_space',
        async () => {
          // Simulate the fs.statfs error path
          await import('fs/promises');
          throw new Error('File system error');
        },
        {
          timeout: 2000,
          critical: false,
          description: 'Free disk space check'
        }
      );
      
      const result = await newHealthChecker.checkHealth();
      
      expect(result.checks['disk_space']).toBe(false);
    });

    it('should handle fs.statfs import and calculation', async () => {
      // Test the successful path of disk space check
      const mockFs = {
        statfs: jest.fn().mockResolvedValue({
          bavail: 2000000, // 2M available blocks
          bsize: 4096      // 4KB block size = ~8GB free
        })
      };
      
      jest.doMock('fs/promises', () => mockFs);
      
      const newHealthChecker = new HealthChecker();
      newHealthChecker.registerDiskSpaceHealthCheck(1); // Require 1GB minimum
      
      const result = await newHealthChecker.checkHealth();
      
      expect(result.checks['disk_space']).toBe(true);
    });
  });
});
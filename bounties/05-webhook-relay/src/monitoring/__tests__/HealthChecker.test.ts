import { HealthChecker } from '../HealthChecker';
import { Pool } from 'pg';

// Mock dependencies
jest.mock('../Logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis()
  }))
}));

describe('HealthChecker', () => {
  let healthChecker: HealthChecker;

  beforeEach(() => {
    healthChecker = new HealthChecker();
  });

  afterEach(() => {
    jest.clearAllMocks();
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
});
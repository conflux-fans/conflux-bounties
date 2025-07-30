import { DatabaseConnection } from '../connection';
import { DatabaseConfig } from '../../types/config';
import { Pool } from 'pg';

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
    totalCount: 5,
    idleCount: 3,
    waitingCount: 0,
  })),
}));

describe('DatabaseConnection', () => {
  let mockPool: any;
  let mockClient: any;
  let dbConnection: DatabaseConnection;
  let config: DatabaseConfig;

  beforeEach(() => {
    config = {
      url: 'postgresql://test:test@localhost:5432/testdb',
      poolSize: 10,
      connectionTimeout: 5000,
    };

    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    } as any;

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn(),
      end: jest.fn(),
      totalCount: 5,
      idleCount: 3,
      waitingCount: 0,
    } as any;

    (Pool as jest.MockedClass<typeof Pool>).mockImplementation(() => mockPool);
    
    dbConnection = new DatabaseConnection(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a pool with correct configuration', () => {
      expect(Pool).toHaveBeenCalledWith({
        connectionString: config.url,
        max: config.poolSize,
        connectionTimeoutMillis: config.connectionTimeout,
        idleTimeoutMillis: 30000,
        allowExitOnIdle: false,
      });
    });

    it('should use default values when config values are missing', () => {
      const minimalConfig = { url: 'postgresql://test:test@localhost:5432/testdb' } as DatabaseConfig;
      new DatabaseConnection(minimalConfig);

      expect(Pool).toHaveBeenCalledWith({
        connectionString: minimalConfig.url,
        max: 10,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        allowExitOnIdle: false,
      });
    });
  });

  describe('getClient', () => {
    it('should return a client from the pool', async () => {
      const client = await dbConnection.getClient();
      
      expect(mockPool.connect).toHaveBeenCalled();
      expect(client).toBe(mockClient);
    });

    it('should throw an error when pool connection fails', async () => {
      const error = new Error('Connection failed');
      mockPool.connect.mockRejectedValue(error);

      await expect(dbConnection.getClient()).rejects.toThrow('Failed to get database client: Error: Connection failed');
    });
  });

  describe('query', () => {
    it('should execute query and release client', async () => {
      const queryText = 'SELECT * FROM users';
      const params = ['param1'];
      const expectedResult = { rows: [{ id: 1, name: 'test' }] };
      
      mockClient.query.mockResolvedValue(expectedResult);

      const result = await dbConnection.query(queryText, params);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(queryText, params);
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe(expectedResult);
    });

    it('should release client even when query fails', async () => {
      const error = new Error('Query failed');
      mockClient.query.mockRejectedValue(error);

      await expect(dbConnection.query('SELECT 1')).rejects.toThrow('Query failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('transaction', () => {
    it('should execute callback within transaction and commit', async () => {
      const callback = jest.fn().mockResolvedValue('success');
      
      const result = await dbConnection.transaction(callback);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('should rollback transaction when callback fails', async () => {
      const error = new Error('Callback failed');
      const callback = jest.fn().mockRejectedValue(error);

      await expect(dbConnection.transaction(callback)).rejects.toThrow('Callback failed');
      
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should release client even when rollback fails', async () => {
      const callbackError = new Error('Callback failed');
      const rollbackError = new Error('Rollback failed');
      const callback = jest.fn().mockRejectedValue(callbackError);
      
      mockClient.query.mockImplementation((sql: string) => {
        if (sql === 'ROLLBACK') {
          return Promise.reject(rollbackError);
        }
        return Promise.resolve({} as any);
      });

      await expect(dbConnection.transaction(callback)).rejects.toThrow('Rollback failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return true when health check query succeeds', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ health: 1 }] });

      const result = await dbConnection.healthCheck();

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT 1 as health');
    });

    it('should return false when health check query fails', async () => {
      mockClient.query.mockRejectedValue(new Error('Connection lost'));

      const result = await dbConnection.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('close', () => {
    it('should end the pool', async () => {
      await dbConnection.close();

      expect(mockPool.end).toHaveBeenCalled();
    });
  });

  describe('getPoolInfo', () => {
    it('should return pool statistics', () => {
      const info = dbConnection.getPoolInfo();

      expect(info).toEqual({
        totalCount: 5,
        idleCount: 3,
        waitingCount: 0,
      });
    });
  });
});
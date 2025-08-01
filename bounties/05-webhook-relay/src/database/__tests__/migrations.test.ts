import { MigrationManager, Migration } from '../migrations';
// Import types for testing

// Mock the DatabaseConnection
jest.mock('../connection');

describe('MigrationManager', () => {
  let mockDb: any;
  let mockClient: any;
  let migrationManager: MigrationManager;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
    } as any;

    mockDb = {
      query: jest.fn(),
      transaction: jest.fn(),
    } as any;

    // Mock transaction to call the callback with mockClient
    mockDb.transaction.mockImplementation(async (callback: any) => {
      return await callback(mockClient);
    });

    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    migrationManager = new MigrationManager(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockRestore();
  });

  describe('initializeMigrationsTable', () => {
    it('should create migrations table', async () => {
      await migrationManager.initializeMigrationsTable();

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE IF NOT EXISTS migrations')
      );
    });
  });

  describe('getAppliedMigrations', () => {
    it('should return applied migration versions', async () => {
      const mockResult = {
        rows: [
          { version: '001' },
          { version: '002' },
        ]
      };
      mockDb.query.mockResolvedValue(mockResult);

      const result = await migrationManager.getAppliedMigrations();

      expect(result).toEqual(['001', '002']);
      expect(mockDb.query).toHaveBeenCalledWith('SELECT version FROM migrations ORDER BY version');
    });

    it('should return empty array when migrations table does not exist', async () => {
      mockDb.query.mockRejectedValue(new Error('Table does not exist'));

      const result = await migrationManager.getAppliedMigrations();

      expect(result).toEqual([]);
    });
  });

  describe('getPendingMigrations', () => {
    it('should return migrations that have not been applied', async () => {
      // Mock that only migration 001 has been applied
      mockDb.query.mockResolvedValue({
        rows: [{ version: '001' }]
      });

      const result = await migrationManager.getPendingMigrations();

      // Should return migration 002 since only 001 is applied
      expect(result).toHaveLength(1);
      expect(result[0]?.version).toBe('002');
      expect(result[0]?.name).toBe('add_dead_letter_queue');
    });

    it('should return all migrations when none have been applied', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await migrationManager.getPendingMigrations();

      expect(result).toHaveLength(2);
      expect(result[0]?.version).toBe('001');
      expect(result[0]?.name).toBe('initial_schema');
      expect(result[1]?.version).toBe('002');
      expect(result[1]?.name).toBe('add_dead_letter_queue');
    });
  });

  describe('runMigration', () => {
    it('should execute migration and record it', async () => {
      const migration: Migration = {
        version: '001',
        name: 'test_migration',
        up: 'CREATE TABLE test (id INTEGER);',
        down: 'DROP TABLE test;'
      };

      await migrationManager.runMigration(migration, mockClient);

      expect(mockClient.query).toHaveBeenCalledWith(migration.up);
      expect(mockClient.query).toHaveBeenCalledWith(
        'INSERT INTO migrations (version, name) VALUES ($1, $2)',
        ['001', 'test_migration']
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Migration 001 (test_migration) applied successfully'
      );
    });

    it('should throw error when migration fails', async () => {
      const migration: Migration = {
        version: '001',
        name: 'test_migration',
        up: 'INVALID SQL;',
        down: 'DROP TABLE test;'
      };

      const error = new Error('SQL syntax error');
      mockClient.query.mockRejectedValue(error);

      await expect(migrationManager.runMigration(migration, mockClient))
        .rejects.toThrow('Failed to apply migration 001: Error: SQL syntax error');
    });
  });

  describe('rollbackMigration', () => {
    it('should execute rollback and remove migration record', async () => {
      const migration: Migration = {
        version: '001',
        name: 'test_migration',
        up: 'CREATE TABLE test (id INTEGER);',
        down: 'DROP TABLE test;'
      };

      await migrationManager.rollbackMigration(migration, mockClient);

      expect(mockClient.query).toHaveBeenCalledWith(migration.down);
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM migrations WHERE version = $1',
        ['001']
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        'Migration 001 (test_migration) rolled back successfully'
      );
    });

    it('should throw error when rollback fails', async () => {
      const migration: Migration = {
        version: '001',
        name: 'test_migration',
        up: 'CREATE TABLE test (id INTEGER);',
        down: 'INVALID SQL;'
      };

      const error = new Error('SQL syntax error');
      mockClient.query.mockRejectedValue(error);

      await expect(migrationManager.rollbackMigration(migration, mockClient))
        .rejects.toThrow('Failed to rollback migration 001: Error: SQL syntax error');
    });
  });

  describe('migrate', () => {
    it('should run all pending migrations', async () => {
      // Mock no applied migrations
      mockDb.query.mockResolvedValue({ rows: [] });

      await migrationManager.migrate();

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Running 2 pending migrations...');
      expect(consoleSpy).toHaveBeenCalledWith('All migrations completed successfully');
    });

    it('should do nothing when no pending migrations', async () => {
      // Mock that both migrations are already applied
      mockDb.query.mockResolvedValue({
        rows: [{ version: '001' }, { version: '002' }]
      });

      await migrationManager.migrate();

      expect(consoleSpy).toHaveBeenCalledWith('No pending migrations');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });

  describe('rollback', () => {
    it('should rollback the last migration when no target version specified', async () => {
      // Mock that migration 001 is applied
      mockDb.query.mockResolvedValue({
        rows: [{ version: '001' }]
      });

      await migrationManager.rollback();

      expect(mockDb.transaction).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Rolling back 1 migrations...');
      expect(consoleSpy).toHaveBeenCalledWith('Rollback completed successfully');
    });

    it('should do nothing when no migrations are applied', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await migrationManager.rollback();

      expect(consoleSpy).toHaveBeenCalledWith('No migrations to rollback');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should rollback to specific target version when no migrations need rollback', async () => {
      // Mock that only migration 001 is applied, and we want to rollback to 001
      mockDb.query.mockResolvedValue({
        rows: [{ version: '001' }]
      });

      await migrationManager.rollback('001');

      // Should not rollback any migrations since target is the latest
      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Rolling back 0 migrations...');
      expect(consoleSpy).toHaveBeenCalledWith('Rollback completed successfully');
    });

    it('should throw error when migration to rollback is not found', async () => {
      // Mock that a non-existent migration version is applied
      mockDb.query.mockResolvedValue({
        rows: [{ version: '999' }]
      });

      await expect(migrationManager.rollback()).rejects.toThrow('Migration 999 not found');
    });
  });

  describe('getStatus', () => {
    it('should return applied and pending migration status', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ version: '001' }]
      });

      const status = await migrationManager.getStatus();

      expect(status).toEqual({
        applied: ['001'],
        pending: ['002']
      });
    });

    it('should return correct status when no migrations are applied', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const status = await migrationManager.getStatus();

      expect(status).toEqual({
        applied: [],
        pending: ['001', '002']
      });
    });
  });
});
import { Pool, PoolClient, PoolConfig } from 'pg';
import { DatabaseConfig } from '../types/config';

export class DatabaseConnection {
  private pool: Pool;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.pool = this.createPool();
  }

  private createPool(): Pool {
    const poolConfig: PoolConfig = {
      connectionString: this.config.url,
      max: this.config.poolSize || 10,
      connectionTimeoutMillis: this.config.connectionTimeout || 5000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: false,
    };

    return new Pool(poolConfig);
  }

  async getClient(): Promise<PoolClient> {
    try {
      return await this.pool.connect();
    } catch (error) {
      throw new Error(`Failed to get database client: ${error}`);
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getClient();
    try {
      const result = params ? await client.query(text, params) : await client.query(text);
      return result;
    } finally {
      client.release();
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health');
      return result.rows[0].health === 1;
    } catch (error) {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  getPoolInfo() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}
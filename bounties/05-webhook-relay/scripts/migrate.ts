#!/usr/bin/env ts-node

import { DatabaseConnection, MigrationManager } from '../src/database';
import { DatabaseConfig } from '../src/types/config';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const config: DatabaseConfig = {
  url: process.env.DATABASE_URL || 'postgresql://localhost:5432/webhook_relay',
  poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
};

async function main() {
  const command = process.argv[2];
  
  if (!command) {
    console.log('Usage: npm run migrate <command>');
    console.log('Commands:');
    console.log('  up       - Run all pending migrations');
    console.log('  down     - Rollback the last migration');
    console.log('  status   - Show migration status');
    console.log('  rollback <version> - Rollback to specific version');
    process.exit(1);
  }

  const db = new DatabaseConnection(config);
  const migrationManager = new MigrationManager(db);

  try {
    switch (command) {
      case 'up':
        await migrationManager.migrate();
        break;
      
      case 'down':
        await migrationManager.rollback();
        break;
      
      case 'status': {
        const status = await migrationManager.getStatus();
        console.log('Migration Status:');
        console.log('Applied:', status.applied);
        console.log('Pending:', status.pending);
        break;
      }
      
      case 'rollback': {
        const targetVersion = process.argv[3];
        if (!targetVersion) {
          console.error('Please specify target version for rollback');
          process.exit(1);
        }
        await migrationManager.rollback(targetVersion);
        break;
      }
      
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

main().catch(console.error);
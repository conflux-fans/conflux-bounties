/**
 * Test setup — sets DATABASE_PATH to a temp file and JWT_SECRET before any tests run.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Use a unique temp directory per test run
const tmpDir = mkdtempSync(join(tmpdir(), 'cas-test-'));

process.env.DATABASE_PATH = join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-chars-long!!';
process.env.PORT = '0'; // random port, not used by supertest

/**
 * Test-safe env defaults. Import this BEFORE env.ts in tests
 * to avoid zod validation failures.
 */
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/test";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
process.env.CONFLUX_RPC_URL = process.env.CONFLUX_RPC_URL || "https://evmtestnet.confluxrpc.com";
process.env.REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS || "0x0000000000000000000000000000000000000001";
process.env.PINATA_JWT = process.env.PINATA_JWT || "test-jwt-token";
process.env.NODE_ENV = "test";

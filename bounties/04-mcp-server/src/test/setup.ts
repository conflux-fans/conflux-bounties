// Test setup file for Bun
// Keep global setup minimal to avoid interfering with per-test mocks

// Ensure PRIVATE_KEY is set for tests
process.env.PRIVATE_KEY = process.env.PRIVATE_KEY || '0x'.padEnd(66, '1');

// Silence noisy logs during tests
const originalConsoleError = console.error;
console.error = (...args) => {
	if (String(args[0] ?? '').includes('Error fetching NFT metadata')) return;
	originalConsoleError.apply(console, args);
};

console.log('Test setup loaded');

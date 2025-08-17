import { 
  formatTokenAmount, 
  parseTokenAmount, 
  shortenAddress, 
  getAddress,
  formatDuration,
  calculateVestingProgress,
  getContractErrorMessage
} from './utils';

describe('Web3 Utils', () => {
  describe('formatTokenAmount', () => {
    it('should format token amounts correctly', () => {
      expect(formatTokenAmount(BigInt('1000000000000000000'))).toBe('1');
      expect(formatTokenAmount(BigInt('1500000000000000000'))).toBe('1.5');
      expect(formatTokenAmount(BigInt('0'))).toBe('0');
    });

    it('should handle large amounts', () => {
      expect(formatTokenAmount(BigInt('1000000000000000000000000'))).toBe('1000000');
    });

    it('should handle small amounts', () => {
      expect(formatTokenAmount(BigInt('1'))).toBe('0.000000000000000001');
    });
  });

  describe('parseTokenAmount', () => {
    it('should parse token amounts correctly', () => {
      expect(parseTokenAmount('1')).toBe(BigInt('1000000000000000000'));
      expect(parseTokenAmount('1.5')).toBe(BigInt('1500000000000000000'));
      expect(parseTokenAmount('0')).toBe(BigInt('0'));
    });

    it('should handle large amounts', () => {
      expect(parseTokenAmount('1000000')).toBe(BigInt('1000000000000000000000000'));
    });

    it('should handle small amounts', () => {
      expect(parseTokenAmount('0.000000000000000001')).toBe(BigInt('1'));
    });
  });

  describe('shortenAddress', () => {
    it('should shorten addresses correctly', () => {
      const address = '0x1234567890123456789012345678901234567890';
      expect(shortenAddress(address)).toBe('0x1234...7890');
    });

    it('should handle custom character lengths', () => {
      const address = '0x1234567890123456789012345678901234567890';
      expect(shortenAddress(address, 2)).toBe('0x12...90');
    });
  });

  describe('getAddress', () => {
    it('should return valid addresses in lowercase', () => {
      expect(getAddress('0x1234567890123456789012345678901234567890')).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should handle empty string gracefully', () => {
      expect(getAddress('')).toBe('');
    });
  });

  describe('formatDuration', () => {
    it('should format duration with days, hours, and minutes', () => {
      const seconds = 2 * 24 * 60 * 60 + 3 * 60 * 60 + 30 * 60; // 2 days, 3 hours, 30 minutes
      expect(formatDuration(seconds)).toBe('2d 3h 30m');
    });

    it('should format duration with hours and minutes only', () => {
      const seconds = 3 * 60 * 60 + 30 * 60; // 3 hours, 30 minutes
      expect(formatDuration(seconds)).toBe('3h 30m');
    });

    it('should format duration with minutes only', () => {
      const seconds = 45 * 60; // 45 minutes
      expect(formatDuration(seconds)).toBe('45m');
    });

    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('0m');
    });

    it('should handle very short durations', () => {
      expect(formatDuration(30)).toBe('0m');
      expect(formatDuration(60)).toBe('1m');
    });

    it('should handle very long durations', () => {
      const seconds = 365 * 24 * 60 * 60; // 1 year
      expect(formatDuration(seconds)).toBe('365d 0h 0m');
    });
  });

  describe('calculateVestingProgress', () => {
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - 1000; // Started 1000 seconds ago
    const cliff = 500; // 500 second cliff
    const duration = 2000; // 2000 second total duration

    it('should calculate progress during cliff period', () => {
      const currentTime = startTime + 250; // During cliff
      const result = calculateVestingProgress(startTime, cliff, duration, currentTime);
      
      expect(result.progressPercentage).toBe(0);
      expect(result.timeElapsed).toBe(250);
      expect(result.timeRemaining).toBe(1750);
      expect(result.isCliffPeriod).toBe(true);
      expect(result.isVestingComplete).toBe(false);
    });

    it('should calculate progress after cliff but before completion', () => {
      const currentTime = startTime + 1000; // After cliff, before completion
      const result = calculateVestingProgress(startTime, cliff, duration, currentTime);
      
      expect(result.progressPercentage).toBeGreaterThan(0);
      expect(result.progressPercentage).toBeLessThan(100);
      expect(result.timeElapsed).toBe(1000);
      expect(result.timeRemaining).toBe(1000);
      expect(result.isCliffPeriod).toBe(false);
      expect(result.isVestingComplete).toBe(false);
    });

    it('should calculate progress when vesting is complete', () => {
      const currentTime = startTime + 2500; // After completion
      const result = calculateVestingProgress(startTime, cliff, duration, currentTime);
      
      expect(result.progressPercentage).toBe(100);
      expect(result.timeElapsed).toBe(2500);
      expect(result.timeRemaining).toBe(0);
      expect(result.isCliffPeriod).toBe(false);
      expect(result.isVestingComplete).toBe(true);
    });

    it('should handle edge cases', () => {
      // At cliff end
      const cliffEnd = startTime + cliff;
      const result = calculateVestingProgress(startTime, cliff, duration, cliffEnd);
      expect(result.progressPercentage).toBe(0);
      expect(result.isCliffPeriod).toBe(false);

      // At vesting end
      const vestingEnd = startTime + duration;
      const result2 = calculateVestingProgress(startTime, cliff, duration, vestingEnd);
      expect(result2.progressPercentage).toBe(100);
      expect(result2.isVestingComplete).toBe(true);
    });

    it('should handle zero cliff', () => {
      const currentTime = startTime + 1000;
      const result = calculateVestingProgress(startTime, 0, duration, currentTime);
      
      expect(result.isCliffPeriod).toBe(false);
      expect(result.progressPercentage).toBeGreaterThan(0);
    });

    it('should handle very short durations', () => {
      const shortDuration = 100;
      const currentTime = startTime + 50;
      const result = calculateVestingProgress(startTime, 0, shortDuration, currentTime);
      
      expect(result.progressPercentage).toBe(50);
    });
  });

  describe('getContractErrorMessage', () => {
    it('should handle user rejection errors', () => {
      const error = { message: 'user rejected transaction' };
      expect(getContractErrorMessage(error)).toBe('Transaction was rejected by user');
    });

    it('should handle insufficient funds errors', () => {
      const error = { message: 'insufficient funds for gas' };
      expect(getContractErrorMessage(error)).toBe('Insufficient funds for transaction');
    });

    it('should handle execution reverted errors', () => {
      const error = { message: 'execution reverted: custom error' };
      expect(getContractErrorMessage(error)).toBe('Transaction failed: Contract execution reverted');
    });

    it('should return original message for unknown errors', () => {
      const error = { message: 'custom error message' };
      expect(getContractErrorMessage(error)).toBe('custom error message');
    });

    it('should handle errors without message', () => {
      const error = {};
      expect(getContractErrorMessage(error)).toBe('An unknown error occurred');
    });

    it('should handle null/undefined errors', () => {
      expect(getContractErrorMessage(null)).toBe('An unknown error occurred');
      expect(getContractErrorMessage(undefined)).toBe('An unknown error occurred');
    });

    it('should handle case-sensitive error matching', () => {
      const error1 = { message: 'user rejected' };
      const error2 = { message: 'insufficient funds' };
      
      expect(getContractErrorMessage(error1)).toBe('Transaction was rejected by user');
      expect(getContractErrorMessage(error2)).toBe('Insufficient funds for transaction');
    });
  });

  describe('Integration tests', () => {
    it('should round-trip formatTokenAmount and parseTokenAmount', () => {
      const testAmounts = ['0', '1', '0.1', '1.5', '100.123'];
      
      testAmounts.forEach(amount => {
        const parsed = parseTokenAmount(amount);
        const formatted = formatTokenAmount(parsed);
        expect(formatted).toBe(amount);
      });
    });

    it('should handle complex vesting scenarios', () => {
      const startTime = 1000;
      const cliff = 500;
      const duration = 2000;
      
      // Test multiple time points
      const timePoints = [500, 1000, 1500, 2500];
      
      timePoints.forEach(currentTime => {
        const result = calculateVestingProgress(startTime, cliff, duration, currentTime);
        
        expect(result.progressPercentage).toBeGreaterThanOrEqual(0);
        expect(result.progressPercentage).toBeLessThanOrEqual(100);
        expect(result.timeElapsed).toBeGreaterThanOrEqual(0);
        expect(result.timeRemaining).toBeGreaterThanOrEqual(0);
      });
    });
  });
});

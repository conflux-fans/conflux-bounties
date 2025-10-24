import { logger } from '../../../src/utils/logger';

jest.mock('winston', () => {
  const mFormat = {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  };

  const mTransports = {
    File: jest.fn(),
    Console: jest.fn(),
  };

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn(),
  };

  return {
    format: mFormat,
    transports: mTransports,
    createLogger: jest.fn(() => mockLogger),
  };
});

describe('Logger', () => {
  describe('Logger Instance', () => {
    it('should be defined', () => {
      expect(logger).toBeDefined();
    });

    it('should have info method', () => {
      expect(logger.info).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    it('should have error method', () => {
      expect(logger.error).toBeDefined();
      expect(typeof logger.error).toBe('function');
    });

    it('should have warn method', () => {
      expect(logger.warn).toBeDefined();
      expect(typeof logger.warn).toBe('function');
    });

    it('should have debug method', () => {
      expect(logger.debug).toBeDefined();
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('Logging Methods', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should log info messages without throwing', () => {
      expect(() => {
        logger.info('Test info message');
      }).not.toThrow();
      
      expect(logger.info).toHaveBeenCalledWith('Test info message');
    });

    it('should log error messages without throwing', () => {
      expect(() => {
        logger.error('Test error message');
      }).not.toThrow();
      
      expect(logger.error).toHaveBeenCalledWith('Test error message');
    });

    it('should log warn messages without throwing', () => {
      expect(() => {
        logger.warn('Test warning message');
      }).not.toThrow();
      
      expect(logger.warn).toHaveBeenCalledWith('Test warning message');
    });

    it('should log debug messages without throwing', () => {
      expect(() => {
        logger.debug('Test debug message');
      }).not.toThrow();
      
      expect(logger.debug).toHaveBeenCalledWith('Test debug message');
    });

    it('should log messages with metadata', () => {
      const metadata = {
        userId: '123',
        action: 'test',
      };

      expect(() => {
        logger.info('Test message with metadata', metadata);
      }).not.toThrow();
      
      expect(logger.info).toHaveBeenCalledWith('Test message with metadata', metadata);
    });

    it('should log error objects', () => {
      const error = new Error('Test error');
      
      expect(() => {
        logger.error('Error occurred:', error);
      }).not.toThrow();
      
      expect(logger.error).toHaveBeenCalledWith('Error occurred:', error);
    });
  });

  describe('Log Levels', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should support different log levels', () => {
      expect(() => {
        logger.info('Info level');
        logger.warn('Warning level');
        logger.error('Error level');
        logger.debug('Debug level');
      }).not.toThrow();

      expect(logger.info).toHaveBeenCalledWith('Info level');
      expect(logger.warn).toHaveBeenCalledWith('Warning level');
      expect(logger.error).toHaveBeenCalledWith('Error level');
      expect(logger.debug).toHaveBeenCalledWith('Debug level');
    });
  });

  describe('Structured Logging', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle complex metadata objects', () => {
      const complexData = {
        user: { id: '123', name: 'Test' },
        timestamp: Date.now(),
        metadata: { key: 'value' },
      };

      expect(() => {
        logger.info('Complex log', complexData);
      }).not.toThrow();
      
      expect(logger.info).toHaveBeenCalledWith('Complex log', complexData);
    });

    it('should handle arrays in metadata', () => {
      const arrayData = {
        items: ['item1', 'item2', 'item3'],
      };

      expect(() => {
        logger.info('Array log', arrayData);
      }).not.toThrow();
      
      expect(logger.info).toHaveBeenCalledWith('Array log', arrayData);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle null values', () => {
      expect(() => {
        logger.info('Null test', { value: null });
      }).not.toThrow();
      
      expect(logger.info).toHaveBeenCalled();
    });

    it('should handle undefined values', () => {
      expect(() => {
        logger.info('Undefined test', { value: undefined });
      }).not.toThrow();
      
      expect(logger.info).toHaveBeenCalled();
    });

    it('should handle empty strings', () => {
      expect(() => {
        logger.info('');
      }).not.toThrow();
      
      expect(logger.info).toHaveBeenCalledWith('');
    });

    it('should handle multiple arguments', () => {
      expect(() => {
        logger.info('Message', 'arg1', 'arg2');
      }).not.toThrow();
      
      expect(logger.info).toHaveBeenCalledWith('Message', 'arg1', 'arg2');
    });

    it('should handle numeric values', () => {
      expect(() => {
        logger.info('Numeric test', { count: 123, price: 45.67 });
      }).not.toThrow();
    });

    it('should handle boolean values', () => {
      expect(() => {
        logger.info('Boolean test', { success: true, failed: false });
      }).not.toThrow();
    });
  });

  describe('Call Tracking', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should track info calls', () => {
      logger.info('test1');
      logger.info('test2');
      
      expect(logger.info).toHaveBeenCalledTimes(2);
    });

    it('should track error calls', () => {
      logger.error('error1');
      logger.error('error2');
      logger.error('error3');
      
      expect(logger.error).toHaveBeenCalledTimes(3);
    });

    it('should track mixed log level calls', () => {
      logger.info('info');
      logger.warn('warn');
      logger.error('error');
      logger.debug('debug');
      
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledTimes(1);
    });
  });
});
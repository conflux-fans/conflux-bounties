import winston from 'winston';
import { ILogger } from './interfaces';
import { correlationIdManager } from './CorrelationId';

export class Logger implements ILogger {
  private logger: winston.Logger;

  constructor(options: LoggerOptions = {}) {
    const {
      level = 'info',
      format = 'json',
      enableConsole = true,
      enableFile = false,
      filename = 'app.log',
      maxFiles = 5,
      maxSize = '20m'
    } = options;

    const formats = [];
    
    // Add timestamp
    formats.push(winston.format.timestamp());
    
    // Add error stack traces
    formats.push(winston.format.errors({ stack: true }));
    
    // Add correlation ID to all log entries
    formats.push(winston.format.printf((info) => {
      const context = correlationIdManager.getContext();
      const logEntry: any = {
        ...info,
        correlationId: context?.correlationId,
        requestId: context?.requestId,
        userId: context?.userId
      };
      
      // Remove undefined values
      Object.keys(logEntry).forEach(key => {
        if (logEntry[key] === undefined) {
          delete logEntry[key];
        }
      });
      
      if (format === 'json') {
        return JSON.stringify(logEntry);
      } else {
        const { timestamp, level, message, correlationId, requestId, userId, ...meta } = logEntry;
        const contextStr = [correlationId, requestId, userId].filter(Boolean).join('|');
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
        const contextPart = contextStr ? `[${contextStr}]` : '';
        return `${timestamp} [${level.toUpperCase()}]${contextPart}: ${message} ${metaStr}`;
      }
    }));

    const transports: winston.transport[] = [];

    // Console transport
    if (enableConsole) {
      transports.push(new winston.transports.Console({
        format: format === 'json' 
          ? winston.format.combine(...formats)
          : winston.format.combine(
              winston.format.colorize(),
              ...formats
            )
      }));
    }

    // File transport
    if (enableFile) {
      transports.push(new winston.transports.File({
        filename,
        maxFiles,
        maxsize: this.parseSize(maxSize),
        format: winston.format.combine(...formats)
      }));
    }

    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(...formats),
      transports,
      // Handle uncaught exceptions
      exceptionHandlers: enableFile ? [
        new winston.transports.File({ filename: 'exceptions.log' })
      ] : [],
      // Handle unhandled promise rejections
      rejectionHandlers: enableFile ? [
        new winston.transports.File({ filename: 'rejections.log' })
      ] : []
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: Error, meta?: any): void {
    const errorMeta = error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      ...meta
    } : meta;
    
    this.logger.error(message, errorMeta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  // Additional utility methods
  child(defaultMeta: any): Logger {
    const childLogger = new Logger();
    childLogger.logger = this.logger.child(defaultMeta);
    return childLogger;
  }

  setLevel(level: string): void {
    this.logger.level = level;
  }

  private parseSize(size: string): number {
    const units: Record<string, number> = {
      'b': 1,
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024
    };
    
    const match = size.toLowerCase().match(/^(\d+)([bkmg]?)$/);
    if (!match) return 20 * 1024 * 1024; // Default 20MB
    
    const [, num, unit = ''] = match;
    return parseInt(num || '0', 10) * (units[unit] || 1);
  }
}

export interface LoggerOptions {
  level?: string;
  format?: 'json' | 'text';
  enableConsole?: boolean;
  enableFile?: boolean;
  filename?: string;
  maxFiles?: number;
  maxSize?: string;
}

// Create default logger instance
export const logger = new Logger({
  level: process.env['LOG_LEVEL'] || 'info',
  format: (process.env['LOG_FORMAT'] as 'json' | 'text') || 'json',
  enableConsole: true,
  enableFile: process.env['LOG_FILE'] === 'true'
});
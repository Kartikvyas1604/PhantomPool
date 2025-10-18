/**
 * Logger Utility
 * Centralized logging for PhantomPool API
 */

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  metadata?: any;
}

class Logger {
  private logLevel: LogLevel;
  private enableConsole: boolean;
  private enableFile: boolean;

  constructor() {
    this.logLevel = this.getLogLevel();
    this.enableConsole = true;
    this.enableFile = process.env.NODE_ENV === 'production';
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    
    switch (level) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: string, message: string, metadata?: any): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata,
    };
  }

  private output(logEntry: LogEntry): void {
    const formatted = `[${logEntry.timestamp}] ${logEntry.level}: ${logEntry.message}`;
    
    if (this.enableConsole) {
      switch (logEntry.level) {
        case 'DEBUG':
          console.debug(formatted, logEntry.metadata || '');
          break;
        case 'INFO':
          console.info(formatted, logEntry.metadata || '');
          break;
        case 'WARN':
          console.warn(formatted, logEntry.metadata || '');
          break;
        case 'ERROR':
          console.error(formatted, logEntry.metadata || '');
          break;
      }
    }

    // In production: send to external logging service
    if (this.enableFile && process.env.NODE_ENV === 'production') {
      // TODO: Implement file logging or external service integration
      // Examples: Winston, Pino, or cloud logging services
    }
  }

  debug(message: string, metadata?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const logEntry = this.formatMessage('DEBUG', message, metadata);
      this.output(logEntry);
    }
  }

  info(message: string, metadata?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const logEntry = this.formatMessage('INFO', message, metadata);
      this.output(logEntry);
    }
  }

  warn(message: string, metadata?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const logEntry = this.formatMessage('WARN', message, metadata);
      this.output(logEntry);
    }
  }

  error(message: string, metadata?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const logEntry = this.formatMessage('ERROR', message, metadata);
      this.output(logEntry);
    }
  }

  // Request logging helper
  request(method: string, path: string, metadata?: any): void {
    this.info(`${method} ${path}`, {
      type: 'request',
      ...metadata,
    });
  }

  // Response logging helper
  response(method: string, path: string, statusCode: number, duration: number, metadata?: any): void {
    const message = `${method} ${path} - ${statusCode} (${duration}ms)`;
    
    if (statusCode >= 400) {
      this.warn(message, { type: 'response', statusCode, duration, ...metadata });
    } else {
      this.info(message, { type: 'response', statusCode, duration, ...metadata });
    }
  }

  // Database operation logging
  database(operation: string, table: string, metadata?: any): void {
    this.debug(`DB ${operation} on ${table}`, {
      type: 'database',
      operation,
      table,
      ...metadata,
    });
  }

  // Crypto operation logging
  crypto(operation: string, metadata?: any): void {
    this.debug(`Crypto ${operation}`, {
      type: 'crypto',
      operation,
      ...metadata,
    });
  }

  // Security event logging
  security(event: string, metadata?: any): void {
    this.warn(`Security: ${event}`, {
      type: 'security',
      event,
      ...metadata,
    });
  }

  // Performance logging
  performance(operation: string, duration: number, metadata?: any): void {
    const message = `Performance: ${operation} took ${duration}ms`;
    
    if (duration > 1000) {
      this.warn(message, { type: 'performance', operation, duration, ...metadata });
    } else {
      this.debug(message, { type: 'performance', operation, duration, ...metadata });
    }
  }

  // Audit logging for compliance
  audit(action: string, userId?: string, metadata?: any): void {
    this.info(`Audit: ${action}`, {
      type: 'audit',
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }
}

// Create singleton logger instance
export const logger = new Logger();

// Export logger class for testing or custom instances
export { Logger };
interface LogLevel {
  error: number;
  warn: number; 
  info: number;
  debug: number;
}

const logLevels: LogLevel = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export class LoggerService {
  private level: keyof LogLevel;

  constructor(level: keyof LogLevel = 'info') {
    this.level = level;
  }

  private shouldLog(messageLevel: keyof LogLevel): boolean {
    return logLevels[messageLevel] <= logLevels[this.level];
  }

  private formatMessage(level: string, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }
}

export const logger = new LoggerService(process.env.LOG_LEVEL as keyof LogLevel);

export function createContextLogger(context: string) {
  return {
    info: (message: string, meta?: Record<string, unknown>) => 
      logger.info(message, { context, ...meta }),
    error: (message: string, meta?: Record<string, unknown>) => 
      logger.error(message, { context, ...meta }),
    warn: (message: string, meta?: Record<string, unknown>) => 
      logger.warn(message, { context, ...meta }),
    debug: (message: string, meta?: Record<string, unknown>) => 
      logger.debug(message, { context, ...meta }),
  };
}
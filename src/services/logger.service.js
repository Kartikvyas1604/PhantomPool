/**
 * PhantomPool Advanced Logging Service
 * Structured logging with file output, log rotation, and filtering
 */

const fs = require('fs');
const path = require('path');

class PhantomPoolLogger {
  constructor(options = {}) {
    this.options = {
      logLevel: options.logLevel || 'info',
      enableFileLogging: options.enableFileLogging !== false,
      logDirectory: options.logDirectory || path.join(process.cwd(), 'logs'),
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: options.maxFiles || 5,
      enableConsole: options.enableConsole !== false,
      enableJson: options.enableJson || false,
      ...options
    };

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };

    this.currentLogFile = null;
    this.logStats = {
      totalLogs: 0,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      debugCount: 0,
      traceCount: 0
    };

    this.init();
  }

  init() {
    if (this.options.enableFileLogging) {
      this.ensureLogDirectory();
      this.initLogFile();
    }

    // Handle process shutdown gracefully
    process.on('SIGINT', () => {
      this.info('Logger shutting down gracefully');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.info('Logger shutting down gracefully');
      process.exit(0);
    });

    this.info('PhantomPool Logger initialized', {
      logLevel: this.options.logLevel,
      fileLogging: this.options.enableFileLogging,
      logDirectory: this.options.logDirectory
    });
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.options.logDirectory)) {
      fs.mkdirSync(this.options.logDirectory, { recursive: true });
    }
  }

  initLogFile() {
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `phantompool-${timestamp}.log`;
    this.currentLogFile = path.join(this.options.logDirectory, filename);
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.options.logLevel];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const baseLog = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };

    if (this.options.enableJson) {
      return JSON.stringify(baseLog);
    }

    // Human-readable format
    const metaStr = Object.keys(meta).length > 0 ? 
      ' | ' + Object.entries(meta)
        .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join(' ') : '';

    return `[${timestamp}] ${level.toUpperCase().padEnd(5)} | ${message}${metaStr}`;
  }

  writeToFile(formattedMessage) {
    if (!this.options.enableFileLogging || !this.currentLogFile) return;

    try {
      // Check if we need to rotate the log file
      if (fs.existsSync(this.currentLogFile)) {
        const stats = fs.statSync(this.currentLogFile);
        if (stats.size > this.options.maxFileSize) {
          this.rotateLogFile();
        }
      }

      fs.appendFileSync(this.currentLogFile, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  rotateLogFile() {
    if (!this.currentLogFile) return;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = this.currentLogFile.replace('.log', `-${timestamp}.log`);
      
      if (fs.existsSync(this.currentLogFile)) {
        fs.renameSync(this.currentLogFile, rotatedFile);
      }

      // Clean up old log files
      this.cleanOldLogFiles();

      // Initialize new log file
      this.initLogFile();
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  cleanOldLogFiles() {
    try {
      const files = fs.readdirSync(this.options.logDirectory)
        .filter(file => file.startsWith('phantompool-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.options.logDirectory, file),
          mtime: fs.statSync(path.join(this.options.logDirectory, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Keep only the most recent files
      const filesToDelete = files.slice(this.options.maxFiles);
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (error) {
          console.error(`Failed to delete old log file ${file.name}:`, error);
        }
      });
    } catch (error) {
      console.error('Failed to clean old log files:', error);
    }
  }

  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    this.logStats.totalLogs++;
    this.logStats[`${level}Count`] = (this.logStats[`${level}Count`] || 0) + 1;

    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Console output
    if (this.options.enableConsole) {
      const emoji = this.getLogEmoji(level);
      console.log(`${emoji} ${formattedMessage}`);
    }

    // File output
    this.writeToFile(formattedMessage);

    return {
      level,
      message,
      meta,
      timestamp: new Date().toISOString()
    };
  }

  getLogEmoji(level) {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      case 'debug': return '🔍';
      case 'trace': return '🔬';
      default: return '📝';
    }
  }

  // Convenience methods
  error(message, meta = {}) {
    return this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    return this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    return this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    return this.log('debug', message, meta);
  }

  trace(message, meta = {}) {
    return this.log('trace', message, meta);
  }

  // Specialized logging methods
  logRequest(req, res, duration) {
    const meta = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };

    const level = res.statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `${req.method} ${req.url} ${res.statusCode} - ${duration}ms`, meta);
  }

  logWebSocket(event, clientId, data = {}) {
    this.info(`WebSocket ${event}`, {
      clientId,
      event,
      ...data
    });
  }

  logOrder(action, order, extra = {}) {
    this.info(`Order ${action}`, {
      orderId: order.id,
      type: order.type,
      amount: order.amount,
      price: order.price,
      status: order.status,
      ...extra
    });
  }

  logTrade(action, trade, extra = {}) {
    this.info(`Trade ${action}`, {
      tradeId: trade.id,
      orderId: trade.orderId,
      amount: trade.amount,
      price: trade.price,
      ...extra
    });
  }

  logCrypto(operation, success, details = {}) {
    const level = success ? 'info' : 'warn';
    this.log(level, `Crypto operation: ${operation}`, {
      operation,
      success,
      ...details
    });
  }

  logSecurity(event, severity, details = {}) {
    const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    this.log(level, `Security event: ${event}`, {
      event,
      severity,
      ...details
    });
  }

  logThreshold(action, nodeId, details = {}) {
    this.info(`Threshold ${action}`, {
      nodeId,
      action,
      ...details
    });
  }

  // Performance logging
  logPerformance(operation, duration, details = {}) {
    const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    this.log(level, `Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      ...details
    });
  }

  // Database logging
  logDatabase(operation, query, duration, error = null) {
    const meta = {
      operation,
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      duration: `${duration}ms`
    };

    if (error) {
      this.error(`Database error: ${operation}`, { ...meta, error: error.message });
    } else {
      const level = duration > 1000 ? 'warn' : 'debug';
      this.log(level, `Database: ${operation}`, meta);
    }
  }

  // Get logging statistics
  getStats() {
    return {
      ...this.logStats,
      currentLogFile: this.currentLogFile,
      logLevel: this.options.logLevel,
      fileLoggingEnabled: this.options.enableFileLogging
    };
  }

  // Read recent logs
  getRecentLogs(lines = 100) {
    if (!this.options.enableFileLogging || !this.currentLogFile || !fs.existsSync(this.currentLogFile)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.currentLogFile, 'utf8');
      const logLines = content.split('\n').filter(line => line.trim() !== '');
      return logLines.slice(-lines);
    } catch (error) {
      this.error('Failed to read recent logs', { error: error.message });
      return [];
    }
  }

  // Search logs
  searchLogs(query, maxResults = 100) {
    if (!this.options.enableFileLogging || !this.currentLogFile || !fs.existsSync(this.currentLogFile)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.currentLogFile, 'utf8');
      const logLines = content.split('\n').filter(line => 
        line.trim() !== '' && line.toLowerCase().includes(query.toLowerCase())
      );
      return logLines.slice(0, maxResults);
    } catch (error) {
      this.error('Failed to search logs', { error: error.message, query });
      return [];
    }
  }

  // Export logs
  exportLogs(startDate, endDate, format = 'text') {
    const logs = this.getRecentLogs(10000); // Get recent logs
    const filteredLogs = logs.filter(log => {
      const logDate = new Date(log.match(/\[(.*?)\]/)?.[1] || '');
      return logDate >= startDate && logDate <= endDate;
    });

    if (format === 'json') {
      return JSON.stringify(filteredLogs, null, 2);
    }

    return filteredLogs.join('\n');
  }
}

// Create global logger instance
let loggerInstance = null;

function getLogger(options = {}) {
  if (!loggerInstance) {
    loggerInstance = new PhantomPoolLogger(options);
  }
  return loggerInstance;
}

// Express middleware for request logging
function createRequestLogger(logger = null) {
  const log = logger || getLogger();
  
  return (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      log.logRequest(req, res, duration);
    });
    
    next();
  };
}

module.exports = {
  PhantomPoolLogger,
  getLogger,
  createRequestLogger
};
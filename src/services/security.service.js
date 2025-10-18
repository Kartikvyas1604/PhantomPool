/**
 * PhantomPool Security Service
 * Comprehensive security hardening for production deployment
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const xss = require('xss');

// Custom validation functions to avoid vulnerable validator
const customValidator = {
  isFloat: (str, options = {}) => {
    const num = parseFloat(str);
    if (isNaN(num)) return false;
    if (options.min !== undefined && num < options.min) return false;
    if (options.max !== undefined && num > options.max) return false;
    return true;
  },
  
  isInt: (str, options = {}) => {
    const num = parseInt(str, 10);
    if (isNaN(num) || !Number.isInteger(num)) return false;
    if (options.min !== undefined && num < options.min) return false;
    if (options.max !== undefined && num > options.max) return false;
    return true;
  },
  
  isAlphanumeric: (str) => {
    return /^[a-zA-Z0-9]+$/.test(str);
  },
  
  isLength: (str, options) => {
    const len = str.length;
    return len >= options.min && len <= options.max;
  }
};

class PhantomPoolSecurityService {
  constructor() {
    this.blockedIPs = new Set();
    this.suspiciousActivities = new Map();
    this.authTokens = new Map();
    this.apiKeys = new Map();
    this.rateLimitStore = new Map();
    
    // Initialize security configurations
    this.initializeSecurityConfig();
  }

  initializeSecurityConfig() {
    this.config = {
      // Rate limiting configuration
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
      },
      
      // Strict rate limiting for sensitive endpoints
      strictRateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: 'Too many attempts for sensitive operation, please try again later.',
      },
      
      // Authentication configuration
      auth: {
        tokenExpiry: 24 * 60 * 60 * 1000, // 24 hours
        maxFailedAttempts: 5,
        lockoutDuration: 30 * 60 * 1000, // 30 minutes
      },
      
      // Input validation rules
      validation: {
        maxStringLength: 1000,
        maxNumberValue: Number.MAX_SAFE_INTEGER,
        allowedOrderSides: ['buy', 'sell'],
        allowedOrderTypes: ['market', 'limit'],
        allowedTradingPairs: ['SOL/USDC', 'BTC/USDC', 'ETH/USDC'],
      }
    };
  }

  // Helmet configuration for security headers
  getHelmetConfig() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "ws:", "wss:"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable for WebSocket compatibility
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });
  }

  // General rate limiting middleware
  getRateLimiter() {
    return rateLimit({
      ...this.config.rateLimit,
      store: {
        incr: (key, callback) => {
          const now = Date.now();
          const windowStart = now - this.config.rateLimit.windowMs;
          
          if (!this.rateLimitStore.has(key)) {
            this.rateLimitStore.set(key, []);
          }
          
          const requests = this.rateLimitStore.get(key);
          const validRequests = requests.filter(time => time > windowStart);
          validRequests.push(now);
          
          this.rateLimitStore.set(key, validRequests);
          
          callback(null, validRequests.length, new Date(now + this.config.rateLimit.windowMs));
        },
        
        decrement: (key) => {
          // No-op for this implementation
        },
        
        resetKey: (key) => {
          this.rateLimitStore.delete(key);
        }
      }
    });
  }

  // Strict rate limiting for sensitive endpoints
  getStrictRateLimiter() {
    return rateLimit(this.config.strictRateLimit);
  }

  // Input sanitization and validation middleware
  validateAndSanitize() {
    return (req, res, next) => {
      try {
        // Sanitize string inputs
        this.sanitizeObject(req.body);
        this.sanitizeObject(req.query);
        this.sanitizeObject(req.params);
        
        // Validate inputs based on endpoint
        const validationResult = this.validateRequest(req);
        if (!validationResult.isValid) {
          return res.status(400).json({
            success: false,
            error: 'Invalid input',
            details: validationResult.errors
          });
        }
        
        next();
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Input validation failed',
          message: error.message
        });
      }
    };
  }

  // Recursive object sanitization
  sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // XSS protection
        obj[key] = xss(obj[key]);
        // SQL injection protection (basic)
        obj[key] = obj[key].replace(/['"\\;]/g, '');
        // Length validation
        if (obj[key].length > this.config.validation.maxStringLength) {
          obj[key] = obj[key].substring(0, this.config.validation.maxStringLength);
        }
      } else if (typeof obj[key] === 'object') {
        this.sanitizeObject(obj[key]);
      }
    }
  }

  // Request validation based on endpoint and method
  validateRequest(req) {
    const errors = [];
    const { method, path, body, query, params } = req;
    
    // Order validation
    if (path.includes('/orders') && method === 'POST') {
      if (!body.pair || !this.config.validation.allowedTradingPairs.includes(body.pair)) {
        errors.push('Invalid trading pair');
      }
      
      if (!body.side || !this.config.validation.allowedOrderSides.includes(body.side)) {
        errors.push('Invalid order side');
      }
      
      if (!body.type || !this.config.validation.allowedOrderTypes.includes(body.type)) {
        errors.push('Invalid order type');
      }
      
      if (!body.amount || !customValidator.isFloat(body.amount.toString(), { min: 0.0001 })) {
        errors.push('Invalid order amount');
      }
      
      if (body.type === 'limit' && (!body.price || !customValidator.isFloat(body.price.toString(), { min: 0.0001 }))) {
        errors.push('Invalid limit price');
      }
    }
    
    // Crypto operation validation
    if (path.includes('/crypto/')) {
      if (body.value && (!customValidator.isFloat(body.value.toString()) || body.value < 0)) {
        errors.push('Invalid crypto value');
      }
    }
    
    // Pagination validation
    if (query.limit && (!customValidator.isInt(query.limit.toString(), { min: 1, max: 1000 }))) {
      errors.push('Invalid limit parameter');
    }
    
    if (query.offset && (!customValidator.isInt(query.offset.toString(), { min: 0 }))) {
      errors.push('Invalid offset parameter');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Authentication middleware
  authenticateRequest() {
    return (req, res, next) => {
      const authHeader = req.headers.authorization;
      const apiKey = req.headers['x-api-key'];
      
      // Skip authentication for public endpoints
      if (this.isPublicEndpoint(req.path)) {
        return next();
      }
      
      // Check API key authentication
      if (apiKey && this.validateApiKey(apiKey)) {
        req.auth = { type: 'api-key', key: apiKey };
        return next();
      }
      
      // Check bearer token authentication
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const tokenData = this.validateAuthToken(token);
        
        if (tokenData) {
          req.auth = { type: 'bearer', token, data: tokenData };
          return next();
        }
      }
      
      // Authentication failed
      this.recordFailedAuthentication(req.ip);
      
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Valid API key or bearer token required'
      });
    };
  }

  // Check if endpoint is public (doesn't require authentication)
  isPublicEndpoint(path) {
    const publicPaths = [
      '/api/health',
      '/api/trading/pairs',
      '/api/trading/orderbook',
      '/ws'
    ];
    
    return publicPaths.some(publicPath => path.startsWith(publicPath));
  }

  // Validate API key
  validateApiKey(apiKey) {
    // In production, this would check against a database
    const validApiKeys = new Set([
      'pk_test_phantom_pool_development',
      'pk_live_phantom_pool_production'
    ]);
    
    return validApiKeys.has(apiKey);
  }

  // Validate authentication token
  validateAuthToken(token) {
    const tokenData = this.authTokens.get(token);
    
    if (!tokenData) {
      return null;
    }
    
    // Check if token is expired
    if (Date.now() > tokenData.expiresAt) {
      this.authTokens.delete(token);
      return null;
    }
    
    return tokenData;
  }

  // Generate authentication token
  generateAuthToken(userId, permissions = []) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + this.config.auth.tokenExpiry;
    
    const tokenData = {
      userId,
      permissions,
      createdAt: Date.now(),
      expiresAt,
      lastUsed: Date.now()
    };
    
    this.authTokens.set(token, tokenData);
    
    return {
      token,
      expiresAt,
      expiresIn: this.config.auth.tokenExpiry
    };
  }

  // Record failed authentication attempt
  recordFailedAuthentication(ip) {
    const key = `failed_auth_${ip}`;
    const attempts = this.suspiciousActivities.get(key) || { count: 0, firstAttempt: Date.now() };
    
    attempts.count++;
    attempts.lastAttempt = Date.now();
    
    this.suspiciousActivities.set(key, attempts);
    
    // Check if IP should be blocked
    if (attempts.count >= this.config.auth.maxFailedAttempts) {
      this.blockIP(ip, 'Too many failed authentication attempts');
    }
  }

  // Block IP address
  blockIP(ip, reason) {
    this.blockedIPs.add(ip);
    console.warn(`🚫 Blocked IP ${ip} - Reason: ${reason}`);
    
    // Auto-unblock after lockout duration
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      console.info(`🔓 Unblocked IP ${ip} after lockout period`);
    }, this.config.auth.lockoutDuration);
  }

  // IP blocking middleware
  blockBadActors() {
    return (req, res, next) => {
      const clientIP = req.ip || req.connection.remoteAddress;
      
      if (this.blockedIPs.has(clientIP)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Your IP address has been temporarily blocked'
        });
      }
      
      next();
    };
  }

  // Security logging middleware
  logSecurityEvents() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        const clientIP = req.ip || req.connection.remoteAddress;
        
        // Log suspicious activity
        if (res.statusCode === 401 || res.statusCode === 403) {
          console.warn(`🚨 Security Event: ${res.statusCode} from ${clientIP} on ${req.method} ${req.path}`);
        }
        
        // Log slow requests (potential DoS)
        if (duration > 5000) {
          console.warn(`⏱️ Slow Request: ${duration}ms from ${clientIP} on ${req.method} ${req.path}`);
        }
        
        // Log large requests (potential abuse)
        if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 1024 * 1024) {
          console.warn(`📦 Large Request: ${req.headers['content-length']} bytes from ${clientIP}`);
        }
      });
      
      next();
    };
  }

  // CORS configuration
  getCorsConfig() {
    return {
      origin: process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : 
        ['http://localhost:3000', 'https://phantom-pool.vercel.app'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      credentials: true,
      maxAge: 86400 // 24 hours
    };
  }

  // Get security status
  getSecurityStatus() {
    return {
      blockedIPs: Array.from(this.blockedIPs),
      activeTokens: this.authTokens.size,
      suspiciousActivities: this.suspiciousActivities.size,
      rateLimitHits: this.rateLimitStore.size,
      timestamp: new Date().toISOString()
    };
  }

  // Clean up expired data
  cleanup() {
    const now = Date.now();
    
    // Clean expired auth tokens
    for (const [token, data] of this.authTokens.entries()) {
      if (now > data.expiresAt) {
        this.authTokens.delete(token);
      }
    }
    
    // Clean old suspicious activity records
    for (const [key, data] of this.suspiciousActivities.entries()) {
      if (now - data.firstAttempt > 24 * 60 * 60 * 1000) { // 24 hours
        this.suspiciousActivities.delete(key);
      }
    }
    
    // Clean rate limit data
    const windowStart = now - this.config.rateLimit.windowMs;
    for (const [key, requests] of this.rateLimitStore.entries()) {
      const validRequests = requests.filter(time => time > windowStart);
      if (validRequests.length === 0) {
        this.rateLimitStore.delete(key);
      } else {
        this.rateLimitStore.set(key, validRequests);
      }
    }
  }
}

// Singleton instance
let securityServiceInstance = null;

function getSecurityService() {
  if (!securityServiceInstance) {
    securityServiceInstance = new PhantomPoolSecurityService();
    
    // Run cleanup every hour
    setInterval(() => {
      securityServiceInstance.cleanup();
    }, 60 * 60 * 1000);
  }
  
  return securityServiceInstance;
}

module.exports = {
  PhantomPoolSecurityService,
  getSecurityService
};
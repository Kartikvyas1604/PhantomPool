/**
 * Error Handling Middleware
 * Centralized error handling for PhantomPool API
 */

import { Request, Response, NextFunction } from 'express';

interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * Custom error class for API errors
 */
export class PhantomPoolError extends Error implements ApiError {
  public statusCode: number;
  public code: string;
  public details?: any;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'PhantomPoolError';
    this.statusCode = statusCode;
    this.code = code || 'INTERNAL_ERROR';
    this.details = details;
  }
}

/**
 * Error handling middleware
 */
export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error details
  console.error('API Error:', {
    message: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
    code: error.code,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  // Determine status code
  const statusCode = error.statusCode || 500;

  // Determine if we should expose error details
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Base error response
  const errorResponse: any = {
    error: true,
    message: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
  };

  // Add details in development or for client errors (4xx)
  if (!isProduction || (statusCode >= 400 && statusCode < 500)) {
    if (error.details) {
      errorResponse.details = error.details;
    }
  }

  // Add stack trace in development
  if (!isProduction) {
    errorResponse.stack = error.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Not found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: true,
    message: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Validation error handler
 */
export const handleValidationError = (
  field: string,
  message: string,
  value?: any
): PhantomPoolError => {
  return new PhantomPoolError(
    `Validation error: ${message}`,
    400,
    'VALIDATION_ERROR',
    { field, value, message }
  );
};

/**
 * Database error handler
 */
export const handleDatabaseError = (error: any): PhantomPoolError => {
  console.error('Database error:', error);

  // Supabase/PostgreSQL specific errors
  if (error.code) {
    switch (error.code) {
      case '23505': // Unique constraint violation
        return new PhantomPoolError(
          'Duplicate entry',
          409,
          'DUPLICATE_ENTRY',
          { constraint: error.constraint }
        );
      
      case '23503': // Foreign key violation
        return new PhantomPoolError(
          'Invalid reference',
          400,
          'INVALID_REFERENCE',
          { constraint: error.constraint }
        );
      
      case '23514': // Check constraint violation
        return new PhantomPoolError(
          'Invalid value',
          400,
          'INVALID_VALUE',
          { constraint: error.constraint }
        );
      
      default:
        return new PhantomPoolError(
          'Database operation failed',
          500,
          'DATABASE_ERROR',
          { code: error.code }
        );
    }
  }

  return new PhantomPoolError(
    'Database error',
    500,
    'DATABASE_ERROR',
    { originalError: error.message }
  );
};

/**
 * Cryptographic operation error handler
 */
export const handleCryptoError = (error: any): PhantomPoolError => {
  console.error('Crypto error:', error);

  return new PhantomPoolError(
    'Cryptographic operation failed',
    500,
    'CRYPTO_ERROR',
    { originalError: error.message }
  );
};

/**
 * Rate limit error handler
 */
export const handleRateLimitError = (): PhantomPoolError => {
  return new PhantomPoolError(
    'Too many requests',
    429,
    'RATE_LIMIT_EXCEEDED',
    { retryAfter: 60 }
  );
};

/**
 * Authentication error handler
 */
export const handleAuthError = (message: string): PhantomPoolError => {
  return new PhantomPoolError(
    message,
    401,
    'AUTHENTICATION_ERROR'
  );
};

/**
 * Authorization error handler
 */
export const handleAuthorizationError = (resource: string): PhantomPoolError => {
  return new PhantomPoolError(
    `Access denied to ${resource}`,
    403,
    'AUTHORIZATION_ERROR',
    { resource }
  );
};
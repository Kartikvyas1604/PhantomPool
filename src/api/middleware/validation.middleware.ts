/**
 * Validation Middleware
 * Request validation for PhantomPool API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { PhantomPoolError } from './error.middleware';

interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: string[];
  custom?: (value: any) => boolean | string;
}

/**
 * Validate request data against rules
 */
export const validate = (rules: ValidationRule[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Array<{ field: string; message: string }> = [];
    const data = { ...req.body, ...req.query, ...req.params };

    for (const rule of rules) {
      const value = data[rule.field];
      const fieldError = validateField(rule, value);
      
      if (fieldError) {
        errors.push({ field: rule.field, message: fieldError });
      }
    }

    if (errors.length > 0) {
      const error = new PhantomPoolError(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors }
      );
      next(error);
      return;
    }

    next();
  };
};

/**
 * Validate individual field
 */
function validateField(rule: ValidationRule, value: any): string | null {
  // Check if required field is missing
  if (rule.required && (value === undefined || value === null || value === '')) {
    return `${rule.field} is required`;
  }

  // Skip validation if field is optional and not provided
  if (!rule.required && (value === undefined || value === null)) {
    return null;
  }

  // Type validation
  if (rule.type && !validateType(value, rule.type)) {
    return `${rule.field} must be of type ${rule.type}`;
  }

  // String validations
  if (rule.type === 'string' && typeof value === 'string') {
    if (rule.minLength && value.length < rule.minLength) {
      return `${rule.field} must be at least ${rule.minLength} characters`;
    }
    
    if (rule.maxLength && value.length > rule.maxLength) {
      return `${rule.field} must not exceed ${rule.maxLength} characters`;
    }
    
    if (rule.pattern && !rule.pattern.test(value)) {
      return `${rule.field} format is invalid`;
    }
  }

  // Number validations
  if (rule.type === 'number' && typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return `${rule.field} must be at least ${rule.min}`;
    }
    
    if (rule.max !== undefined && value > rule.max) {
      return `${rule.field} must not exceed ${rule.max}`;
    }
  }

  // Enum validation
  if (rule.enum && !rule.enum.includes(value)) {
    return `${rule.field} must be one of: ${rule.enum.join(', ')}`;
  }

  // Custom validation
  if (rule.custom) {
    const customResult = rule.custom(value);
    if (typeof customResult === 'string') {
      return customResult;
    }
    if (customResult === false) {
      return `${rule.field} is invalid`;
    }
  }

  return null;
}

/**
 * Validate value type
 */
function validateType(value: any, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return true;
  }
}

/**
 * Common validation rules
 */
export const ValidationRules = {
  // User validation
  userId: {
    field: 'user_id',
    required: true,
    type: 'string' as const,
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  },

  walletAddress: {
    field: 'wallet_address',
    required: true,
    type: 'string' as const,
    minLength: 32,
    maxLength: 44,
    pattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  },

  // Order validation
  tradingPairId: {
    field: 'trading_pair_id',
    required: true,
    type: 'string' as const,
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  },

  orderType: {
    field: 'order_type',
    required: true,
    type: 'string' as const,
    enum: ['market', 'limit'],
  },

  orderSide: {
    field: 'side',
    required: true,
    type: 'string' as const,
    enum: ['buy', 'sell'],
  },

  encryptedAmount: {
    field: 'encrypted_amount',
    required: true,
    type: 'string' as const,
    minLength: 10,
  },

  encryptedPrice: {
    field: 'encrypted_price',
    required: true,
    type: 'string' as const,
    minLength: 10,
  },

  solvencyProof: {
    field: 'solvency_proof',
    required: true,
    type: 'object' as const,
    custom: (value: any) => {
      if (!value.commitment || !value.proof || !value.auditToken) {
        return 'Solvency proof must contain commitment, proof, and auditToken';
      }
      return true;
    },
  },

  signature: {
    field: 'signature_proof',
    required: true,
    type: 'string' as const,
    minLength: 64,
  },

  nonce: {
    field: 'nonce',
    required: true,
    type: 'string' as const,
    minLength: 16,
    maxLength: 64,
  },

  // Pagination
  limit: {
    field: 'limit',
    required: false,
    type: 'number' as const,
    min: 1,
    max: 100,
  },

  offset: {
    field: 'offset',
    required: false,
    type: 'number' as const,
    min: 0,
  },

  // Crypto proof validation
  zkProof: {
    field: 'zk_proof',
    required: false,
    type: 'object' as const,
    custom: (value: any) => {
      if (value && (!value.proof || !value.publicInputs)) {
        return 'ZK proof must contain proof and publicInputs';
      }
      return true;
    },
  },

  // Amount validation (for display purposes)
  amount: {
    field: 'amount',
    required: false,
    type: 'number' as const,
    min: 0,
  },

  price: {
    field: 'price',
    required: false,
    type: 'number' as const,
    min: 0,
  },

  // Time validation
  timestamp: {
    field: 'timestamp',
    required: false,
    type: 'number' as const,
    min: 0,
  },

  expiryTime: {
    field: 'expiry_time',
    required: false,
    type: 'string' as const,
    custom: (value: string) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return 'Invalid date format';
      }
      if (date <= new Date()) {
        return 'Expiry time must be in the future';
      }
      return true;
    },
  },
};

/**
 * Validate order submission
 */
export const validateOrderSubmission = validate([
  ValidationRules.tradingPairId,
  ValidationRules.orderType,
  ValidationRules.orderSide,
  ValidationRules.encryptedAmount,
  ValidationRules.encryptedPrice,
  ValidationRules.solvencyProof,
  ValidationRules.signature,
  ValidationRules.nonce,
  ValidationRules.expiryTime,
]);

/**
 * Validate user authentication
 */
export const validateUserAuth = validate([
  ValidationRules.walletAddress,
  {
    field: 'signature',
    required: true,
    type: 'string',
    minLength: 64,
  },
  {
    field: 'message',
    required: true,
    type: 'string',
    minLength: 10,
  },
]);

/**
 * Validate pagination parameters
 */
export const validatePagination = validate([
  ValidationRules.limit,
  ValidationRules.offset,
]);

/**
 * Validate UUID parameter
 */
export const validateUUID = (paramName: string) => validate([
  {
    field: paramName,
    required: true,
    type: 'string',
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  },
]);

/**
 * Validate trading pair creation
 */
export const validateTradingPair = validate([
  {
    field: 'base_token',
    required: true,
    type: 'string',
    minLength: 32,
    maxLength: 44,
  },
  {
    field: 'quote_token',
    required: true,
    type: 'string',
    minLength: 32,
    maxLength: 44,
  },
  {
    field: 'base_token_name',
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 20,
  },
  {
    field: 'quote_token_name',
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 20,
  },
]);

/**
 * Custom validation for crypto operations
 */
export const validateCryptoProof = (proofType: string) => validate([
  {
    field: 'proof_type',
    required: true,
    type: 'string',
    enum: ['solvency', 'range', 'matching', 'vrf', 'execution', 'shuffle'],
  },
  {
    field: 'proof_data',
    required: true,
    type: 'object',
    custom: (value: any) => {
      if (!value.proof || !value.publicInputs) {
        return 'Proof data must contain proof and publicInputs';
      }
      return true;
    },
  },
]);

export const validationMiddleware = {
  validate,
  validateOrderSubmission,
  validateUserAuth,
  validatePagination,
  validateUUID,
  validateTradingPair,
  validateCryptoProof,
};
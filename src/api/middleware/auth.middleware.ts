/**
 * Authentication Middleware
 * Handles JWT token validation and user authentication
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { DatabaseService } from '../services/database.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    wallet_address: string;
    auth_user_id: string;
    trading_tier: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-here';

/**
 * Middleware to authenticate requests using JWT
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Get user from database
      const db = new DatabaseService();
      const user = await db.getUserByWallet(decoded.wallet_address);
      
      if (!user || !user.is_active) {
        res.status(401).json({
          error: 'Invalid user',
          message: 'User not found or inactive',
        });
        return;
      }

      // Attach user to request
      req.user = {
        id: user.id,
        wallet_address: user.wallet_address,
        auth_user_id: user.auth_user_id,
        trading_tier: user.trading_tier,
      };

      next();
    } catch (jwtError) {
      res.status(401).json({
        error: 'Invalid token',
        message: 'Token verification failed',
      });
      return;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Internal server error during authentication',
    });
  }
};

/**
 * Middleware to check if user has required trading tier
 */
export const requireTradingTier = (minTier: 'basic' | 'premium' | 'institutional') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
      });
      return;
    }

    const tierLevels = {
      basic: 1,
      premium: 2,
      institutional: 3,
    };

    const userTierLevel = tierLevels[req.user.trading_tier as keyof typeof tierLevels] || 0;
    const requiredLevel = tierLevels[minTier];

    if (userTierLevel < requiredLevel) {
      res.status(403).json({
        error: 'Insufficient trading tier',
        message: `${minTier} tier or higher required`,
        current_tier: req.user.trading_tier,
        required_tier: minTier,
      });
      return;
    }

    next();
  };
};

/**
 * Generate JWT token for user
 */
export const generateAuthToken = (user: {
  id: string;
  wallet_address: string;
  auth_user_id: string;
}): string => {
  return jwt.sign(
    {
      user_id: user.id,
      wallet_address: user.wallet_address,
      auth_user_id: user.auth_user_id,
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    {
      expiresIn: '24h',
      issuer: 'phantompool',
      audience: 'phantompool-users',
    }
  );
};

/**
 * Verify wallet signature for authentication
 */
export const verifyWalletSignature = (
  message: string,
  signature: string,
  publicKey: string
): boolean => {
  try {
    // In production: implement proper Solana signature verification
    // This is a simplified version for development
    const expectedMessage = `PhantomPool Login: ${message}`;
    
    // Mock verification - replace with actual Solana signature verification
    return signature.length > 0 && publicKey.length > 0;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
};

export { AuthenticatedRequest };
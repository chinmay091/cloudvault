import { Request, Response, NextFunction } from 'express';
import { validateApiKey } from '../services/auth.service.js';

// Extend Express Request to include auth context
declare global {
  namespace Express {
    interface Request {
      auth?: {
        organizationId: string;
        apiKeyId: string;
        permissions: string[];
        organizationName: string;
      };
      correlationId?: string;
    }
  }
}

/**
 * Authentication Middleware
 * Validates X-API-Key header and attaches auth context to request
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'API key required. Provide X-API-Key header.',
        },
      });
      return;
    }
    
    const validatedKey = await validateApiKey(apiKey);
    
    if (!validatedKey) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Invalid or expired API key.',
        },
      });
      return;
    }
    
    // Attach auth context to request
    req.auth = {
      organizationId: validatedKey.organizationId,
      apiKeyId: validatedKey.id,
      permissions: validatedKey.permissions,
      organizationName: validatedKey.organization.name,
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed.',
      },
    });
  }
}

/**
 * Permission checking middleware factory
 * Usage: requirePermission('upload')
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Not authenticated.',
        },
      });
      return;
    }
    
    if (!req.auth.permissions.includes(permission) && !req.auth.permissions.includes('admin')) {
      res.status(403).json({
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: `Permission '${permission}' required.`,
        },
      });
      return;
    }
    
    next();
  };
}

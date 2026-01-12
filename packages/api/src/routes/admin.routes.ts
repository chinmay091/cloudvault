import { Router, Request, Response, NextFunction } from 'express';
import { createOrganization, createApiKey } from '../services/auth.service.js';
import { authMiddleware, requirePermission } from '../middlewares/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export const adminRoutes = Router();

/**
 * POST /api/v1/admin/organizations
 * Create a new organization with an API key
 * Note: In production, this should be protected or disabled
 */
adminRoutes.post(
  '/organizations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body;
      
      if (!name || typeof name !== 'string' || name.length < 2) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Organization name is required (min 2 characters)',
          },
        });
        return;
      }
      
      const result = await createOrganization(name);
      
      res.status(201).json({
        organization: {
          id: result.organization.id,
          name: result.organization.name,
          createdAt: result.organization.createdAt,
        },
        apiKey: {
          id: result.apiKey.id,
          key: result.apiKey.key, // Full key - only shown once!
          prefix: result.apiKey.prefix,
          name: result.apiKey.name,
          permissions: result.apiKey.permissions,
        },
        warning: 'Save this API key now! It will not be shown again.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/admin/api-keys
 * Create a new API key for the authenticated organization
 */
adminRoutes.post(
  '/api-keys',
  authMiddleware,
  requirePermission('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, permissions, expiresAt } = req.body;
      
      if (!name || typeof name !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'API key name is required',
          },
        });
        return;
      }
      
      const validPermissions = ['upload', 'read', 'delete', 'admin'];
      const perms = Array.isArray(permissions) 
        ? permissions.filter(p => validPermissions.includes(p))
        : ['read'];
      
      const apiKey = await createApiKey({
        organizationId: req.auth!.organizationId,
        name,
        permissions: perms,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });
      
      res.status(201).json({
        apiKey: {
          id: apiKey.id,
          key: apiKey.key, // Full key - only shown once!
          prefix: apiKey.prefix,
          name: apiKey.name,
          permissions: apiKey.permissions,
          expiresAt: apiKey.expiresAt,
        },
        warning: 'Save this API key now! It will not be shown again.',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/admin/api-keys
 * List API keys for the authenticated organization
 */
adminRoutes.get(
  '/api-keys',
  authMiddleware,
  requirePermission('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiKeys = await prisma.apiKey.findMany({
        where: { organizationId: req.auth!.organizationId },
        select: {
          id: true,
          keyPrefix: true,
          name: true,
          permissions: true,
          expiresAt: true,
          lastUsedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      
      res.json({ data: apiKeys });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/admin/api-keys/:id
 * Revoke an API key
 */
adminRoutes.delete(
  '/api-keys/:id',
  authMiddleware,
  requirePermission('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      // Prevent deleting own key
      if (id === req.auth!.apiKeyId) {
        res.status(400).json({
          error: {
            code: 'INVALID_OPERATION',
            message: 'Cannot delete the API key currently in use',
          },
        });
        return;
      }
      
      const apiKey = await prisma.apiKey.findFirst({
        where: { id, organizationId: req.auth!.organizationId },
      });
      
      if (!apiKey) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'API key not found',
          },
        });
        return;
      }
      
      await prisma.apiKey.delete({ where: { id } });
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

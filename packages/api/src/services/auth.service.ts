import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

/**
 * Auth Service
 * Handles API key generation, validation, and management
 */

// Generate a secure random API key
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  // Generate 32 random bytes = 64 hex characters
  const key = `cv_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = key.substring(0, 11); // cv_ + first 8 chars
  const hash = hashApiKey(key);
  
  return { key, prefix, hash };
}

// Hash an API key for storage (using SHA-256)
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Validate an API key and return the associated data
export async function validateApiKey(key: string) {
  if (!key || !key.startsWith('cv_')) {
    return null;
  }
  
  const hash = hashApiKey(key);
  
  const apiKey = await prisma.apiKey.findFirst({
    where: { hashedKey: hash },
    include: { organization: true },
  });
  
  if (!apiKey) {
    return null;
  }
  
  // Check if expired
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }
  
  // Update last used timestamp (fire and forget)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {}); // Ignore errors
  
  return apiKey;
}

// Create a new API key for an organization
export async function createApiKey(params: {
  organizationId: string;
  name: string;
  permissions: string[];
  expiresAt?: Date;
}) {
  const { key, prefix, hash } = generateApiKey();
  
  const apiKey = await prisma.apiKey.create({
    data: {
      keyPrefix: prefix,
      hashedKey: hash,
      name: params.name,
      organizationId: params.organizationId,
      permissions: params.permissions,
      expiresAt: params.expiresAt,
    },
  });
  
  // Return the full key only once (it won't be retrievable later)
  return {
    id: apiKey.id,
    key, // Full key - show to user once
    prefix: apiKey.keyPrefix,
    name: apiKey.name,
    permissions: apiKey.permissions,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
  };
}

// Create a new organization with an initial API key
export async function createOrganization(name: string) {
  const org = await prisma.organization.create({
    data: { name },
  });
  
  // Create initial admin API key
  const apiKey = await createApiKey({
    organizationId: org.id,
    name: 'Default Admin Key',
    permissions: ['upload', 'read', 'delete', 'admin'],
  });
  
  return { organization: org, apiKey };
}

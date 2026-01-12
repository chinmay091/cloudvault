import { prisma } from '../lib/prisma.js';

/**
 * Audit Service
 * Creates immutable audit log entries for all file operations
 */

export interface AuditLogParams {
  fileId?: string;
  organizationId: string;
  action: string;
  actor: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  correlationId?: string;
}

// Audit action constants
export const AuditActions = {
  UPLOAD_REQUESTED: 'upload_requested',
  UPLOADED: 'uploaded',
  DOWNLOAD_REQUESTED: 'download_requested',
  PROCESSED: 'processed',
  PROCESSING_FAILED: 'processing_failed',
  DELETED: 'deleted',
  ACCESSED: 'accessed',
  API_KEY_CREATED: 'api_key_created',
  API_KEY_REVOKED: 'api_key_revoked',
} as const;

/**
 * Create an audit log entry
 * This is fire-and-forget to avoid blocking the main request
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        fileId: params.fileId,
        organizationId: params.organizationId,
        action: params.action,
        actor: params.actor,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        details: params.details as object | undefined,
        correlationId: params.correlationId,
      },
    });
  } catch (error) {
    // Log but don't throw - audit failures shouldn't break the main flow
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Get audit logs for a file
 */
export async function getFileAuditLogs(fileId: string, organizationId: string) {
  return prisma.auditLog.findMany({
    where: { fileId, organizationId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

/**
 * Get recent audit logs for an organization
 */
export async function getOrganizationAuditLogs(
  organizationId: string,
  options?: { limit?: number; action?: string }
) {
  return prisma.auditLog.findMany({
    where: {
      organizationId,
      ...(options?.action && { action: options.action }),
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 50,
  });
}

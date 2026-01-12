import { prisma } from '../lib/prisma.js';
import { FileStatus, Prisma } from '../../generated/prisma/index.js';
import { createAuditLog, AuditActions } from './audit.service.js';

/**
 * File Service
 * Handles file metadata operations
 */

export interface CreateFileParams {
  organizationId: string;
  bucket: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Create a new file record (status: PENDING_UPLOAD)
 */
export async function createFileRecord(params: CreateFileParams) {
  const file = await prisma.file.create({
    data: {
      organizationId: params.organizationId,
      bucket: params.bucket,
      key: params.key,
      originalName: params.originalName,
      mimeType: params.mimeType,
      size: BigInt(params.size),
      uploadedBy: params.uploadedBy,
      tags: params.tags ?? [],
      metadata: params.metadata as Prisma.InputJsonValue ?? undefined,
      status: FileStatus.PENDING_UPLOAD,
    },
  });
  
  return file;
}

/**
 * Get a file by ID
 */
export async function getFileById(fileId: string, organizationId: string) {
  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      organizationId,
      status: { not: FileStatus.DELETED },
    },
  });
  
  return file;
}

/**
 * List files for an organization with pagination
 */
export async function listFiles(
  organizationId: string,
  options?: {
    page?: number;
    pageSize?: number;
    status?: FileStatus;
  }
) {
  const page = options?.page ?? 1;
  const pageSize = Math.min(options?.pageSize ?? 20, 100);
  const skip = (page - 1) * pageSize;
  
  const where = {
    organizationId,
    status: options?.status ?? { not: FileStatus.DELETED },
  };
  
  const [files, total] = await Promise.all([
    prisma.file.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.file.count({ where }),
  ]);
  
  return {
    data: files.map(serializeFile),
    pagination: {
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Update file status
 */
export async function updateFileStatus(
  fileId: string,
  organizationId: string,
  status: FileStatus,
  processingState?: Record<string, unknown>
) {
  return prisma.file.update({
    where: { id: fileId },
    data: {
      status,
      ...(processingState && { processingState: processingState as Prisma.InputJsonValue }),
    },
  });
}

/**
 * Mark file as uploaded (called after S3 upload confirmation)
 */
export async function markFileUploaded(fileId: string, organizationId: string) {
  return updateFileStatus(fileId, organizationId, FileStatus.UPLOADED);
}

/**
 * Soft delete a file
 */
export async function softDeleteFile(
  fileId: string,
  organizationId: string,
  actor: string,
  correlationId?: string
) {
  const file = await prisma.file.update({
    where: { id: fileId },
    data: { status: FileStatus.DELETED },
  });
  
  // Create audit log
  await createAuditLog({
    fileId,
    organizationId,
    action: AuditActions.DELETED,
    actor,
    correlationId,
  });
  
  return file;
}

/**
 * Update file metadata after processing
 */
export async function updateFileMetadata(
  fileId: string,
  metadata: Record<string, unknown>,
  checksum?: string
) {
  return prisma.file.update({
    where: { id: fileId },
    data: {
      metadata: metadata as Prisma.InputJsonValue,
      ...(checksum && { checksum }),
      status: FileStatus.PROCESSED,
    },
  });
}

/**
 * Serialize file for API response (handle BigInt)
 */
export function serializeFile(file: {
  id: string;
  organizationId: string;
  bucket: string;
  key: string;
  originalName: string;
  mimeType: string;
  size: bigint;
  checksum: string | null;
  status: FileStatus;
  processingState: unknown;
  metadata: unknown;
  tags: string[];
  uploadedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: Number(file.size),
    checksum: file.checksum,
    status: file.status,
    metadata: file.metadata,
    tags: file.tags,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  };
}

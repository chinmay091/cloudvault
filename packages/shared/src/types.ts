/**
 * Shared types used across CloudVault packages
 */

export enum FileStatus {
  PENDING_UPLOAD = 'PENDING_UPLOAD',
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  DELETED = 'DELETED',
}

export enum AuditAction {
  UPLOAD_REQUESTED = 'upload_requested',
  UPLOADED = 'uploaded',
  DOWNLOAD_REQUESTED = 'download_requested',
  PROCESSED = 'processed',
  PROCESSING_FAILED = 'processing_failed',
  DELETED = 'deleted',
}

export enum Permission {
  UPLOAD = 'upload',
  READ = 'read',
  DELETE = 'delete',
  ADMIN = 'admin',
}

export interface RequestContext {
  organizationId: string;
  apiKeyId: string;
  permissions: Permission[];
  correlationId: string;
}

export interface UploadRequest {
  filename: string;
  contentType: string;
  size: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface UploadResponse {
  fileId: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

import { Router, Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import { authMiddleware, requirePermission } from '../middlewares/auth.middleware.js';
import { uploadRequestSchema, listFilesQuerySchema } from '../validators/file.validators.js';
import * as fileService from '../services/file.service.js';
import * as storageService from '../services/storage.service.js';
import * as queueService from '../services/queue.service.js';
import { createAuditLog, AuditActions } from '../services/audit.service.js';

export const fileRoutes = Router();

// All file routes require authentication
fileRoutes.use(authMiddleware);

/**
 * POST /api/v1/files/upload-url
 * Request a pre-signed URL for file upload
 */
fileRoutes.post(
  '/upload-url',
  requirePermission('upload'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = uploadRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validation.error.errors,
          },
        });
        return;
      }
      
      const { filename, contentType, size, tags, metadata } = validation.data;
      const { organizationId, apiKeyId } = req.auth!;
      
      // Generate unique S3 key
      const fileId = nanoid();
      const s3Key = `${organizationId}/${fileId}/${filename}`;
      
      // Create file record in database
      const file = await fileService.createFileRecord({
        organizationId,
        bucket: process.env.S3_BUCKET || 'cloudvault-files',
        key: s3Key,
        originalName: filename,
        mimeType: contentType,
        size,
        uploadedBy: apiKeyId,
        tags,
        metadata,
      });
      
      // Create audit log
      await createAuditLog({
        fileId: file.id,
        organizationId,
        action: AuditActions.UPLOAD_REQUESTED,
        actor: apiKeyId,
        correlationId: req.correlationId,
        details: { filename, contentType, size },
      });
      
      // Generate pre-signed URL from S3
      const { url: uploadUrl, expiresAt } = await storageService.generateUploadUrl({
        key: s3Key,
        contentType,
        contentLength: size,
      });
      
      res.status(201).json({
        fileId: file.id,
        uploadUrl,
        key: s3Key,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/files
 * List files for the organization
 */
fileRoutes.get(
  '/',
  requirePermission('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = listFilesQuerySchema.safeParse(req.query);
      
      if (!validation.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: validation.error.errors,
          },
        });
        return;
      }
      
      const { organizationId } = req.auth!;
      const result = await fileService.listFiles(organizationId, validation.data);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/files/:id
 * Get a single file's metadata
 */
fileRoutes.get(
  '/:id',
  requirePermission('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, apiKeyId } = req.auth!;
      const file = await fileService.getFileById(req.params.id, organizationId);
      
      if (!file) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'File not found',
          },
        });
        return;
      }
      
      // Log access
      await createAuditLog({
        fileId: file.id,
        organizationId,
        action: AuditActions.ACCESSED,
        actor: apiKeyId,
        correlationId: req.correlationId,
      });
      
      res.json({ data: fileService.serializeFile(file) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/files/:id/download-url
 * Get a pre-signed URL for downloading a file
 */
fileRoutes.get(
  '/:id/download-url',
  requirePermission('read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, apiKeyId } = req.auth!;
      const file = await fileService.getFileById(req.params.id, organizationId);
      
      if (!file) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'File not found',
          },
        });
        return;
      }
      
      if (file.status !== 'PROCESSED' && file.status !== 'UPLOADED') {
        res.status(400).json({
          error: {
            code: 'INVALID_STATE',
            message: `File is not ready for download (status: ${file.status})`,
          },
        });
        return;
      }
      
      // Generate download URL
      const { url: downloadUrl, expiresAt } = await storageService.generateDownloadUrl({
        key: file.key,
        filename: file.originalName,
      });
      
      // Log download request
      await createAuditLog({
        fileId: file.id,
        organizationId,
        action: AuditActions.DOWNLOAD_REQUESTED,
        actor: apiKeyId,
        correlationId: req.correlationId,
      });
      
      res.json({
        downloadUrl,
        expiresAt: expiresAt.toISOString(),
        filename: file.originalName,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/files/:id
 * Soft delete a file
 */
fileRoutes.delete(
  '/:id',
  requirePermission('delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, apiKeyId } = req.auth!;
      const file = await fileService.getFileById(req.params.id, organizationId);
      
      if (!file) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'File not found',
          },
        });
        return;
      }
      
      await fileService.softDeleteFile(file.id, organizationId, apiKeyId, req.correlationId);
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/files/:id/confirm-upload
 * Confirm that a file has been uploaded (temporary endpoint until S3 events are set up)
 */
fileRoutes.post(
  '/:id/confirm-upload',
  requirePermission('upload'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { organizationId, apiKeyId } = req.auth!;
      const file = await fileService.getFileById(req.params.id, organizationId);
      
      if (!file) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'File not found',
          },
        });
        return;
      }
      
      if (file.status !== 'PENDING_UPLOAD') {
        res.status(400).json({
          error: {
            code: 'INVALID_STATE',
            message: `File is already in ${file.status} state`,
          },
        });
        return;
      }
      
      const updatedFile = await fileService.markFileUploaded(file.id, organizationId);
      
      await createAuditLog({
        fileId: file.id,
        organizationId,
        action: AuditActions.UPLOADED,
        actor: apiKeyId,
        correlationId: req.correlationId,
      });
      
      // Enqueue file for background processing
      await queueService.enqueueFileProcessing({
        fileId: file.id,
        organizationId,
        key: file.key,
        bucket: file.bucket,
        mimeType: file.mimeType,
        correlationId: req.correlationId,
      });
      
      res.json({
        data: fileService.serializeFile(updatedFile),
        message: 'File upload confirmed. Processing queued.',
      });
    } catch (error) {
      next(error);
    }
  }
);

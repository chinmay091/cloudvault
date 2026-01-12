import { z } from 'zod';

/**
 * Validation schemas for file operations
 */

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/csv',
  'text/plain',
  'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
];

// Max file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export const uploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().refine(
    (type) => ALLOWED_MIME_TYPES.includes(type),
    { message: `Content type must be one of: ${ALLOWED_MIME_TYPES.join(', ')}` }
  ),
  size: z.number().int().positive().max(MAX_FILE_SIZE, {
    message: `File size must not exceed ${MAX_FILE_SIZE / 1024 / 1024}MB`,
  }),
  tags: z.array(z.string().max(50)).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const listFilesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['PENDING_UPLOAD', 'UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED']).optional(),
});

export type UploadRequest = z.infer<typeof uploadRequestSchema>;
export type ListFilesQuery = z.infer<typeof listFilesQuerySchema>;

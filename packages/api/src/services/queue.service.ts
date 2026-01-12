import { Queue } from 'bullmq';
import IORedis from 'ioredis';

/**
 * Queue Service for API
 * Used by the API to enqueue jobs for background processing
 */

// Queue names (must match worker)
export const QUEUE_NAMES = {
  FILE_PROCESSING: 'file-processing',
} as const;

// Job types
export const FILE_JOBS = {
  VALIDATE_FILE: 'validate-file',
  GENERATE_CHECKSUM: 'generate-checksum',
  EXTRACT_METADATA: 'extract-metadata',
  GENERATE_THUMBNAIL: 'generate-thumbnail',
} as const;

// Job data interface
export interface FileJobData {
  fileId: string;
  organizationId: string;
  key: string;
  bucket: string;
  mimeType: string;
  correlationId?: string;
}

// Redis connection
let connection: IORedis | null = null;
let fileProcessingQueue: Queue<FileJobData> | null = null;

function getConnection(): IORedis {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

function getFileProcessingQueue(): Queue<FileJobData> {
  if (!fileProcessingQueue) {
    fileProcessingQueue = new Queue<FileJobData>(QUEUE_NAMES.FILE_PROCESSING, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });
  }
  return fileProcessingQueue;
}

/**
 * Enqueue a file for processing
 * This creates multiple jobs: validate, checksum, metadata extraction
 */
export async function enqueueFileProcessing(params: {
  fileId: string;
  organizationId: string;
  key: string;
  bucket: string;
  mimeType: string;
  correlationId?: string;
}): Promise<void> {
  const queue = getFileProcessingQueue();
  const jobData: FileJobData = params;
  
  // Create jobs for different processing stages
  await Promise.all([
    queue.add(FILE_JOBS.VALIDATE_FILE, jobData, { priority: 1 }),
    queue.add(FILE_JOBS.GENERATE_CHECKSUM, jobData, { priority: 2 }),
    queue.add(FILE_JOBS.EXTRACT_METADATA, jobData, { priority: 3 }),
  ]);
  
  // If it's an image, also generate thumbnail
  if (params.mimeType.startsWith('image/')) {
    await queue.add(FILE_JOBS.GENERATE_THUMBNAIL, jobData, { priority: 4 });
  }
  
  console.log(`[QUEUE] Enqueued processing jobs for file: ${params.fileId}`);
}

/**
 * Get queue stats (for monitoring)
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const queue = getFileProcessingQueue();
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);
  
  return { waiting, active, completed, failed };
}

/**
 * Close queue connection
 */
export async function closeQueueConnection(): Promise<void> {
  if (fileProcessingQueue) {
    await fileProcessingQueue.close();
    fileProcessingQueue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}

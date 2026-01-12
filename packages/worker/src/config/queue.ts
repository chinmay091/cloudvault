import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

/**
 * Queue Configuration
 * Centralized configuration for BullMQ queues
 */

// Redis connection for BullMQ
const getRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
  });
};

// Shared connection for all queues
let connection: IORedis | null = null;

export function getConnection(): IORedis {
  if (!connection) {
    connection = getRedisConnection();
  }
  return connection;
}

// Queue names
export const QUEUE_NAMES = {
  FILE_PROCESSING: 'file-processing',
  CLEANUP: 'cleanup',
} as const;

// Job types for file processing
export const FILE_JOBS = {
  VALIDATE_FILE: 'validate-file',
  GENERATE_CHECKSUM: 'generate-checksum',
  EXTRACT_METADATA: 'extract-metadata',
  GENERATE_THUMBNAIL: 'generate-thumbnail',
} as const;

// Job data interfaces
export interface FileJobData {
  fileId: string;
  organizationId: string;
  key: string;
  bucket: string;
  mimeType: string;
  correlationId?: string;
}

export interface CleanupJobData {
  fileId: string;
  organizationId: string;
  key: string;
  bucket: string;
  reason: string;
}

// Default job options
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: {
    count: 100, // Keep last 100 completed jobs
    age: 24 * 60 * 60, // Keep for 24 hours
  },
  removeOnFail: {
    count: 500, // Keep last 500 failed jobs
    age: 7 * 24 * 60 * 60, // Keep for 7 days
  },
};

// Create a queue
export function createQueue(name: string): Queue {
  return new Queue(name, {
    connection: getConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
}

// Close connection on shutdown
export async function closeConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}

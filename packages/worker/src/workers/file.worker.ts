import { Worker, Job } from 'bullmq';
import {
  getConnection,
  QUEUE_NAMES,
  FILE_JOBS,
  FileJobData,
} from '../config/queue.js';

/**
 * File Processing Worker
 * Handles file validation, checksum generation, and metadata extraction
 */

// Simulated processing functions (replace with real implementations later)
async function validateFile(data: FileJobData): Promise<{ valid: boolean; error?: string }> {
  console.log(`[VALIDATE] Validating file: ${data.fileId}`);
  
  // Simulate validation (check file exists in S3, verify size, etc.)
  await sleep(500);
  
  // For now, always valid
  return { valid: true };
}

async function generateChecksum(data: FileJobData): Promise<string> {
  console.log(`[CHECKSUM] Generating checksum for: ${data.fileId}`);
  
  // Simulate checksum generation
  await sleep(300);
  
  // Return a fake checksum (in real implementation, download file and compute SHA-256)
  return `sha256-${Date.now().toString(16)}`;
}

async function extractMetadata(data: FileJobData): Promise<Record<string, unknown>> {
  console.log(`[METADATA] Extracting metadata for: ${data.fileId}`);
  
  // Simulate metadata extraction
  await sleep(400);
  
  // Return fake metadata
  return {
    extractedAt: new Date().toISOString(),
    mimeType: data.mimeType,
    processingVersion: '1.0.0',
  };
}

// Process a file job based on its type
async function processFileJob(job: Job<FileJobData>): Promise<unknown> {
  const { data, name } = job;
  
  console.log(`[WORKER] Processing job: ${name} for file: ${data.fileId}`);
  
  switch (name) {
    case FILE_JOBS.VALIDATE_FILE:
      return validateFile(data);
    
    case FILE_JOBS.GENERATE_CHECKSUM:
      return generateChecksum(data);
    
    case FILE_JOBS.EXTRACT_METADATA:
      return extractMetadata(data);
    
    case FILE_JOBS.GENERATE_THUMBNAIL:
      console.log(`[THUMBNAIL] Skipping thumbnail for: ${data.fileId} (not an image)`);
      return { skipped: true, reason: 'Not an image or thumbnail generation not implemented' };
    
    default:
      throw new Error(`Unknown job type: ${name}`);
  }
}

// Create and start the file processing worker
export function createFileProcessingWorker(): Worker<FileJobData> {
  const worker = new Worker<FileJobData>(
    QUEUE_NAMES.FILE_PROCESSING,
    processFileJob,
    {
      connection: getConnection(),
      concurrency: 5, // Process 5 jobs at a time
    }
  );
  
  // Event handlers
  worker.on('completed', (job, result) => {
    console.log(`[COMPLETED] Job ${job.name} for file ${job.data.fileId}:`, result);
  });
  
  worker.on('failed', (job, error) => {
    console.error(`[FAILED] Job ${job?.name} for file ${job?.data.fileId}:`, error.message);
  });
  
  worker.on('error', (error) => {
    console.error('[WORKER ERROR]:', error);
  });
  
  return worker;
}

// Utility function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

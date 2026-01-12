import { createFileProcessingWorker } from './workers/file.worker.js';
import { closeConnection } from './config/queue.js';

/**
 * CloudVault Worker Service
 * Background job processing for file operations
 */

console.log('🔧 Starting CloudVault Worker...');

// Start the file processing worker
const fileWorker = createFileProcessingWorker();

console.log('✅ File processing worker started');
console.log('📋 Listening for jobs on queue: file-processing');

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  // Close the worker (wait for current jobs to complete)
  await fileWorker.close();
  console.log('📤 Worker stopped');
  
  // Close Redis connection
  await closeConnection();
  console.log('📤 Redis connection closed');
  
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Keep the process running
console.log('🚀 Worker is running. Press Ctrl+C to stop.');

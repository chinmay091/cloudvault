import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase, disconnectDatabase } from './lib/prisma.js';
import { logger } from './lib/logger.js';
import { requestLoggerMiddleware } from './middlewares/requestLogger.middleware.js';
import { fileRoutes } from './routes/file.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { closeQueueConnection } from './services/queue.service.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging with correlation IDs
app.use(requestLoggerMiddleware);

// Health routes (no auth required)
app.use('/health', healthRoutes);

// Simple health check for root
app.get('/', (_req, res) => {
  res.json({ service: 'cloudvault-api', status: 'ok' });
});

// API routes
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/admin', adminRoutes);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
    },
  });
});

const PORT = process.env.PORT || 3000;

async function main() {
  await connectDatabase();
  
  app.listen(PORT, () => {
    logger.info({ port: PORT }, '🚀 CloudVault API running');
    console.log(`🚀 CloudVault API running on port ${PORT}`);
    console.log(`📋 Health: http://localhost:${PORT}/health/live`);
    console.log(`📊 Metrics: http://localhost:${PORT}/health/metrics`);
    console.log(`📁 Files API: http://localhost:${PORT}/api/v1/files`);
    console.log(`🔑 Admin API: http://localhost:${PORT}/api/v1/admin`);
  });
  
  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    await disconnectDatabase();
    await closeQueueConnection();
    process.exit(0);
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
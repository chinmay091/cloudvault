import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getQueueStats } from '../services/queue.service.js';

export const healthRoutes = Router();

/**
 * GET /health/live
 * Liveness probe - is the service running?
 */
healthRoutes.get('/live', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'cloudvault-api',
  });
});

/**
 * GET /health/ready
 * Readiness probe - is the service ready to accept requests?
 */
healthRoutes.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latency?: string; error?: string }> = {};
  let allHealthy = true;
  
  // Check database
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy', latency: `${Date.now() - dbStart}ms` };
  } catch (error) {
    checks.database = { status: 'unhealthy', error: (error as Error).message };
    allHealthy = false;
  }
  
  // Check Redis/Queue
  const queueStart = Date.now();
  try {
    const stats = await getQueueStats();
    checks.queue = {
      status: 'healthy',
      latency: `${Date.now() - queueStart}ms`,
    };
  } catch (error) {
    checks.queue = { status: 'unhealthy', error: (error as Error).message };
    allHealthy = false;
  }
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
  });
});

/**
 * GET /health/metrics
 * Basic metrics for monitoring
 */
healthRoutes.get('/metrics', async (_req: Request, res: Response) => {
  try {
    // Get queue stats
    const queueStats = await getQueueStats();
    
    // Get database stats
    const [fileCount, orgCount] = await Promise.all([
      prisma.file.count(),
      prisma.organization.count(),
    ]);
    
    // Memory usage
    const memUsage = process.memoryUsage();
    
    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      },
      database: {
        organizations: orgCount,
        files: fileCount,
      },
      queue: queueStats,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: (error as Error).message,
    });
  }
});

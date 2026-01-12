import { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import { createRequestLogger } from '../lib/logger.js';

/**
 * Request Logging Middleware
 * Logs all incoming requests with timing, response status, and correlation IDs
 */

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();
  const correlationId = (req.headers['x-correlation-id'] as string) || nanoid();
  
  // Attach to request
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Create request-scoped logger
  const log = createRequestLogger(correlationId, req.auth?.organizationId);
  
  // Log incoming request
  log.info({
    type: 'request',
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.socket.remoteAddress,
  }, `→ ${req.method} ${req.path}`);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - startTime) / 1_000_000; // ms
    
    const logData = {
      type: 'response',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      organizationId: req.auth?.organizationId,
    };
    
    if (res.statusCode >= 500) {
      log.error(logData, `← ${res.statusCode} ${req.method} ${req.path}`);
    } else if (res.statusCode >= 400) {
      log.warn(logData, `← ${res.statusCode} ${req.method} ${req.path}`);
    } else {
      log.info(logData, `← ${res.statusCode} ${req.method} ${req.path}`);
    }
  });
  
  next();
}

import { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';

/**
 * Correlation ID Middleware
 * Assigns a unique ID to each request for tracing
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || nanoid();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}

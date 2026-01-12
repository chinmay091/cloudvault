import pino from 'pino';

/**
 * Structured Logger for CloudVault API
 * Uses Pino for high-performance JSON logging
 */

const isDev = process.env.NODE_ENV !== 'production';

// Create base logger
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'cloudvault-api',
    version: process.env.npm_package_version || '0.0.1',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Create child logger with additional context
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

// Request-scoped logger
export function createRequestLogger(correlationId: string, organizationId?: string) {
  return logger.child({
    correlationId,
    ...(organizationId && { organizationId }),
  });
}

// Log levels convenience functions
export const log = {
  debug: (msg: string, obj?: object) => logger.debug(obj, msg),
  info: (msg: string, obj?: object) => logger.info(obj, msg),
  warn: (msg: string, obj?: object) => logger.warn(obj, msg),
  error: (msg: string, obj?: object) => logger.error(obj, msg),
  fatal: (msg: string, obj?: object) => logger.fatal(obj, msg),
};

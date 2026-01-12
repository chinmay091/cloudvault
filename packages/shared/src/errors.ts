/**
 * Custom error classes for consistent error handling
 */

export class CloudVaultError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CloudVaultError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: { code: this.code, message: this.message, details: this.details },
    };
  }
}

export class ValidationError extends CloudVaultError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class AuthenticationError extends CloudVaultError {
  constructor(message = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class AuthorizationError extends CloudVaultError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

export class NotFoundError extends CloudVaultError {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} '${id}' not found` : `${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends CloudVaultError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export function isCloudVaultError(error: unknown): error is CloudVaultError {
  return error instanceof CloudVaultError;
}

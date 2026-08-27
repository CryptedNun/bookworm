/**
 * Centralized error handling utilities
 * Provides consistent error responses across all Server Actions
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ErrorCodes = {
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Authorization
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validation
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  
  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  
  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export interface ErrorResponse {
  success: false;
  error: string;
  code: ErrorCode;
  details?: any;
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
}

export type ActionResponse<T = any> = SuccessResponse<T> | ErrorResponse;

/**
 * Wraps a Server Action with consistent error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<ActionResponse<R>> => {
    try {
      const data = await fn(...args);
      return { success: true, data };
    } catch (error) {
      console.error('Server Action Error:', error);

      if (error instanceof AppError) {
        return {
          success: false,
          error: error.message,
          code: error.code as ErrorCode,
          details: error.details,
        };
      }

      // PostgreSQL errors
      if (error && typeof error === 'object' && 'code' in error) {
        const pgError = error as any;
        
        // Foreign key violation
        if (pgError.code === '23503') {
          return {
            success: false,
            error: 'Referenced resource does not exist',
            code: ErrorCodes.CONSTRAINT_VIOLATION,
            details: pgError.detail,
          };
        }
        
        // Unique violation
        if (pgError.code === '23505') {
          return {
            success: false,
            error: 'Resource already exists',
            code: ErrorCodes.ALREADY_EXISTS,
            details: pgError.detail,
          };
        }
        
        // Check violation
        if (pgError.code === '23514') {
          return {
            success: false,
            error: 'Invalid data: constraint violation',
            code: ErrorCodes.CONSTRAINT_VIOLATION,
            details: pgError.detail,
          };
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        code: ErrorCodes.UNKNOWN_ERROR,
      };
    }
  };
}

/**
 * Validation helpers
 */
export const validate = {
  required: (value: any, fieldName: string) => {
    if (value === undefined || value === null || value === '') {
      throw new AppError(
        `${fieldName} is required`,
        ErrorCodes.MISSING_REQUIRED_FIELD,
        400,
        { field: fieldName }
      );
    }
  },

  minLength: (value: string, min: number, fieldName: string) => {
    if (value.length < min) {
      throw new AppError(
        `${fieldName} must be at least ${min} characters`,
        ErrorCodes.INVALID_INPUT,
        400,
        { field: fieldName, min, actual: value.length }
      );
    }
  },

  maxLength: (value: string, max: number, fieldName: string) => {
    if (value.length > max) {
      throw new AppError(
        `${fieldName} must be at most ${max} characters`,
        ErrorCodes.INVALID_INPUT,
        400,
        { field: fieldName, max, actual: value.length }
      );
    }
  },

  email: (value: string, fieldName: string = 'Email') => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new AppError(
        `${fieldName} must be a valid email address`,
        ErrorCodes.INVALID_FORMAT,
        400,
        { field: fieldName }
      );
    }
  },

  uuid: (value: string, fieldName: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new AppError(
        `${fieldName} must be a valid UUID`,
        ErrorCodes.INVALID_FORMAT,
        400,
        { field: fieldName }
      );
    }
  },

  oneOf: <T>(value: T, options: T[], fieldName: string) => {
    if (!options.includes(value)) {
      throw new AppError(
        `${fieldName} must be one of: ${options.join(', ')}`,
        ErrorCodes.INVALID_INPUT,
        400,
        { field: fieldName, allowed: options, actual: value }
      );
    }
  },
};

/**
 * Authorization helpers
 */
export function requireAuth(user: any): asserts user is NonNullable<typeof user> {
  if (!user) {
    throw new AppError(
      'Authentication required',
      ErrorCodes.UNAUTHORIZED,
      401
    );
  }
}

export function requirePermission(hasPermission: boolean, action: string = 'perform this action') {
  if (!hasPermission) {
    throw new AppError(
      `You don't have permission to ${action}`,
      ErrorCodes.INSUFFICIENT_PERMISSIONS,
      403
    );
  }
}

export function requireResource<T>(resource: T | null | undefined, resourceType: string = 'Resource'): asserts resource is T {
  if (!resource) {
    throw new AppError(
      `${resourceType} not found`,
      ErrorCodes.NOT_FOUND,
      404
    );
  }
}

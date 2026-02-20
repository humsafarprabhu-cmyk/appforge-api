/**
 * Zod validation schemas + Express middleware for all SDK routes.
 * Every input is validated. Every error is structured.
 */
import { z } from 'zod';
import express from 'express';
type Request = express.Request;
type Response = express.Response;
type NextFunction = express.NextFunction;

// ─── ERROR CODES ────────────────────────────────────────────────────────────
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL_ERROR',
  APP_NOT_FOUND: 'APP_NOT_FOUND',
  USER_LIMIT: 'USER_LIMIT_REACHED',
  STORAGE_ERROR: 'STORAGE_ERROR',
} as const;

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export function apiError(res: Response, status: number, code: string, message: string, details?: unknown) {
  return res.status(status).json({ error: { code, message, details } });
}

// ─── COMMON SCHEMAS ─────────────────────────────────────────────────────────
export const emailSchema = z.string().email('Invalid email format').max(255).transform(s => s.toLowerCase().trim());
export const passwordSchema = z.string().min(6, 'Password must be at least 6 characters').max(128);
export const uuidSchema = z.string().uuid('Invalid ID format');
export const appIdSchema = z.string().min(1, 'App ID is required').max(100);
export const collectionNameSchema = z.string().min(1).max(64).regex(/^[a-z_][a-z0-9_]*$/, 'Collection name must be lowercase with underscores');
export const displayNameSchema = z.string().min(1).max(100).optional();
export const paginationSchema = z.object({
  _limit: z.coerce.number().int().min(1).max(1000).default(100),
  _offset: z.coerce.number().int().min(0).default(0),
  _orderBy: z.string().max(64).optional(),
  _order: z.enum(['asc', 'desc']).default('desc'),
});

// ─── AUTH SCHEMAS ───────────────────────────────────────────────────────────
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  display_name: displayNameSchema,
  role: z.enum(['user', 'editor']).default('user'), // admin can only be set by other admins
});

export const signinSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetSchema = z.object({
  token: z.string().min(1),
  new_password: passwordSchema,
});

export const updateProfileSchema = z.object({
  display_name: displayNameSchema,
  avatar_url: z.string().url().max(2048).optional(),
  profile_data: z.record(z.unknown()).optional(),
}).refine(data => Object.keys(data).length > 0, 'At least one field must be provided');

export const updateRoleSchema = z.object({
  role: z.enum(['admin', 'editor', 'user', 'guest']),
});

// ─── DATA SCHEMAS ───────────────────────────────────────────────────────────
export const createItemSchema = z.object({
  data: z.record(z.unknown()).refine(d => Object.keys(d).length > 0, 'Data object cannot be empty'),
});

export const updateItemSchema = z.object({
  data: z.record(z.unknown()).refine(d => Object.keys(d).length > 0, 'Data object cannot be empty'),
});

// Field definition schema for collection schemas
export const fieldDefSchema = z.object({
  name: z.string().min(1).max(64),
  type: z.enum(['text', 'number', 'boolean', 'date', 'json', 'email', 'url', 'enum']),
  required: z.boolean().default(false),
  default: z.unknown().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().max(10000).optional(),
  enum_values: z.array(z.string()).optional(),
  relation: z.object({
    collection: z.string(),
    field: z.string().default('id'),
  }).optional(),
});

export const collectionSchemaSchema = z.array(fieldDefSchema);

// ─── NOTIFICATION SCHEMAS ───────────────────────────────────────────────────
export const sendNotificationSchema = z.object({
  end_user_id: uuidSchema.optional(), // null = broadcast
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  data: z.record(z.unknown()).optional(),
});

export const pushSubscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

// ─── VALIDATION MIDDLEWARE ──────────────────────────────────────────────────
export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return apiError(res, 400, ErrorCode.VALIDATION_ERROR, 'Validation failed', errors);
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return apiError(res, 400, ErrorCode.VALIDATION_ERROR, 'Invalid query parameters', errors);
    }
    (req as any).validatedQuery = result.data;
    next();
  };
}

export function validateParams(paramSchemas: Record<string, z.ZodType>) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const [key, schema] of Object.entries(paramSchemas)) {
      const result = schema.safeParse(req.params[key]);
      if (!result.success) {
        return apiError(res, 400, ErrorCode.VALIDATION_ERROR, `Invalid parameter: ${key}`, result.error.errors);
      }
    }
    next();
  };
}

// Validate data against a collection's schema
export function validateDataAgainstSchema(data: Record<string, unknown>, schema: z.infer<typeof fieldDefSchema>[]): string[] {
  const errors: string[] = [];
  
  for (const field of schema) {
    const value = data[field.name];
    
    // Required check
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push(`Field "${field.name}" is required`);
      continue;
    }
    
    if (value === undefined || value === null) continue;
    
    // Type checks
    switch (field.type) {
      case 'text':
        if (typeof value !== 'string') errors.push(`Field "${field.name}" must be text`);
        else {
          if (field.minLength && value.length < field.minLength) errors.push(`Field "${field.name}" must be at least ${field.minLength} characters`);
          if (field.maxLength && value.length > field.maxLength) errors.push(`Field "${field.name}" must be at most ${field.maxLength} characters`);
        }
        break;
      case 'number':
        if (typeof value !== 'number') errors.push(`Field "${field.name}" must be a number`);
        else {
          if (field.min !== undefined && value < field.min) errors.push(`Field "${field.name}" must be at least ${field.min}`);
          if (field.max !== undefined && value > field.max) errors.push(`Field "${field.name}" must be at most ${field.max}`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') errors.push(`Field "${field.name}" must be true/false`);
        break;
      case 'date':
        if (typeof value !== 'string' || isNaN(Date.parse(value as string))) errors.push(`Field "${field.name}" must be a valid date`);
        break;
      case 'email':
        if (typeof value !== 'string' || !z.string().email().safeParse(value).success) errors.push(`Field "${field.name}" must be a valid email`);
        break;
      case 'url':
        if (typeof value !== 'string' || !z.string().url().safeParse(value).success) errors.push(`Field "${field.name}" must be a valid URL`);
        break;
      case 'enum':
        if (field.enum_values && !field.enum_values.includes(value as string)) errors.push(`Field "${field.name}" must be one of: ${field.enum_values.join(', ')}`);
        break;
      case 'json':
        // JSON accepts anything
        break;
    }
  }
  
  return errors;
}

/**
 * Role-based auth middleware for SDK routes.
 * Roles: admin > editor > user > guest
 * 
 * Admin: full access to all data, user management, settings
 * Editor: can create/edit content, but not manage users/settings
 * User: can CRUD own data, read shared data
 * Guest: read-only access to public data
 */
import express from 'express';
type Request = express.Request;
type Response = express.Response;
type NextFunction = express.NextFunction;
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { apiError, ErrorCode } from './validate.ts';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const JWT_SECRET = process.env.APPFORGE_JWT_SECRET || 'appforge-dev-secret-change-in-production';

export type Role = 'admin' | 'editor' | 'user' | 'guest';
const ROLE_HIERARCHY: Record<Role, number> = { admin: 4, editor: 3, user: 2, guest: 1 };

export interface AuthUser {
  userId: string;
  appId: string;
  email: string;
  role: Role;
  display_name?: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
      appId?: string;
    }
  }
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verify;
}

export function generateToken(userId: string, appId: string, role: Role): string {
  return jwt.sign({ sub: userId, app: appId, role }, JWT_SECRET, { expiresIn: '30d' });
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export { supabase };

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────

/**
 * Extract and validate X-App-Id header.
 */
export function requireAppId(req: Request, res: Response, next: NextFunction) {
  const appId = req.headers['x-app-id'] as string;
  if (!appId) {
    return apiError(res, 400, ErrorCode.VALIDATION_ERROR, 'Missing X-App-Id header');
  }
  req.appId = appId;
  next();
}

/**
 * Parse auth token if present (does NOT require auth).
 * Sets req.auth if valid token found.
 */
export function parseAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }
  
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { sub: string; app: string; role?: string };
    req.auth = {
      userId: payload.sub,
      appId: payload.app,
      email: '', // Will be fetched if needed
      role: (payload.role as Role) || 'user',
    };
  } catch {
    // Invalid token — continue as guest
  }
  next();
}

/**
 * Require authentication. Fails with 401 if no valid token.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return apiError(res, 401, ErrorCode.AUTH_REQUIRED, 'Authentication required');
  }
  
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { sub: string; app: string; role?: string };
    req.auth = {
      userId: payload.sub,
      appId: payload.app,
      email: '',
      role: (payload.role as Role) || 'user',
    };
    next();
  } catch {
    return apiError(res, 401, ErrorCode.AUTH_INVALID, 'Invalid or expired token');
  }
}

/**
 * Require minimum role. Must be used AFTER requireAuth.
 */
export function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return apiError(res, 401, ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }
    
    const userLevel = ROLE_HIERARCHY[req.auth.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole];
    
    if (userLevel < requiredLevel) {
      return apiError(res, 403, ErrorCode.FORBIDDEN, `Requires ${minRole} role or higher`);
    }
    next();
  };
}

/**
 * Check if user owns the resource or is admin.
 */
export function ownerOrAdmin(ownerField: string = 'end_user_id') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return apiError(res, 401, ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }
    // Admins and editors can access anything
    if (req.auth.role === 'admin' || req.auth.role === 'editor') {
      return next();
    }
    // Store the owner field check info for the route handler
    (req as any).ownerCheck = { field: ownerField, userId: req.auth.userId };
    next();
  };
}

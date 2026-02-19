/**
 * SDK Routes v2 — Hardened with validation, rate limiting, roles, proper errors.
 * Replaces sdk-routes.ts
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { 
  requireAppId, parseAuth, requireAuth, requireRole, 
  supabase, type Role 
} from './middleware/auth.ts';
import {
  validateBody, validateQuery, validateParams,
  apiError, ErrorCode,
  signupSchema, signinSchema, updateProfileSchema, updateRoleSchema,
  passwordResetRequestSchema, passwordResetSchema,
  createItemSchema, updateItemSchema, paginationSchema,
  collectionNameSchema, uuidSchema,
  sendNotificationSchema, pushSubscriptionSchema,
} from './middleware/validate.ts';
import {
  authRateLimit, dataReadRateLimit, dataWriteRateLimit, 
  storageRateLimit, notifyRateLimit,
} from './middleware/rate-limit.ts';
import * as authService from './services/auth.service.ts';
import * as dataService from './services/data.service.ts';
import * as storageService from './services/storage.service.ts';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// All SDK routes require X-App-Id
router.use(requireAppId);
router.use(parseAuth);

// ─── HEALTH ─────────────────────────────────────────────────────────────────
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', version: '2.0.0' });
});

// ─── AUTH ROUTES ────────────────────────────────────────────────────────────

router.post('/auth/signup', authRateLimit, validateBody(signupSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.signup({
      appId: req.appId!,
      email: req.body.email,
      password: req.body.password,
      display_name: req.body.display_name,
      role: req.body.role,
    });
    res.status(201).json(result);
  } catch (e: any) {
    apiError(res, e.status || 500, e.status === 409 ? ErrorCode.CONFLICT : ErrorCode.INTERNAL, e.message);
  }
});

router.post('/auth/signin', authRateLimit, validateBody(signinSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.signin(req.appId!, req.body.email, req.body.password);
    res.json(result);
  } catch (e: any) {
    apiError(res, e.status || 500, e.status === 401 ? ErrorCode.AUTH_INVALID : ErrorCode.INTERNAL, e.message);
  }
});

router.post('/auth/signout', (_req: Request, res: Response) => {
  res.json({ success: true });
});

router.get('/auth/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await authService.getUser(req.auth!.userId, req.appId!);
    res.json({ user });
  } catch (e: any) {
    apiError(res, e.status || 500, ErrorCode.INTERNAL, e.message);
  }
});

router.patch('/auth/me', requireAuth, validateBody(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    const user = await authService.updateProfile(req.auth!.userId, req.appId!, req.body);
    res.json({ user });
  } catch (e: any) {
    apiError(res, e.status || 500, ErrorCode.INTERNAL, e.message);
  }
});

router.post('/auth/reset-request', authRateLimit, validateBody(passwordResetRequestSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.requestPasswordReset(req.appId!, req.body.email);
    res.json(result);
  } catch (e: any) {
    apiError(res, 500, ErrorCode.INTERNAL, e.message);
  }
});

router.post('/auth/reset', authRateLimit, validateBody(passwordResetSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.resetPassword(req.appId!, req.body.token, req.body.new_password);
    res.json(result);
  } catch (e: any) {
    apiError(res, e.status || 500, ErrorCode.INTERNAL, e.message);
  }
});

// ─── ADMIN: USER MANAGEMENT ────────────────────────────────────────────────

router.get('/admin/users', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await authService.listUsers(req.appId!, {
      limit: Math.min(parseInt(req.query._limit as string) || 50, 100),
      offset: parseInt(req.query._offset as string) || 0,
      search: req.query.search as string,
      role: req.query.role as Role,
    });
    res.json(result);
  } catch (e: any) {
    apiError(res, 500, ErrorCode.INTERNAL, e.message);
  }
});

router.patch('/admin/users/:userId/role', requireAuth, requireRole('admin'), validateBody(updateRoleSchema), async (req: Request, res: Response) => {
  try {
    const user = await authService.updateUserRole(req.appId!, req.params.userId, req.body.role);
    res.json({ user });
  } catch (e: any) {
    apiError(res, e.status || 500, ErrorCode.INTERNAL, e.message);
  }
});

router.post('/admin/users/:userId/ban', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await authService.banUser(req.appId!, req.params.userId);
    res.json({ success: true });
  } catch (e: any) {
    apiError(res, 500, ErrorCode.INTERNAL, e.message);
  }
});

router.post('/admin/users/:userId/unban', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    await authService.unbanUser(req.appId!, req.params.userId);
    res.json({ success: true });
  } catch (e: any) {
    apiError(res, 500, ErrorCode.INTERNAL, e.message);
  }
});

router.get('/admin/stats', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const stats = await dataService.getStats(req.appId!);
    
    // Also get user stats
    const { count: userCount } = await supabase
      .from('app_end_users')
      .select('*', { count: 'exact', head: true })
      .eq('app_id', req.appId!);

    const { count: activeCount } = await supabase
      .from('app_end_users')
      .select('*', { count: 'exact', head: true })
      .eq('app_id', req.appId!)
      .gte('last_login_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    res.json({
      users: { total: userCount || 0, activeLastWeek: activeCount || 0 },
      collections: stats,
    });
  } catch (e: any) {
    apiError(res, 500, ErrorCode.INTERNAL, e.message);
  }
});

// ─── DATA ROUTES ────────────────────────────────────────────────────────────

router.get('/data/_stats', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const stats = await dataService.getStats(req.appId!);
    res.json(stats);
  } catch (e: any) {
    apiError(res, 500, ErrorCode.INTERNAL, e.message);
  }
});

router.get('/data/_collections', requireAuth, async (req: Request, res: Response) => {
  try {
    const collections = await dataService.listCollections(req.appId!);
    res.json(collections);
  } catch (e: any) {
    apiError(res, 500, ErrorCode.INTERNAL, e.message);
  }
});

router.get('/data/:collection', dataReadRateLimit, async (req: Request, res: Response) => {
  try {
    const { _limit, _offset, _orderBy, _order, ...filters } = req.query;
    const result = await dataService.listItems(req.appId!, req.params.collection, {
      limit: Math.min(parseInt(_limit as string) || 100, 1000),
      offset: parseInt(_offset as string) || 0,
      orderBy: _orderBy as string,
      order: (_order as 'asc' | 'desc') || 'desc',
      filters: Object.keys(filters).length > 0 ? filters as Record<string, string> : undefined,
      userId: req.auth?.userId,
      userRole: req.auth?.role,
    });
    res.json(result);
  } catch (e: any) {
    apiError(res, e.status || 500, ErrorCode.INTERNAL, e.message);
  }
});

router.get('/data/:collection/count', dataReadRateLimit, async (req: Request, res: Response) => {
  try {
    const result = await dataService.countItems(req.appId!, req.params.collection);
    res.json(result);
  } catch (e: any) {
    apiError(res, 500, ErrorCode.INTERNAL, e.message);
  }
});

router.get('/data/:collection/:id', dataReadRateLimit, async (req: Request, res: Response) => {
  try {
    const item = await dataService.getItem(req.appId!, req.params.collection, req.params.id, req.auth?.userId, req.auth?.role);
    res.json(item);
  } catch (e: any) {
    apiError(res, e.status || 500, e.status === 404 ? ErrorCode.NOT_FOUND : ErrorCode.INTERNAL, e.message);
  }
});

router.post('/data/:collection', dataWriteRateLimit, validateBody(createItemSchema), async (req: Request, res: Response) => {
  try {
    const item = await dataService.createItem(req.appId!, req.params.collection, req.body.data, req.auth?.userId, req.auth?.role);
    res.status(201).json(item);
  } catch (e: any) {
    apiError(res, e.status || 500, ErrorCode.INTERNAL, e.message);
  }
});

router.patch('/data/:collection/:id', dataWriteRateLimit, validateBody(updateItemSchema), async (req: Request, res: Response) => {
  try {
    const item = await dataService.updateItem(req.appId!, req.params.collection, req.params.id, req.body.data, req.auth?.userId, req.auth?.role);
    res.json(item);
  } catch (e: any) {
    apiError(res, e.status || 500, e.status === 404 ? ErrorCode.NOT_FOUND : ErrorCode.INTERNAL, e.message);
  }
});

router.delete('/data/:collection/:id', dataWriteRateLimit, async (req: Request, res: Response) => {
  try {
    await dataService.deleteItem(req.appId!, req.params.collection, req.params.id, req.auth?.userId, req.auth?.role);
    res.json({ success: true });
  } catch (e: any) {
    apiError(res, e.status || 500, ErrorCode.INTERNAL, e.message);
  }
});

// Bulk operations (admin only)
router.post('/data/:collection/_bulk-delete', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return apiError(res, 400, ErrorCode.VALIDATION_ERROR, 'ids must be a non-empty array');
    }
    const result = await dataService.bulkDelete(req.appId!, req.params.collection, ids);
    res.json(result);
  } catch (e: any) {
    apiError(res, 500, ErrorCode.INTERNAL, e.message);
  }
});

// ─── STORAGE ROUTES ─────────────────────────────────────────────────────────

router.post('/storage/upload', storageRateLimit, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return apiError(res, 400, ErrorCode.VALIDATION_ERROR, 'No file provided');
    const purpose = (req.body.purpose as string) || 'general';
    const result = await storageService.uploadFile(req.appId!, req.file, req.auth?.userId, purpose);
    res.json(result);
  } catch (e: any) {
    apiError(res, e.status || 500, ErrorCode.STORAGE_ERROR, e.message);
  }
});

router.get('/storage/list', async (req: Request, res: Response) => {
  try {
    const result = await storageService.listFiles(req.appId!, {
      purpose: req.query.purpose as string,
      userId: req.auth?.userId,
      limit: parseInt(req.query._limit as string) || 100,
      offset: parseInt(req.query._offset as string) || 0,
    });
    res.json(result);
  } catch (e: any) {
    apiError(res, 500, ErrorCode.INTERNAL, e.message);
  }
});

router.delete('/storage/:fileId', requireAuth, async (req: Request, res: Response) => {
  try {
    await storageService.deleteFile(req.appId!, req.params.fileId);
    res.json({ success: true });
  } catch (e: any) {
    apiError(res, e.status || 500, ErrorCode.INTERNAL, e.message);
  }
});

// ─── NOTIFICATION ROUTES ────────────────────────────────────────────────────

router.post('/notifications/subscribe', requireAuth, notifyRateLimit, validateBody(pushSubscriptionSchema), async (req: Request, res: Response) => {
  try {
    await supabase.from('push_subscriptions').upsert({
      app_id: req.appId,
      end_user_id: req.auth!.userId,
      endpoint: req.body.subscription.endpoint,
      p256dh: req.body.subscription.keys.p256dh,
      auth_key: req.body.subscription.keys.auth,
      user_agent: req.headers['user-agent'],
    }, { onConflict: 'app_id,end_user_id,endpoint' });
    res.json({ success: true });
  } catch (e: any) {
    apiError(res, 500, ErrorCode.INTERNAL, e.message);
  }
});

router.post('/notifications/send', requireAuth, requireRole('admin'), notifyRateLimit, validateBody(sendNotificationSchema), async (req: Request, res: Response) => {
  try {
    await supabase.from('app_notifications').insert({
      app_id: req.appId,
      end_user_id: req.body.end_user_id || null,
      title: req.body.title,
      body: req.body.body,
      data: req.body.data || {},
      status: 'pending',
    });
    // TODO: Actually send via web-push
    res.json({ success: true });
  } catch (e: any) {
    apiError(res, 500, ErrorCode.INTERNAL, e.message);
  }
});

router.post('/notifications/broadcast', requireAuth, requireRole('admin'), notifyRateLimit, validateBody(sendNotificationSchema), async (req: Request, res: Response) => {
  try {
    await supabase.from('app_notifications').insert({
      app_id: req.appId,
      end_user_id: null,
      title: req.body.title,
      body: req.body.body,
      data: req.body.data || {},
      status: 'pending',
    });
    res.json({ success: true });
  } catch (e: any) {
    apiError(res, 500, ErrorCode.INTERNAL, e.message);
  }
});

export default router;

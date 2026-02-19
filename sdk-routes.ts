/**
 * AppForge SDK API Routes
 * These routes handle requests from generated apps (end-user operations).
 * Multi-tenant: every request scoped by X-App-Id header.
 */

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const router = Router();

// Supabase admin client (service role — bypasses RLS for multi-tenant ops)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const isSupabaseConfigured = () => SUPABASE_URL !== 'https://placeholder.supabase.co' && SUPABASE_KEY !== 'placeholder';

const JWT_SECRET = process.env.APPFORGE_JWT_SECRET || 'appforge-dev-secret-change-in-production';

// ─── MIDDLEWARE ─────────────────────────────────────────────────────────────
function getAppId(req: Request): string {
  const appId = req.headers['x-app-id'] as string;
  if (!appId) throw new Error('Missing X-App-Id header');
  return appId;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verify;
}

function generateToken(userId: string, appId: string): string {
  return jwt.sign({ sub: userId, app: appId }, JWT_SECRET, { expiresIn: '30d' });
}

function authenticateEndUser(req: Request): { userId: string; appId: string } | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { sub: string; app: string };
    return { userId: payload.sub, appId: payload.app };
  } catch {
    return null;
  }
}

// ─── AUTH ROUTES ────────────────────────────────────────────────────────────

// Sign up
router.post('/auth/signup', async (req: Request, res: Response) => {
  try {
    const appId = getAppId(req);
    const { email, password, display_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    // Check if user exists
    const { data: existing } = await supabase
      .from('app_end_users')
      .select('id')
      .eq('app_id', appId)
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    // Check end-user limit for the app
    const { data: app } = await supabase
      .from('apps')
      .select('end_user_count, user_id')
      .eq('id', appId)
      .single();

    if (!app) return res.status(404).json({ message: 'App not found' });

    // Check builder's plan limits
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', app.user_id)
      .single();

    const endUserLimits: Record<string, number> = {
      free: 100,
      maker: 1000,
      pro: 10000,
      agency: 100000,
    };
    const limit = endUserLimits[profile?.plan || 'free'] || 100;
    if ((app.end_user_count || 0) >= limit) {
      return res.status(403).json({ message: 'This app has reached its user limit. Please upgrade.' });
    }

    // Create user
    const passwordHash = hashPassword(password);
    const { data: user, error } = await supabase
      .from('app_end_users')
      .insert({
        app_id: appId,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        display_name: display_name || email.split('@')[0],
        provider: 'email',
      })
      .select('id, email, display_name, avatar_url, profile_data, created_at')
      .single();

    if (error) throw error;

    const token = generateToken(user.id, appId);

    res.json({ user, token });
  } catch (e: any) {
    console.error('[SDK Auth] Signup error:', e.message);
    res.status(500).json({ message: e.message });
  }
});

// Sign in
router.post('/auth/signin', async (req: Request, res: Response) => {
  try {
    const appId = getAppId(req);
    const { email, password } = req.body;

    const { data: user } = await supabase
      .from('app_end_users')
      .select('*')
      .eq('app_id', appId)
      .eq('email', email.toLowerCase())
      .single();

    if (!user || !user.password_hash) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update last login
    await supabase
      .from('app_end_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    const token = generateToken(user.id, appId);
    const { password_hash, ...safeUser } = user;

    res.json({ user: safeUser, token });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// Sign out (just acknowledges — actual token invalidation is client-side)
router.post('/auth/signout', (_req: Request, res: Response) => {
  res.json({ success: true });
});

// Get current user
router.get('/auth/me', async (req: Request, res: Response) => {
  try {
    const auth = authenticateEndUser(req);
    if (!auth) return res.status(401).json({ message: 'Not authenticated' });

    const { data: user } = await supabase
      .from('app_end_users')
      .select('id, email, display_name, avatar_url, profile_data, created_at, updated_at')
      .eq('id', auth.userId)
      .eq('app_id', auth.appId)
      .single();

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// Update profile
router.patch('/auth/me', async (req: Request, res: Response) => {
  try {
    const auth = authenticateEndUser(req);
    if (!auth) return res.status(401).json({ message: 'Not authenticated' });

    const { display_name, avatar_url, profile_data } = req.body;
    const updates: Record<string, unknown> = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (profile_data !== undefined) updates.profile_data = profile_data;

    const { data: user, error } = await supabase
      .from('app_end_users')
      .update(updates)
      .eq('id', auth.userId)
      .eq('app_id', auth.appId)
      .select('id, email, display_name, avatar_url, profile_data, created_at, updated_at')
      .single();

    if (error) throw error;
    res.json({ user });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ─── DATA ROUTES (Collections) ──────────────────────────────────────────────

// List items in a collection
router.get('/data/:collection', async (req: Request, res: Response) => {
  try {
    const appId = getAppId(req);
    const collectionName = req.params.collection;
    const auth = authenticateEndUser(req);

    // Find collection
    const { data: collection } = await supabase
      .from('app_collections')
      .select('id')
      .eq('app_id', appId)
      .eq('name', collectionName)
      .single();

    if (!collection) {
      // Auto-create collection on first access
      const { data: newCol, error } = await supabase
        .from('app_collections')
        .insert({ app_id: appId, name: collectionName, schema: [] })
        .select('id')
        .single();
      if (error) throw error;
      return res.json([]);
    }

    // Build query
    let query = supabase
      .from('app_collection_items')
      .select('id, data, end_user_id, sort_order, created_at, updated_at')
      .eq('collection_id', collection.id)
      .eq('app_id', appId)
      .eq('is_archived', false);

    // Apply filters from query params
    const { _limit, _offset, _orderBy, _order, ...filters } = req.query;
    for (const [key, value] of Object.entries(filters)) {
      query = query.filter(`data->>${key}`, 'eq', value as string);
    }

    // Sort
    const orderField = (_orderBy as string) || 'created_at';
    const orderAsc = (_order as string) === 'asc';
    if (orderField === 'created_at' || orderField === 'updated_at' || orderField === 'sort_order') {
      query = query.order(orderField, { ascending: orderAsc });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Pagination
    const limit = Math.min(parseInt(_limit as string) || 100, 1000);
    const offset = parseInt(_offset as string) || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;

    // Flatten: return data field merged with id/timestamps
    const items = (data || []).map(item => ({
      id: item.id,
      ...item.data,
      _meta: {
        end_user_id: item.end_user_id,
        sort_order: item.sort_order,
        created_at: item.created_at,
        updated_at: item.updated_at,
      },
    }));

    res.json(items);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// Get count
router.get('/data/:collection/count', async (req: Request, res: Response) => {
  try {
    const appId = getAppId(req);
    const { data: collection } = await supabase
      .from('app_collections')
      .select('id')
      .eq('app_id', appId)
      .eq('name', req.params.collection)
      .single();

    if (!collection) return res.json({ count: 0 });

    const { count, error } = await supabase
      .from('app_collection_items')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', collection.id)
      .eq('is_archived', false);

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// Get single item
router.get('/data/:collection/:id', async (req: Request, res: Response) => {
  try {
    const appId = getAppId(req);
    const { data: item, error } = await supabase
      .from('app_collection_items')
      .select('id, data, end_user_id, sort_order, created_at, updated_at')
      .eq('id', req.params.id)
      .eq('app_id', appId)
      .single();

    if (error || !item) return res.status(404).json({ message: 'Item not found' });

    res.json({ id: item.id, ...item.data, _meta: {
      end_user_id: item.end_user_id,
      sort_order: item.sort_order,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }});
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// Add item to collection
router.post('/data/:collection', async (req: Request, res: Response) => {
  try {
    const appId = getAppId(req);
    const collectionName = req.params.collection;
    const auth = authenticateEndUser(req);
    const { data: itemData } = req.body;

    // Find or create collection
    let { data: collection } = await supabase
      .from('app_collections')
      .select('id')
      .eq('app_id', appId)
      .eq('name', collectionName)
      .single();

    if (!collection) {
      const { data: newCol, error } = await supabase
        .from('app_collections')
        .insert({ app_id: appId, name: collectionName, schema: [] })
        .select('id')
        .single();
      if (error) throw error;
      collection = newCol;
    }

    const { data: item, error } = await supabase
      .from('app_collection_items')
      .insert({
        collection_id: collection!.id,
        app_id: appId,
        end_user_id: auth?.userId || null,
        data: itemData || {},
      })
      .select('id, data, end_user_id, created_at, updated_at')
      .single();

    if (error) throw error;

    res.json({ id: item.id, ...item.data, _meta: {
      end_user_id: item.end_user_id,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }});
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// Update item
router.patch('/data/:collection/:id', async (req: Request, res: Response) => {
  try {
    const appId = getAppId(req);
    const { data: updates } = req.body;

    // Get existing item
    const { data: existing } = await supabase
      .from('app_collection_items')
      .select('data')
      .eq('id', req.params.id)
      .eq('app_id', appId)
      .single();

    if (!existing) return res.status(404).json({ message: 'Item not found' });

    // Merge data
    const merged = { ...existing.data, ...updates };

    const { data: item, error } = await supabase
      .from('app_collection_items')
      .update({ data: merged })
      .eq('id', req.params.id)
      .eq('app_id', appId)
      .select('id, data, end_user_id, created_at, updated_at')
      .single();

    if (error) throw error;

    res.json({ id: item.id, ...item.data, _meta: {
      end_user_id: item.end_user_id,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }});
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// Delete item
router.delete('/data/:collection/:id', async (req: Request, res: Response) => {
  try {
    const appId = getAppId(req);
    const { error } = await supabase
      .from('app_collection_items')
      .delete()
      .eq('id', req.params.id)
      .eq('app_id', appId);

    if (error) throw error;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ─── STORAGE ROUTES ─────────────────────────────────────────────────────────

// Upload file
router.post('/storage/upload', async (req: Request, res: Response) => {
  // TODO: Implement with multer + Supabase Storage
  res.status(501).json({ message: 'File upload coming soon' });
});

// List files
router.get('/storage/list', async (req: Request, res: Response) => {
  try {
    const appId = getAppId(req);
    const purpose = req.query.purpose as string;

    let query = supabase
      .from('app_files')
      .select('*')
      .eq('app_id', appId);

    if (purpose) query = query.eq('purpose', purpose);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// Delete file
router.delete('/storage/:fileId', async (req: Request, res: Response) => {
  try {
    const appId = getAppId(req);
    const { error } = await supabase
      .from('app_files')
      .delete()
      .eq('id', req.params.fileId)
      .eq('app_id', appId);
    if (error) throw error;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ─── NOTIFICATION ROUTES ────────────────────────────────────────────────────

// Subscribe to push
router.post('/notifications/subscribe', async (req: Request, res: Response) => {
  try {
    const appId = getAppId(req);
    const auth = authenticateEndUser(req);
    if (!auth) return res.status(401).json({ message: 'Not authenticated' });

    const { subscription } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ message: 'Invalid subscription' });

    await supabase.from('push_subscriptions').upsert({
      app_id: appId,
      end_user_id: auth.userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh || '',
      auth_key: subscription.keys?.auth || '',
      user_agent: req.headers['user-agent'],
    }, { onConflict: 'app_id,end_user_id,endpoint' });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// Send notification to user
router.post('/notifications/send', async (req: Request, res: Response) => {
  try {
    const appId = getAppId(req);
    const { end_user_id, title, body } = req.body;

    await supabase.from('app_notifications').insert({
      app_id: appId,
      end_user_id,
      title,
      body,
      status: 'pending',
    });

    // TODO: Actually send via Web Push API
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// Broadcast notification
router.post('/notifications/broadcast', async (req: Request, res: Response) => {
  try {
    const appId = getAppId(req);
    const { title, body } = req.body;

    await supabase.from('app_notifications').insert({
      app_id: appId,
      end_user_id: null, // NULL = broadcast
      title,
      body,
      status: 'pending',
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

export default router;

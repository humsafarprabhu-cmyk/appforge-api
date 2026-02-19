import { Router, Request, Response } from 'express';
import { requireAppId, requireAuth, requireRole } from './middleware/auth.ts';
import { rateLimit } from './middleware/rate-limit.ts';
import { createClient } from '@supabase/supabase-js';

const router = Router();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// All admin routes require admin role
router.use(requireAppId, requireAuth, requireRole('admin'));
router.use(rateLimit('reads'));

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────
router.get('/stats', async (req: Request, res: Response) => {
  const appId = (req as any).appId;
  try {
    // Get app info with end_user_count
    const { data: app } = await supabase
      .from('apps').select('end_user_count, blueprint').eq('id', appId).single();

    // Get collections count
    const { count: collectionsCount } = await supabase
      .from('app_collections').select('*', { count: 'exact', head: true }).eq('app_id', appId);

    // Get total items
    const { data: collections } = await supabase
      .from('app_collections').select('id').eq('app_id', appId);
    let totalItems = 0;
    if (collections && collections.length > 0) {
      const { count } = await supabase
        .from('app_collection_items')
        .select('*', { count: 'exact', head: true })
        .in('collection_id', collections.map(c => c.id))
        .eq('is_archived', false);
      totalItems = count || 0;
    }

    // Get recent signups (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentSignups } = await supabase
      .from('app_end_users')
      .select('*', { count: 'exact', head: true })
      .eq('app_id', appId)
      .gte('created_at', weekAgo);

    // Get files count
    const { count: filesCount } = await supabase
      .from('app_files').select('*', { count: 'exact', head: true }).eq('app_id', appId);

    // Recent audit log
    const { data: recentActivity } = await supabase
      .from('app_audit_log')
      .select('*')
      .eq('app_id', appId)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({
      users: app?.end_user_count || 0,
      collections: collectionsCount || 0,
      items: totalItems,
      files: filesCount || 0,
      recentSignups: recentSignups || 0,
      recentActivity: recentActivity || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────
router.get('/users', async (req: Request, res: Response) => {
  const appId = (req as any).appId;
  const limit = Math.min(parseInt(req.query._limit as string) || 50, 100);
  const offset = parseInt(req.query._offset as string) || 0;
  const search = req.query.search as string;
  const role = req.query.role as string;

  try {
    let query = supabase
      .from('app_end_users')
      .select('id, email, display_name, role, banned_at, created_at, updated_at', { count: 'exact' })
      .eq('app_id', appId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
    if (role) query = query.eq('role', role);

    const { data, count, error } = await query;
    if (error) throw error;

    res.json({ items: data || [], total: count || 0, limit, offset, hasMore: (offset + limit) < (count || 0) });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

router.get('/users/:userId', async (req: Request, res: Response) => {
  const appId = (req as any).appId;
  try {
    const { data, error } = await supabase
      .from('app_end_users')
      .select('*')
      .eq('app_id', appId)
      .eq('id', req.params.userId)
      .single();
    if (error || !data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

router.patch('/users/:userId/role', async (req: Request, res: Response) => {
  const appId = (req as any).appId;
  const { role } = req.body;
  if (!['admin', 'editor', 'user', 'guest'].includes(role)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid role' } });
  }
  try {
    const { data, error } = await supabase
      .from('app_end_users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('app_id', appId)
      .eq('id', req.params.userId)
      .select()
      .single();
    if (error) throw error;

    // Audit log
    await supabase.from('app_audit_log').insert({
      app_id: appId, end_user_id: req.params.userId,
      action: 'role_change', resource_type: 'user', resource_id: req.params.userId,
      details: { new_role: role },
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

router.post('/users/:userId/ban', async (req: Request, res: Response) => {
  const appId = (req as any).appId;
  try {
    const { data, error } = await supabase
      .from('app_end_users')
      .update({ banned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('app_id', appId)
      .eq('id', req.params.userId)
      .select()
      .single();
    if (error) throw error;

    await supabase.from('app_audit_log').insert({
      app_id: appId, end_user_id: req.params.userId,
      action: 'ban', resource_type: 'user', resource_id: req.params.userId,
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

router.post('/users/:userId/unban', async (req: Request, res: Response) => {
  const appId = (req as any).appId;
  try {
    const { data, error } = await supabase
      .from('app_end_users')
      .update({ banned_at: null, updated_at: new Date().toISOString() })
      .eq('app_id', appId)
      .eq('id', req.params.userId)
      .select()
      .single();
    if (error) throw error;

    await supabase.from('app_audit_log').insert({
      app_id: appId, end_user_id: req.params.userId,
      action: 'unban', resource_type: 'user', resource_id: req.params.userId,
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── DATA MANAGEMENT ─────────────────────────────────────────────────────
router.get('/collections', async (req: Request, res: Response) => {
  const appId = (req as any).appId;
  try {
    const { data, error } = await supabase
      .from('app_collections')
      .select('id, name, schema, settings, created_at')
      .eq('app_id', appId)
      .order('name');
    if (error) throw error;

    // Get item counts per collection
    const withCounts = await Promise.all((data || []).map(async (col) => {
      const { count } = await supabase
        .from('app_collection_items')
        .select('*', { count: 'exact', head: true })
        .eq('collection_id', col.id)
        .eq('is_archived', false);
      return { ...col, itemCount: count || 0 };
    }));

    res.json({ collections: withCounts });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

router.get('/collections/:collectionName/items', async (req: Request, res: Response) => {
  const appId = (req as any).appId;
  const limit = Math.min(parseInt(req.query._limit as string) || 50, 100);
  const offset = parseInt(req.query._offset as string) || 0;

  try {
    // Find collection
    const { data: col } = await supabase
      .from('app_collections')
      .select('id')
      .eq('app_id', appId)
      .eq('name', req.params.collectionName)
      .single();
    if (!col) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Collection not found' } });

    const { data, count, error } = await supabase
      .from('app_collection_items')
      .select('*', { count: 'exact' })
      .eq('collection_id', col.id)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    res.json({ items: data || [], total: count || 0, limit, offset, hasMore: (offset + limit) < (count || 0) });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// Delete item (admin bypass — no ownership check)
router.delete('/collections/:collectionName/items/:itemId', async (req: Request, res: Response) => {
  const appId = (req as any).appId;
  try {
    const { data: col } = await supabase
      .from('app_collections').select('id').eq('app_id', appId).eq('name', req.params.collectionName).single();
    if (!col) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Collection not found' } });

    const { error } = await supabase
      .from('app_collection_items').delete().eq('id', req.params.itemId).eq('collection_id', col.id);
    if (error) throw error;

    await supabase.from('app_audit_log').insert({
      app_id: appId, action: 'delete', resource_type: 'item',
      resource_id: req.params.itemId, details: { collection: req.params.collectionName },
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── AUDIT LOG ───────────────────────────────────────────────────────────
router.get('/audit-log', async (req: Request, res: Response) => {
  const appId = (req as any).appId;
  const limit = Math.min(parseInt(req.query._limit as string) || 50, 100);
  const offset = parseInt(req.query._offset as string) || 0;

  try {
    const { data, count, error } = await supabase
      .from('app_audit_log')
      .select('*', { count: 'exact' })
      .eq('app_id', appId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    res.json({ items: data || [], total: count || 0, limit, offset, hasMore: (offset + limit) < (count || 0) });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ─── DATA EXPORT ─────────────────────────────────────────────────────────
router.get('/export', async (req: Request, res: Response) => {
  const appId = (req as any).appId;
  const format = req.query.format as string || 'json';

  try {
    // Get all collections
    const { data: collections } = await supabase
      .from('app_collections').select('id, name, schema').eq('app_id', appId);

    const exportData: any = { app_id: appId, exported_at: new Date().toISOString(), collections: {} };

    for (const col of (collections || [])) {
      const { data: items } = await supabase
        .from('app_collection_items')
        .select('data, created_at, updated_at')
        .eq('collection_id', col.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      exportData.collections[col.name] = { schema: col.schema, items: items || [] };
    }

    // Get users
    const { data: users } = await supabase
      .from('app_end_users')
      .select('email, display_name, role, created_at')
      .eq('app_id', appId);
    exportData.users = users || [];

    if (format === 'csv') {
      // Flatten to CSV
      let csv = 'collection,field,value,created_at\n';
      for (const [name, col] of Object.entries(exportData.collections) as any) {
        for (const item of col.items) {
          for (const [k, v] of Object.entries(item.data || {})) {
            csv += `"${name}","${k}","${String(v).replace(/"/g, '""')}","${item.created_at}"\n`;
          }
        }
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=export.csv');
      return res.send(csv);
    }

    res.json(exportData);
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

export default router;

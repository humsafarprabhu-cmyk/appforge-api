/**
 * Data Service — CRUD with schema validation, relations, and ownership.
 * This is the core of what makes generated apps REAL.
 */
import { supabase } from '../middleware/auth.ts';
import { validateDataAgainstSchema } from '../middleware/validate.ts';
import type { Role } from '../middleware/auth.ts';

interface QueryOpts {
  limit: number;
  offset: number;
  orderBy?: string;
  order: 'asc' | 'desc';
  filters?: Record<string, string>;
  userId?: string;       // For ownership filtering
  userRole?: Role;       // For role-based access
  ownOnly?: boolean;     // Only return user's own items
}

interface CollectionInfo {
  id: string;
  name: string;
  schema: any[];
  settings?: {
    ownerReadOnly?: boolean;   // Users can only read their own items
    ownerWriteOnly?: boolean;  // Users can only write their own items
    publicRead?: boolean;      // Anyone can read (even guests)
    adminWriteOnly?: boolean;  // Only admins can write
  };
}

// ─── COLLECTION MANAGEMENT ──────────────────────────────────────────────────

async function getOrCreateCollection(appId: string, name: string): Promise<CollectionInfo> {
  // Try to find existing
  const { data: existing } = await supabase
    .from('app_collections')
    .select('id, name, schema, settings')
    .eq('app_id', appId)
    .eq('name', name)
    .single();

  if (existing) return existing as CollectionInfo;

  // Auto-create on first access
  const { data: created, error } = await supabase
    .from('app_collections')
    .insert({
      app_id: appId,
      name,
      schema: [],
      description: `Auto-created collection: ${name}`,
    })
    .select('id, name, schema, settings')
    .single();

  if (error) throw error;
  return created as CollectionInfo;
}

export async function listCollections(appId: string) {
  const { data, error } = await supabase
    .from('app_collections')
    .select('id, name, schema, settings, description, created_at')
    .eq('app_id', appId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function updateCollectionSchema(appId: string, collectionName: string, schema: any[], settings?: any) {
  const collection = await getOrCreateCollection(appId, collectionName);
  const updates: Record<string, unknown> = { schema };
  if (settings) updates.settings = settings;
  
  const { error } = await supabase
    .from('app_collections')
    .update(updates)
    .eq('id', collection.id)
    .eq('app_id', appId);
  if (error) throw error;
  return { success: true };
}

// ─── CRUD OPERATIONS ────────────────────────────────────────────────────────

export async function listItems(appId: string, collectionName: string, opts: QueryOpts) {
  const collection = await getOrCreateCollection(appId, collectionName);
  
  // Access control
  const settings = collection.settings || {};
  if (settings.ownerReadOnly && opts.userRole !== 'admin' && opts.userRole !== 'editor') {
    opts.ownOnly = true;
  }

  let query = supabase
    .from('app_collection_items')
    .select('id, data, end_user_id, sort_order, created_at, updated_at', { count: 'exact' })
    .eq('collection_id', collection.id)
    .eq('app_id', appId)
    .eq('is_archived', false);

  // Ownership filter
  if (opts.ownOnly && opts.userId) {
    query = query.eq('end_user_id', opts.userId);
  }

  // Dynamic filters (data->>key = value)
  if (opts.filters) {
    for (const [key, value] of Object.entries(opts.filters)) {
      query = query.filter(`data->>${key}`, 'eq', value);
    }
  }

  // Sort
  const safeOrderFields = ['created_at', 'updated_at', 'sort_order'];
  if (safeOrderFields.includes(opts.orderBy || '')) {
    query = query.order(opts.orderBy!, { ascending: opts.order === 'asc' });
  } else {
    query = query.order('created_at', { ascending: opts.order === 'asc' });
  }

  // Pagination
  const { data, count, error } = await query.range(opts.offset, opts.offset + opts.limit - 1);
  if (error) throw error;

  const items = (data || []).map(item => ({
    id: item.id,
    ...item.data as Record<string, unknown>,
    _meta: {
      owner_id: item.end_user_id,
      sort_order: item.sort_order,
      created_at: item.created_at,
      updated_at: item.updated_at,
    },
  }));

  return {
    items,
    total: count || 0,
    limit: opts.limit,
    offset: opts.offset,
    hasMore: (opts.offset + opts.limit) < (count || 0),
  };
}

export async function getItem(appId: string, collectionName: string, itemId: string, userId?: string, userRole?: Role) {
  const collection = await getOrCreateCollection(appId, collectionName);

  let query = supabase
    .from('app_collection_items')
    .select('id, data, end_user_id, sort_order, created_at, updated_at')
    .eq('id', itemId)
    .eq('app_id', appId);

  // Ownership check for non-admin
  const settings = collection.settings || {};
  if (settings.ownerReadOnly && userRole !== 'admin' && userRole !== 'editor' && userId) {
    query = query.eq('end_user_id', userId);
  }

  const { data: item, error } = await query.single();
  if (error || !item) throw Object.assign(new Error('Item not found'), { status: 404 });

  return {
    id: item.id,
    ...item.data as Record<string, unknown>,
    _meta: {
      owner_id: item.end_user_id,
      sort_order: item.sort_order,
      created_at: item.created_at,
      updated_at: item.updated_at,
    },
  };
}

export async function createItem(
  appId: string, 
  collectionName: string, 
  data: Record<string, unknown>, 
  userId?: string,
  userRole?: Role
) {
  const collection = await getOrCreateCollection(appId, collectionName);

  // Access control
  const settings = collection.settings || {};
  if (settings.adminWriteOnly && userRole !== 'admin') {
    throw Object.assign(new Error('Only admins can add items to this collection'), { status: 403 });
  }

  // Schema validation (if schema exists)
  if (collection.schema && collection.schema.length > 0) {
    const errors = validateDataAgainstSchema(data, collection.schema);
    if (errors.length > 0) {
      throw Object.assign(new Error(`Validation failed: ${errors.join('; ')}`), { status: 400 });
    }
  }

  // Resolve relations
  const resolvedData = await resolveRelations(appId, collection, data);

  const { data: item, error } = await supabase
    .from('app_collection_items')
    .insert({
      collection_id: collection.id,
      app_id: appId,
      end_user_id: userId || null,
      data: resolvedData,
    })
    .select('id, data, end_user_id, created_at, updated_at')
    .single();
  if (error) throw error;

  return {
    id: item.id,
    ...item.data as Record<string, unknown>,
    _meta: {
      owner_id: item.end_user_id,
      created_at: item.created_at,
      updated_at: item.updated_at,
    },
  };
}

export async function updateItem(
  appId: string, 
  collectionName: string, 
  itemId: string, 
  data: Record<string, unknown>,
  userId?: string,
  userRole?: Role
) {
  const collection = await getOrCreateCollection(appId, collectionName);

  // Access control
  const settings = collection.settings || {};
  if (settings.adminWriteOnly && userRole !== 'admin') {
    throw Object.assign(new Error('Only admins can edit items in this collection'), { status: 403 });
  }

  // Get existing
  let existingQuery = supabase
    .from('app_collection_items')
    .select('id, data, end_user_id')
    .eq('id', itemId)
    .eq('app_id', appId);

  // Ownership check
  if (settings.ownerWriteOnly && userRole !== 'admin' && userRole !== 'editor' && userId) {
    existingQuery = existingQuery.eq('end_user_id', userId);
  }

  const { data: existing } = await existingQuery.single();
  if (!existing) throw Object.assign(new Error('Item not found'), { status: 404 });

  // Merge
  const merged = { ...existing.data as Record<string, unknown>, ...data };

  // Validate merged data
  if (collection.schema && collection.schema.length > 0) {
    const errors = validateDataAgainstSchema(merged, collection.schema);
    if (errors.length > 0) {
      throw Object.assign(new Error(`Validation failed: ${errors.join('; ')}`), { status: 400 });
    }
  }

  const { data: item, error } = await supabase
    .from('app_collection_items')
    .update({ data: merged })
    .eq('id', itemId)
    .eq('app_id', appId)
    .select('id, data, end_user_id, created_at, updated_at')
    .single();
  if (error) throw error;

  return {
    id: item.id,
    ...item.data as Record<string, unknown>,
    _meta: {
      owner_id: item.end_user_id,
      created_at: item.created_at,
      updated_at: item.updated_at,
    },
  };
}

export async function deleteItem(appId: string, collectionName: string, itemId: string, userId?: string, userRole?: Role) {
  const collection = await getOrCreateCollection(appId, collectionName);
  
  const settings = collection.settings || {};
  let query = supabase
    .from('app_collection_items')
    .delete()
    .eq('id', itemId)
    .eq('app_id', appId);

  if (settings.ownerWriteOnly && userRole !== 'admin' && userRole !== 'editor' && userId) {
    query = query.eq('end_user_id', userId);
  }

  const { error } = await query;
  if (error) throw error;
  return { success: true };
}

export async function countItems(appId: string, collectionName: string) {
  const collection = await getOrCreateCollection(appId, collectionName);
  const { count, error } = await supabase
    .from('app_collection_items')
    .select('*', { count: 'exact', head: true })
    .eq('collection_id', collection.id)
    .eq('is_archived', false);
  if (error) throw error;
  return { count: count || 0 };
}

// ─── BULK OPERATIONS (Admin) ────────────────────────────────────────────────

export async function bulkDelete(appId: string, collectionName: string, itemIds: string[]) {
  const collection = await getOrCreateCollection(appId, collectionName);
  const { error } = await supabase
    .from('app_collection_items')
    .delete()
    .in('id', itemIds)
    .eq('app_id', appId);
  if (error) throw error;
  return { deleted: itemIds.length };
}

export async function bulkArchive(appId: string, collectionName: string, itemIds: string[]) {
  const collection = await getOrCreateCollection(appId, collectionName);
  const { error } = await supabase
    .from('app_collection_items')
    .update({ is_archived: true })
    .in('id', itemIds)
    .eq('app_id', appId);
  if (error) throw error;
  return { archived: itemIds.length };
}

// ─── RELATION RESOLUTION ────────────────────────────────────────────────────

async function resolveRelations(appId: string, collection: CollectionInfo, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!collection.schema || collection.schema.length === 0) return data;

  const resolved = { ...data };
  for (const field of collection.schema) {
    if (field.relation && resolved[field.name]) {
      // Verify the referenced item exists
      const refCollection = await getOrCreateCollection(appId, field.relation.collection);
      const refId = resolved[field.name] as string;
      
      const { data: refItem } = await supabase
        .from('app_collection_items')
        .select('id')
        .eq('id', refId)
        .eq('collection_id', refCollection.id)
        .single();

      if (!refItem) {
        throw Object.assign(
          new Error(`Referenced item not found: ${field.relation.collection}/${refId}`),
          { status: 400 }
        );
      }
    }
  }
  return resolved;
}

// ─── AGGREGATIONS (for dashboards) ─────────────────────────────────────────

export async function getStats(appId: string) {
  const collections = await listCollections(appId);
  const stats: Record<string, { count: number; lastUpdated: string | null }> = {};

  for (const col of collections) {
    const { count } = await supabase
      .from('app_collection_items')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', col.id)
      .eq('is_archived', false);

    const { data: latest } = await supabase
      .from('app_collection_items')
      .select('updated_at')
      .eq('collection_id', col.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    stats[col.name] = {
      count: count || 0,
      lastUpdated: latest?.updated_at || null,
    };
  }

  return stats;
}

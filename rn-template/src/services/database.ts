import { config } from '../config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from 'react-native-async-storage/async-storage';

// Initialize based on mode
let supabase: SupabaseClient | null = null;

if (config.mode === 'self-managed' && config.supabaseUrl && config.supabaseAnonKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { storage: AsyncStorage as any, autoRefreshToken: true, persistSession: true },
  });
}

interface QueryOptions {
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  offset?: number;
  filters?: Record<string, any>;
}

class Database {
  // ─── LIST ──────────────────────────────────────────────────────
  async list(collection: string, options: QueryOptions = {}): Promise<any[]> {
    if (config.mode === 'managed') {
      const params = new URLSearchParams();
      if (options.limit) params.set('limit', String(options.limit));
      if (options.offset) params.set('offset', String(options.offset));
      if (options.orderBy) params.set('orderBy', options.orderBy);

      const res = await fetch(
        `${config.appforgeApiUrl}/sdk/${config.appId}/data/${collection}?${params}`,
        { headers: this._headers() }
      );
      const data = await res.json();
      return data.items || [];
    }

    if (!supabase) return this._localList(collection);

    let query = supabase.from(collection).select('*');
    if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending ?? false });
    if (options.limit) query = query.limit(options.limit);
    if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    if (options.filters) {
      for (const [key, val] of Object.entries(options.filters)) {
        query = query.eq(key, val);
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  }

  // ─── GET ───────────────────────────────────────────────────────
  async get(collection: string, id: string): Promise<any | null> {
    if (config.mode === 'managed') {
      const res = await fetch(
        `${config.appforgeApiUrl}/sdk/${config.appId}/data/${collection}/${id}`,
        { headers: this._headers() }
      );
      return res.json();
    }

    if (!supabase) return this._localGet(collection, id);

    const { data, error } = await supabase.from(collection).select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ─── ADD ───────────────────────────────────────────────────────
  async add(collection: string, item: Record<string, any>): Promise<any> {
    if (config.mode === 'managed') {
      const res = await fetch(
        `${config.appforgeApiUrl}/sdk/${config.appId}/data/${collection}`,
        { method: 'POST', headers: this._headers(), body: JSON.stringify(item) }
      );
      return res.json();
    }

    if (!supabase) return this._localAdd(collection, item);

    const { data, error } = await supabase.from(collection).insert(item).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ─── UPDATE ────────────────────────────────────────────────────
  async update(collection: string, id: string, updates: Record<string, any>): Promise<any> {
    if (config.mode === 'managed') {
      const res = await fetch(
        `${config.appforgeApiUrl}/sdk/${config.appId}/data/${collection}/${id}`,
        { method: 'PUT', headers: this._headers(), body: JSON.stringify(updates) }
      );
      return res.json();
    }

    if (!supabase) return this._localUpdate(collection, id, updates);

    const { data, error } = await supabase.from(collection).update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ─── DELETE ────────────────────────────────────────────────────
  async remove(collection: string, id: string): Promise<void> {
    if (config.mode === 'managed') {
      await fetch(
        `${config.appforgeApiUrl}/sdk/${config.appId}/data/${collection}/${id}`,
        { method: 'DELETE', headers: this._headers() }
      );
      return;
    }

    if (!supabase) return this._localRemove(collection, id);

    const { error } = await supabase.from(collection).delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ─── LOCAL FALLBACK (AsyncStorage) ─────────────────────────────
  private async _localList(collection: string): Promise<any[]> {
    const raw = await AsyncStorage.getItem(`@db:${collection}`);
    return raw ? JSON.parse(raw) : [];
  }

  private async _localGet(collection: string, id: string): Promise<any | null> {
    const items = await this._localList(collection);
    return items.find((i: any) => i.id === id) || null;
  }

  private async _localAdd(collection: string, item: Record<string, any>): Promise<any> {
    const items = await this._localList(collection);
    const newItem = { ...item, id: item.id || Date.now().toString(36), created_at: new Date().toISOString() };
    items.push(newItem);
    await AsyncStorage.setItem(`@db:${collection}`, JSON.stringify(items));
    return newItem;
  }

  private async _localUpdate(collection: string, id: string, updates: Record<string, any>): Promise<any> {
    const items = await this._localList(collection);
    const idx = items.findIndex((i: any) => i.id === id);
    if (idx === -1) throw new Error('Not found');
    items[idx] = { ...items[idx], ...updates, updated_at: new Date().toISOString() };
    await AsyncStorage.setItem(`@db:${collection}`, JSON.stringify(items));
    return items[idx];
  }

  private async _localRemove(collection: string, id: string): Promise<void> {
    const items = await this._localList(collection);
    const filtered = items.filter((i: any) => i.id !== id);
    await AsyncStorage.setItem(`@db:${collection}`, JSON.stringify(filtered));
  }

  // ─── AUTH HEADERS ──────────────────────────────────────────────
  private _headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    // Token would be added from auth service
    return headers;
  }
}

export const db = new Database();

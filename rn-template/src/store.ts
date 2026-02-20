/**
 * Simple reactive store using AsyncStorage.
 * Each app gets a collection-based data store.
 * No server needed — everything is local.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useCallback } from 'react';

export interface StoreItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  meta?: string;
  color?: string;
  completed?: boolean;
  createdAt: string;
  data?: Record<string, any>;
}

const STORE_KEY = '@appforge_items';
let _items: StoreItem[] = [];
let _listeners: Set<() => void> = new Set();

function notify() {
  _listeners.forEach(fn => fn());
}

async function _load(): Promise<StoreItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    _items = raw ? JSON.parse(raw) : [];
  } catch {
    _items = [];
  }
  return _items;
}

async function _save() {
  await AsyncStorage.setItem(STORE_KEY, JSON.stringify(_items));
  notify();
}

export const store = {
  async init() {
    await _load();
    notify();
  },

  getAll(): StoreItem[] {
    return [..._items];
  },

  getById(id: string): StoreItem | undefined {
    return _items.find(i => i.id === id);
  },

  async add(item: Omit<StoreItem, 'id' | 'createdAt'>): Promise<StoreItem> {
    const newItem: StoreItem = {
      ...item,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
    };
    _items.unshift(newItem);
    await _save();
    return newItem;
  },

  async update(id: string, updates: Partial<StoreItem>): Promise<void> {
    const idx = _items.findIndex(i => i.id === id);
    if (idx >= 0) {
      _items[idx] = { ..._items[idx], ...updates };
      await _save();
    }
  },

  async remove(id: string): Promise<void> {
    _items = _items.filter(i => i.id !== id);
    await _save();
  },

  async toggle(id: string): Promise<void> {
    const idx = _items.findIndex(i => i.id === id);
    if (idx >= 0) {
      _items[idx].completed = !_items[idx].completed;
      await _save();
    }
  },

  getStats() {
    const total = _items.length;
    const completed = _items.filter(i => i.completed).length;
    const active = total - completed;
    const today = _items.filter(i => {
      const d = new Date(i.createdAt);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    return { total, completed, active, today };
  },
};

/** React hook — re-renders on store changes */
export function useStore() {
  const [items, setItems] = useState<StoreItem[]>(_items);
  const [stats, setStats] = useState(store.getStats());

  useEffect(() => {
    const update = () => {
      setItems(store.getAll());
      setStats(store.getStats());
    };
    _listeners.add(update);
    // Initial load
    store.init().then(update);
    return () => { _listeners.delete(update); };
  }, []);

  return { items, stats, ...store };
}

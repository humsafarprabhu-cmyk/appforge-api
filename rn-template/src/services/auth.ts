import { config } from '../config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

let supabase: SupabaseClient | null = null;

if (config.mode === 'self-managed' && config.supabaseUrl && config.supabaseAnonKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { storage: AsyncStorage as any, autoRefreshToken: true, persistSession: true },
  });
}

interface User {
  id: string;
  email: string;
  displayName?: string;
  avatar?: string;
}

class AuthService {
  private _user: User | null = null;
  private _token: string | null = null;
  private _listeners: Set<(user: User | null) => void> = new Set();

  // ─── SIGN UP ───────────────────────────────────────────────────
  async signUp(email: string, password: string, displayName?: string): Promise<User> {
    if (config.mode === 'managed') {
      const res = await fetch(`${config.appforgeApiUrl}/sdk/${config.appId}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, display_name: displayName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      this._token = data.token;
      this._user = data.user;
      await SecureStore.setItemAsync('auth_token', data.token);
      this._notify();
      return data.user;
    }

    if (!supabase) throw new Error('Auth not configured');
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw new Error(error.message);
    this._user = {
      id: data.user!.id,
      email: data.user!.email!,
      displayName: displayName || data.user!.email!.split('@')[0],
    };
    this._notify();
    return this._user;
  }

  // ─── SIGN IN ───────────────────────────────────────────────────
  async signIn(email: string, password: string): Promise<User> {
    if (config.mode === 'managed') {
      const res = await fetch(`${config.appforgeApiUrl}/sdk/${config.appId}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      this._token = data.token;
      this._user = data.user;
      await SecureStore.setItemAsync('auth_token', data.token);
      this._notify();
      return data.user;
    }

    if (!supabase) throw new Error('Auth not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    this._user = {
      id: data.user.id,
      email: data.user.email!,
      displayName: data.user.user_metadata?.display_name || data.user.email!.split('@')[0],
    };
    this._notify();
    return this._user;
  }

  // ─── SIGN OUT ──────────────────────────────────────────────────
  async signOut(): Promise<void> {
    if (config.mode === 'managed') {
      await SecureStore.deleteItemAsync('auth_token');
    } else if (supabase) {
      await supabase.auth.signOut();
    }
    this._user = null;
    this._token = null;
    this._notify();
  }

  // ─── GET USER ──────────────────────────────────────────────────
  getUser(): User | null { return this._user; }
  isLoggedIn(): boolean { return this._user !== null; }
  getToken(): string | null { return this._token; }

  // ─── RESTORE SESSION ──────────────────────────────────────────
  async restoreSession(): Promise<User | null> {
    if (config.mode === 'managed') {
      const token = await SecureStore.getItemAsync('auth_token');
      if (!token) return null;
      try {
        const res = await fetch(`${config.appforgeApiUrl}/sdk/${config.appId}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Session expired');
        const data = await res.json();
        this._token = token;
        this._user = data.user;
        this._notify();
        return this._user;
      } catch {
        await SecureStore.deleteItemAsync('auth_token');
        return null;
      }
    }

    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      this._user = {
        id: data.session.user.id,
        email: data.session.user.email!,
        displayName: data.session.user.user_metadata?.display_name,
      };
      this._notify();
      return this._user;
    }
    return null;
  }

  // ─── LISTENERS ─────────────────────────────────────────────────
  onAuthChange(callback: (user: User | null) => void): () => void {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  private _notify() {
    this._listeners.forEach(cb => cb(this._user));
  }
}

export const auth = new AuthService();

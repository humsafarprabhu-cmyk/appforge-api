/**
 * Auth Service — handles all authentication logic.
 * Signup, signin, password reset, role management, token refresh.
 */
import { supabase, hashPassword, verifyPassword, generateToken, generateResetToken, Role } from '../middleware/auth.ts';

interface SignupParams {
  appId: string;
  email: string;
  password: string;
  display_name?: string;
  role?: Role;
}

interface AuthResult {
  user: Record<string, unknown>;
  token: string;
}

// Plan-based end-user limits
const END_USER_LIMITS: Record<string, number> = {
  free: 100,
  maker: 1000,
  pro: 10000,
  agency: 100000,
};

export async function signup(params: SignupParams): Promise<AuthResult> {
  const { appId, email, password, display_name, role = 'user' } = params;

  // Check duplicate
  const { data: existing } = await supabase
    .from('app_end_users')
    .select('id')
    .eq('app_id', appId)
    .eq('email', email)
    .single();
  if (existing) throw Object.assign(new Error('An account with this email already exists'), { status: 409 });

  // Check user limit
  const { data: app } = await supabase
    .from('apps')
    .select('end_user_count, user_id')
    .eq('id', appId)
    .single();
  if (!app) throw Object.assign(new Error('App not found'), { status: 404 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', app.user_id)
    .single();
  const limit = END_USER_LIMITS[profile?.plan || 'free'] || 100;
  if ((app.end_user_count || 0) >= limit) {
    throw Object.assign(new Error('This app has reached its user limit'), { status: 403 });
  }

  // Determine if this is the first user (auto-admin)
  const { count } = await supabase
    .from('app_end_users')
    .select('*', { count: 'exact', head: true })
    .eq('app_id', appId);
  const assignedRole: Role = count === 0 ? 'admin' : role;

  const passwordHash = hashPassword(password);
  const { data: user, error } = await supabase
    .from('app_end_users')
    .insert({
      app_id: appId,
      email,
      password_hash: passwordHash,
      display_name: display_name || email.split('@')[0],
      provider: 'email',
      role: assignedRole,
    })
    .select('id, email, display_name, avatar_url, role, profile_data, created_at')
    .single();
  if (error) throw error;

  // Increment end_user_count
  await supabase.rpc('increment_end_user_count', { app_uuid: appId }).catch(() => {});

  const token = generateToken(user.id, appId, user.role as Role);
  return { user, token };
}

export async function signin(appId: string, email: string, password: string): Promise<AuthResult> {
  const { data: user } = await supabase
    .from('app_end_users')
    .select('*')
    .eq('app_id', appId)
    .eq('email', email)
    .single();
  if (!user || !user.password_hash) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  if (user.banned_at) {
    throw Object.assign(new Error('This account has been suspended'), { status: 403 });
  }

  if (!verifyPassword(password, user.password_hash)) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  await supabase
    .from('app_end_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  const { password_hash, ...safeUser } = user;
  const token = generateToken(user.id, appId, user.role as Role);
  return { user: safeUser, token };
}

export async function getUser(userId: string, appId: string) {
  const { data: user } = await supabase
    .from('app_end_users')
    .select('id, email, display_name, avatar_url, role, profile_data, created_at, updated_at')
    .eq('id', userId)
    .eq('app_id', appId)
    .single();
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

export async function updateProfile(userId: string, appId: string, updates: Record<string, unknown>) {
  const { data: user, error } = await supabase
    .from('app_end_users')
    .update(updates)
    .eq('id', userId)
    .eq('app_id', appId)
    .select('id, email, display_name, avatar_url, role, profile_data, created_at, updated_at')
    .single();
  if (error) throw error;
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

export async function requestPasswordReset(appId: string, email: string) {
  const { data: user } = await supabase
    .from('app_end_users')
    .select('id')
    .eq('app_id', appId)
    .eq('email', email)
    .single();
  
  // Always return success to prevent email enumeration
  if (!user) return { success: true };

  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  await supabase
    .from('app_end_users')
    .update({ 
      reset_token: token,
      reset_token_expires: expiresAt,
    })
    .eq('id', user.id);

  // TODO: Send email with reset link
  // For now, return token directly (dev mode)
  return { success: true, token }; // Remove token from response in production
}

export async function resetPassword(appId: string, token: string, newPassword: string) {
  const { data: user } = await supabase
    .from('app_end_users')
    .select('id, reset_token_expires')
    .eq('app_id', appId)
    .eq('reset_token', token)
    .single();

  if (!user) throw Object.assign(new Error('Invalid or expired reset token'), { status: 400 });
  if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
    throw Object.assign(new Error('Reset token has expired'), { status: 400 });
  }

  const passwordHash = hashPassword(newPassword);
  await supabase
    .from('app_end_users')
    .update({ 
      password_hash: passwordHash,
      reset_token: null,
      reset_token_expires: null,
    })
    .eq('id', user.id);

  return { success: true };
}

// ─── ADMIN FUNCTIONS ────────────────────────────────────────────────────────

export async function listUsers(appId: string, opts: { limit: number; offset: number; search?: string; role?: Role }) {
  let query = supabase
    .from('app_end_users')
    .select('id, email, display_name, avatar_url, role, last_login_at, banned_at, created_at', { count: 'exact' })
    .eq('app_id', appId);

  if (opts.search) {
    query = query.or(`email.ilike.%${opts.search}%,display_name.ilike.%${opts.search}%`);
  }
  if (opts.role) {
    query = query.eq('role', opts.role);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  if (error) throw error;
  return {
    users: data || [],
    total: count || 0,
    limit: opts.limit,
    offset: opts.offset,
    hasMore: (opts.offset + opts.limit) < (count || 0),
  };
}

export async function updateUserRole(appId: string, userId: string, role: Role) {
  const { data, error } = await supabase
    .from('app_end_users')
    .update({ role })
    .eq('id', userId)
    .eq('app_id', appId)
    .select('id, email, display_name, role')
    .single();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('User not found'), { status: 404 });
  return data;
}

export async function banUser(appId: string, userId: string) {
  const { error } = await supabase
    .from('app_end_users')
    .update({ banned_at: new Date().toISOString() })
    .eq('id', userId)
    .eq('app_id', appId);
  if (error) throw error;
  return { success: true };
}

export async function unbanUser(appId: string, userId: string) {
  const { error } = await supabase
    .from('app_end_users')
    .update({ banned_at: null })
    .eq('id', userId)
    .eq('app_id', appId);
  if (error) throw error;
  return { success: true };
}

/**
 * AppForge Runtime — Client-side SDK for generated apps.
 * This is embedded in EVERY generated app. It handles:
 * - Auth (signup, login, logout, session persistence)
 * - Data (CRUD on collections)
 * - Forms (auto-binding, validation, submission)
 * - UI (toasts, loading states, error states, empty states)
 * - Navigation (screen switching, deep links, back button)
 * - Offline detection + queue
 * 
 * ~15KB minified. Zero dependencies.
 */
(function(window) {
  'use strict';

  const AF = {};
  let _config = { apiUrl: '', appId: '', debug: false };
  let _auth = { user: null, token: null };
  let _listeners = {};
  let _offlineQueue = [];
  let _toastTimeout = null;

  // ─── INIT ───────────────────────────────────────────────────────────────
  AF.init = function(config) {
    _config = { ..._config, ...config };
    // Restore session from localStorage
    try {
      const saved = localStorage.getItem('af_auth_' + _config.appId);
      if (saved) {
        const parsed = JSON.parse(saved);
        _auth = parsed;
        AF.emit('auth:changed', _auth.user);
      }
    } catch(e) {}
    
    // Offline detection
    window.addEventListener('online', function() { AF.emit('network:online'); _flushOfflineQueue(); });
    window.addEventListener('offline', function() { AF.emit('network:offline'); });

    // Handle back button
    window.addEventListener('popstate', function(e) {
      if (e.state && e.state.screen) AF.navigate(e.state.screen, false);
    });

    // Auto-bind data-af elements after DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _autoBind);
    } else {
      setTimeout(_autoBind, 0);
    }

    if (_config.debug) console.log('[AppForge] Initialized', _config);
    AF.emit('ready');
  };

  // ─── HTTP CLIENT ────────────────────────────────────────────────────────
  async function api(method, path, body, opts = {}) {
    if (!navigator.onLine && !opts.force) {
      if (method !== 'GET') {
        _offlineQueue.push({ method, path, body });
        AF.toast('Saved offline. Will sync when connected.', 'info');
        return { _offline: true };
      }
      throw new Error('You are offline');
    }

    const headers = { 'Content-Type': 'application/json', 'X-App-Id': _config.appId };
    if (_auth.token) headers['Authorization'] = 'Bearer ' + _auth.token;

    try {
      const res = await fetch(_config.apiUrl + '/sdk' + path, {
        method, headers, body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      
      if (!res.ok) {
        const errMsg = data.error?.message || data.message || 'Request failed';
        const err = new Error(errMsg);
        err.code = data.error?.code || 'UNKNOWN';
        err.status = res.status;
        err.details = data.error?.details;
        throw err;
      }
      return data;
    } catch(e) {
      if (e.code) throw e; // Already formatted
      throw new Error('Network error. Check your connection.');
    }
  }

  function _flushOfflineQueue() {
    if (_offlineQueue.length === 0) return;
    const queue = [..._offlineQueue];
    _offlineQueue = [];
    AF.toast('Syncing ' + queue.length + ' offline changes...', 'info');
    queue.forEach(function(req) {
      api(req.method, req.path, req.body, { force: true }).catch(function() {
        _offlineQueue.push(req); // Re-queue on failure
      });
    });
  }

  // ─── AUTH ───────────────────────────────────────────────────────────────
  AF.auth = {
    get user() { return _auth.user; },
    get token() { return _auth.token; },
    get isLoggedIn() { return !!_auth.user; },
    get isAdmin() { return _auth.user?.role === 'admin'; },
    get isEditor() { return _auth.user?.role === 'editor' || _auth.user?.role === 'admin'; },

    signup: async function(email, password, displayName) {
      const data = await api('POST', '/auth/signup', { email, password, display_name: displayName });
      _setAuth(data.user, data.token);
      return data.user;
    },

    login: async function(email, password) {
      const data = await api('POST', '/auth/signin', { email, password });
      _setAuth(data.user, data.token);
      return data.user;
    },

    logout: function() {
      _auth = { user: null, token: null };
      localStorage.removeItem('af_auth_' + _config.appId);
      AF.emit('auth:changed', null);
      AF.emit('auth:logout');
    },

    getUser: async function() {
      if (!_auth.token) return null;
      const data = await api('GET', '/auth/me');
      _auth.user = data.user;
      AF.emit('auth:changed', data.user);
      return data.user;
    },

    updateProfile: async function(updates) {
      const data = await api('PATCH', '/auth/me', updates);
      _auth.user = data.user;
      _saveAuth();
      AF.emit('auth:changed', data.user);
      return data.user;
    },

    requestReset: async function(email) {
      return api('POST', '/auth/reset-request', { email });
    },

    resetPassword: async function(token, newPassword) {
      return api('POST', '/auth/reset', { token, new_password: newPassword });
    },
  };

  function _setAuth(user, token) {
    _auth = { user, token };
    _saveAuth();
    AF.emit('auth:changed', user);
    AF.emit('auth:login', user);
  }

  function _saveAuth() {
    try { localStorage.setItem('af_auth_' + _config.appId, JSON.stringify(_auth)); } catch(e) {}
  }

  // ─── DATA (Collections) ────────────────────────────────────────────────
  AF.data = {
    list: async function(collection, opts) {
      opts = opts || {};
      const params = new URLSearchParams();
      if (opts.limit) params.set('_limit', opts.limit);
      if (opts.offset) params.set('_offset', opts.offset);
      if (opts.orderBy) params.set('_orderBy', opts.orderBy);
      if (opts.order) params.set('_order', opts.order);
      if (opts.filters) {
        Object.entries(opts.filters).forEach(function(kv) { params.set(kv[0], kv[1]); });
      }
      const qs = params.toString();
      return api('GET', '/data/' + collection + (qs ? '?' + qs : ''));
    },

    get: async function(collection, id) {
      return api('GET', '/data/' + collection + '/' + id);
    },

    create: async function(collection, data) {
      return api('POST', '/data/' + collection, { data: data });
    },

    update: async function(collection, id, data) {
      return api('PATCH', '/data/' + collection + '/' + id, { data: data });
    },

    delete: async function(collection, id) {
      return api('DELETE', '/data/' + collection + '/' + id);
    },

    count: async function(collection) {
      const res = await api('GET', '/data/' + collection + '/count');
      return res.count;
    },

    stats: async function() {
      return api('GET', '/data/_stats');
    },
  };

  // ─── FORMS ──────────────────────────────────────────────────────────────
  AF.forms = {
    /**
     * Bind a form to a collection. Handles validation + submission.
     * Usage: AF.forms.bind('#my-form', 'todos', { onSuccess: fn, onError: fn })
     */
    bind: function(selector, collection, opts) {
      opts = opts || {};
      const form = document.querySelector(selector);
      if (!form) return console.warn('[AppForge] Form not found:', selector);

      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = form.querySelector('[type="submit"]');
        const originalText = submitBtn?.textContent;

        // Gather data
        const formData = new FormData(form);
        const data = {};
        formData.forEach(function(value, key) {
          // Handle checkboxes
          if (form.querySelector('[name="'+key+'"]')?.type === 'checkbox') {
            data[key] = form.querySelector('[name="'+key+'"]').checked;
          } else if (value !== '') {
            // Try to parse numbers
            const num = Number(value);
            data[key] = (!isNaN(num) && value.trim() !== '') ? num : value;
          }
        });

        // Client-side validation
        const errors = _validateForm(form);
        if (errors.length > 0) {
          errors.forEach(function(err) { _showFieldError(form, err.field, err.message); });
          if (opts.onError) opts.onError(errors);
          return;
        }

        // Submit
        _clearFieldErrors(form);
        if (submitBtn) { submitBtn.textContent = 'Saving...'; submitBtn.disabled = true; }

        try {
          let result;
          const editId = form.dataset.editId;
          if (editId) {
            result = await AF.data.update(collection, editId, data);
          } else {
            result = await AF.data.create(collection, data);
          }
          
          AF.toast(editId ? 'Updated successfully!' : 'Created successfully!', 'success');
          if (!editId) form.reset();
          if (opts.onSuccess) opts.onSuccess(result);
          AF.emit('data:changed', { collection, action: editId ? 'update' : 'create', item: result });
        } catch(err) {
          AF.toast(err.message, 'error');
          if (err.details && Array.isArray(err.details)) {
            err.details.forEach(function(d) { _showFieldError(form, d.field, d.message); });
          }
          if (opts.onError) opts.onError(err);
        } finally {
          if (submitBtn) { submitBtn.textContent = originalText; submitBtn.disabled = false; }
        }
      });
    },

    /**
     * Populate a form with existing data (for editing).
     */
    populate: function(selector, data) {
      const form = document.querySelector(selector);
      if (!form || !data) return;
      Object.entries(data).forEach(function(kv) {
        const field = form.querySelector('[name="'+kv[0]+'"]');
        if (!field) return;
        if (field.type === 'checkbox') field.checked = !!kv[1];
        else field.value = kv[1] || '';
      });
    },
  };

  function _validateForm(form) {
    const errors = [];
    form.querySelectorAll('[required]').forEach(function(field) {
      if (!field.value.trim()) {
        errors.push({ field: field.name, message: 'This field is required' });
      }
    });
    form.querySelectorAll('[type="email"]').forEach(function(field) {
      if (field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
        errors.push({ field: field.name, message: 'Please enter a valid email' });
      }
    });
    form.querySelectorAll('[minlength]').forEach(function(field) {
      if (field.value && field.value.length < parseInt(field.minLength)) {
        errors.push({ field: field.name, message: 'Minimum ' + field.minLength + ' characters' });
      }
    });
    return errors;
  }

  function _showFieldError(form, fieldName, message) {
    const field = form.querySelector('[name="'+fieldName+'"]');
    if (!field) return;
    field.style.borderColor = '#ef4444';
    let errEl = field.parentElement.querySelector('.af-field-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.className = 'af-field-error';
      errEl.style.cssText = 'color:#ef4444;font-size:12px;margin-top:4px;';
      field.parentElement.appendChild(errEl);
    }
    errEl.textContent = message;
  }

  function _clearFieldErrors(form) {
    form.querySelectorAll('.af-field-error').forEach(function(el) { el.remove(); });
    form.querySelectorAll('[style*="border-color"]').forEach(function(el) { el.style.borderColor = ''; });
  }

  // ─── LISTS (Auto-rendering) ────────────────────────────────────────────
  AF.lists = {
    /**
     * Bind a container to a collection. Auto-fetches and renders items.
     * Usage: AF.lists.bind('#todo-list', 'todos', { template: fn, empty: 'No todos yet' })
     */
    bind: async function(selector, collection, opts) {
      opts = opts || {};
      const container = document.querySelector(selector);
      if (!container) return;

      container.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.5;">Loading...</div>';

      try {
        const result = await AF.data.list(collection, {
          limit: opts.limit || 50,
          offset: opts.offset || 0,
          orderBy: opts.orderBy,
          order: opts.order || 'desc',
          filters: opts.filters,
        });

        const items = result.items || result; // Handle both paginated and flat response
        if (items.length === 0) {
          container.innerHTML = '<div style="text-align:center;padding:60px 20px;">' +
            '<div style="font-size:48px;margin-bottom:16px;">📭</div>' +
            '<div style="font-size:16px;opacity:0.6;">' + (opts.empty || 'Nothing here yet') + '</div>' +
            '</div>';
          return;
        }

        container.innerHTML = '';
        items.forEach(function(item) {
          if (opts.template) {
            const html = opts.template(item);
            container.insertAdjacentHTML('beforeend', html);
          } else {
            // Default rendering
            const div = document.createElement('div');
            div.style.cssText = 'padding:16px;border-bottom:1px solid rgba(255,255,255,0.06);';
            div.textContent = JSON.stringify(item);
            container.appendChild(div);
          }
        });

        // Pagination
        if (result.hasMore && opts.loadMore !== false) {
          const moreBtn = document.createElement('button');
          moreBtn.textContent = 'Load More';
          moreBtn.style.cssText = 'display:block;margin:20px auto;padding:12px 24px;background:rgba(255,255,255,0.1);color:white;border:none;border-radius:8px;cursor:pointer;';
          moreBtn.onclick = function() {
            opts.offset = (opts.offset || 0) + (opts.limit || 50);
            AF.lists.bind(selector, collection, opts);
          };
          container.appendChild(moreBtn);
        }
      } catch(err) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;">' +
          '<div style="font-size:32px;margin-bottom:8px;">⚠️</div>' +
          '<div>' + err.message + '</div>' +
          '<button onclick="AF.lists.bind(\'' + selector + '\',\'' + collection + '\')" ' +
          'style="margin-top:12px;padding:8px 16px;background:rgba(255,255,255,0.1);color:white;border:none;border-radius:6px;cursor:pointer;">Retry</button>' +
          '</div>';
      }
    },
  };

  // ─── NAVIGATION ─────────────────────────────────────────────────────────
  AF.navigate = function(screenId, pushState) {
    // Hide all screens
    document.querySelectorAll('[data-screen]').forEach(function(el) {
      el.style.display = 'none';
    });
    // Show target
    const target = document.querySelector('[data-screen="' + screenId + '"]');
    if (target) {
      target.style.display = '';
      if (pushState !== false) {
        history.pushState({ screen: screenId }, '', '#' + screenId);
      }
      AF.emit('navigate', screenId);
      // Update nav active state
      document.querySelectorAll('[data-nav]').forEach(function(el) {
        el.classList.toggle('active', el.dataset.nav === screenId);
      });
    }
  };

  // ─── AUTH UI ────────────────────────────────────────────────────────────
  AF.authUI = {
    /**
     * Render a login form into a container.
     */
    renderLogin: function(selector, opts) {
      opts = opts || {};
      const container = document.querySelector(selector);
      if (!container) return;
      
      container.innerHTML = '' +
        '<form id="af-login-form" style="max-width:400px;margin:0 auto;padding:32px;">' +
          '<h2 style="text-align:center;margin-bottom:24px;font-size:24px;font-weight:700;">Welcome Back</h2>' +
          '<div style="margin-bottom:16px;">' +
            '<label style="display:block;margin-bottom:6px;font-size:14px;opacity:0.7;">Email</label>' +
            '<input type="email" name="email" required placeholder="you@example.com" ' +
              'style="width:100%;padding:12px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:white;font-size:16px;outline:none;box-sizing:border-box;" />' +
          '</div>' +
          '<div style="margin-bottom:24px;">' +
            '<label style="display:block;margin-bottom:6px;font-size:14px;opacity:0.7;">Password</label>' +
            '<input type="password" name="password" required minlength="6" placeholder="••••••••" ' +
              'style="width:100%;padding:12px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:white;font-size:16px;outline:none;box-sizing:border-box;" />' +
          '</div>' +
          '<button type="submit" style="width:100%;padding:14px;background:linear-gradient(135deg,var(--af-primary,#6366f1),var(--af-primary-light,#818cf8));color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;">Sign In</button>' +
          '<p style="text-align:center;margin-top:16px;font-size:14px;opacity:0.6;">' +
            'Don\'t have an account? <a href="#" onclick="AF.authUI.renderSignup(\'' + selector + '\');return false;" style="color:var(--af-primary,#6366f1);">Sign up</a>' +
          '</p>' +
        '</form>';

      document.getElementById('af-login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = this.querySelector('[type="submit"]');
        btn.textContent = 'Signing in...'; btn.disabled = true;
        try {
          const fd = new FormData(this);
          await AF.auth.login(fd.get('email'), fd.get('password'));
          AF.toast('Welcome back!', 'success');
          if (opts.onSuccess) opts.onSuccess();
        } catch(err) {
          AF.toast(err.message, 'error');
        } finally {
          btn.textContent = 'Sign In'; btn.disabled = false;
        }
      });
    },

    renderSignup: function(selector, opts) {
      opts = opts || {};
      const container = document.querySelector(selector);
      if (!container) return;

      container.innerHTML = '' +
        '<form id="af-signup-form" style="max-width:400px;margin:0 auto;padding:32px;">' +
          '<h2 style="text-align:center;margin-bottom:24px;font-size:24px;font-weight:700;">Create Account</h2>' +
          '<div style="margin-bottom:16px;">' +
            '<label style="display:block;margin-bottom:6px;font-size:14px;opacity:0.7;">Name</label>' +
            '<input type="text" name="display_name" required placeholder="Your name" ' +
              'style="width:100%;padding:12px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:white;font-size:16px;outline:none;box-sizing:border-box;" />' +
          '</div>' +
          '<div style="margin-bottom:16px;">' +
            '<label style="display:block;margin-bottom:6px;font-size:14px;opacity:0.7;">Email</label>' +
            '<input type="email" name="email" required placeholder="you@example.com" ' +
              'style="width:100%;padding:12px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:white;font-size:16px;outline:none;box-sizing:border-box;" />' +
          '</div>' +
          '<div style="margin-bottom:24px;">' +
            '<label style="display:block;margin-bottom:6px;font-size:14px;opacity:0.7;">Password</label>' +
            '<input type="password" name="password" required minlength="6" placeholder="At least 6 characters" ' +
              'style="width:100%;padding:12px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:white;font-size:16px;outline:none;box-sizing:border-box;" />' +
          '</div>' +
          '<button type="submit" style="width:100%;padding:14px;background:linear-gradient(135deg,var(--af-primary,#6366f1),var(--af-primary-light,#818cf8));color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;">Create Account</button>' +
          '<p style="text-align:center;margin-top:16px;font-size:14px;opacity:0.6;">' +
            'Already have an account? <a href="#" onclick="AF.authUI.renderLogin(\'' + selector + '\');return false;" style="color:var(--af-primary,#6366f1);">Sign in</a>' +
          '</p>' +
        '</form>';

      document.getElementById('af-signup-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = this.querySelector('[type="submit"]');
        btn.textContent = 'Creating account...'; btn.disabled = true;
        try {
          const fd = new FormData(this);
          await AF.auth.signup(fd.get('email'), fd.get('password'), fd.get('display_name'));
          AF.toast('Account created!', 'success');
          if (opts.onSuccess) opts.onSuccess();
        } catch(err) {
          AF.toast(err.message, 'error');
        } finally {
          btn.textContent = 'Create Account'; btn.disabled = false;
        }
      });
    },

    /**
     * Protect a screen — redirect to login if not authenticated.
     */
    requireAuth: function(screenId, loginScreenId) {
      if (!AF.auth.isLoggedIn) {
        AF.navigate(loginScreenId || 'login');
        AF.toast('Please sign in to continue', 'info');
        return false;
      }
      return true;
    },
  };

  // ─── TOAST NOTIFICATIONS ────────────────────────────────────────────────
  AF.toast = function(message, type) {
    type = type || 'info';
    const colors = {
      success: '#22c55e', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b'
    };
    const icons = {
      success: '✓', error: '✕', info: 'ℹ', warning: '⚠'
    };

    // Remove existing
    const existing = document.getElementById('af-toast');
    if (existing) existing.remove();
    if (_toastTimeout) clearTimeout(_toastTimeout);

    const toast = document.createElement('div');
    toast.id = 'af-toast';
    toast.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%) translateY(-20px);' +
      'padding:12px 20px;border-radius:12px;color:white;font-size:14px;z-index:99999;' +
      'display:flex;align-items:center;gap:8px;opacity:0;transition:all 0.3s ease;' +
      'background:' + (colors[type] || colors.info) + ';box-shadow:0 8px 32px rgba(0,0,0,0.3);max-width:90%;';
    toast.innerHTML = '<span style="font-weight:700;">' + (icons[type] || '') + '</span> ' + message;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(function() {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    _toastTimeout = setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(function() { toast.remove(); }, 300);
    }, type === 'error' ? 5000 : 3000);
  };

  // ─── EVENT SYSTEM ───────────────────────────────────────────────────────
  AF.on = function(event, fn) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
  };

  AF.off = function(event, fn) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(function(f) { return f !== fn; });
  };

  AF.emit = function(event, data) {
    if (!_listeners[event]) return;
    _listeners[event].forEach(function(fn) { try { fn(data); } catch(e) { console.error('[AppForge]', e); } });
  };

  // ─── ADMIN UI HELPERS ──────────────────────────────────────────────────
  AF.admin = {
    listUsers: function(opts) {
      opts = opts || {};
      const params = new URLSearchParams();
      if (opts.limit) params.set('_limit', opts.limit);
      if (opts.offset) params.set('_offset', opts.offset);
      if (opts.search) params.set('search', opts.search);
      if (opts.role) params.set('role', opts.role);
      return api('GET', '/admin/users?' + params.toString());
    },
    updateRole: function(userId, role) {
      return api('PATCH', '/admin/users/' + userId + '/role', { role: role });
    },
    banUser: function(userId) {
      return api('POST', '/admin/users/' + userId + '/ban');
    },
    unbanUser: function(userId) {
      return api('POST', '/admin/users/' + userId + '/unban');
    },
    getStats: function() {
      return api('GET', '/admin/stats');
    },
    sendNotification: function(title, body, userId) {
      return api('POST', '/notifications/send', { title, body, end_user_id: userId });
    },
    broadcast: function(title, body) {
      return api('POST', '/notifications/broadcast', { title, body });
    },
  };

  // ─── UTILITY ────────────────────────────────────────────────────────────
  AF.formatDate = function(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  AF.timeAgo = function(dateStr) {
    if (!dateStr) return '';
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds/60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds/3600) + 'h ago';
    return Math.floor(seconds/86400) + 'd ago';
  };

  // ─── AUTO-BINDING (scans DOM for data-af-* attributes) ───────────────
  function _autoBind() {
    // Auto-bind auth forms (data-af-auth="login|signup|forgot")
    document.querySelectorAll('[data-af-auth]').forEach(function(form) {
      var type = form.dataset.afAuth;
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var btn = form.querySelector('[type="submit"]');
        var btnText = form.querySelector('.af-btn-text');
        var btnLoading = form.querySelector('.af-btn-loading');
        var errEl = form.querySelector('[id*="error"]');
        var successEl = form.querySelector('[id*="success"]');
        if (errEl) errEl.style.display = 'none';
        if (successEl) successEl.style.display = 'none';
        if (btnText) btnText.style.display = 'none';
        if (btnLoading) btnLoading.style.display = '';
        if (btn) btn.disabled = true;

        var fd = new FormData(form);
        try {
          if (type === 'login') {
            await AF.auth.login(fd.get('email'), fd.get('password'));
            AF.toast('Welcome back!', 'success');
            // Navigate to first non-auth screen
            var screens = document.querySelectorAll('[data-screen]');
            for (var i = 0; i < screens.length; i++) {
              var sn = screens[i].dataset.screen;
              if (sn !== 'login' && sn !== 'signup' && sn !== 'forgot-password') {
                AF.navigate(sn); break;
              }
            }
          } else if (type === 'signup') {
            await AF.auth.signup(fd.get('email'), fd.get('password'), fd.get('display_name'));
            AF.toast('Account created!', 'success');
            var screens2 = document.querySelectorAll('[data-screen]');
            for (var j = 0; j < screens2.length; j++) {
              var sn2 = screens2[j].dataset.screen;
              if (sn2 !== 'login' && sn2 !== 'signup' && sn2 !== 'forgot-password') {
                AF.navigate(sn2); break;
              }
            }
          } else if (type === 'forgot') {
            await AF.auth.requestReset(fd.get('email'));
            if (successEl) { successEl.style.display = ''; successEl.textContent = 'Check your email for a reset link!'; }
            AF.toast('Reset link sent!', 'success');
          }
        } catch(err) {
          if (errEl) { errEl.style.display = ''; errEl.textContent = err.message; }
          else AF.toast(err.message, 'error');
        } finally {
          if (btnText) btnText.style.display = '';
          if (btnLoading) btnLoading.style.display = 'none';
          if (btn) btn.disabled = false;
        }
      });
    });

    // Auto-bind data forms (data-af-form with data-collection)
    document.querySelectorAll('[data-af-form]').forEach(function(form) {
      var collection = form.dataset.collection;
      if (!collection) return;
      AF.forms.bind(form, collection, {
        onSuccess: function() {
          // Navigate back to the first list or dashboard screen
          var screens = document.querySelectorAll('[data-screen]');
          if (screens.length > 0) AF.navigate(screens[0].dataset.screen);
        }
      });
    });

    // Auto-bind dynamic lists (data-list with data-collection)
    document.querySelectorAll('[data-list][data-collection]').forEach(function(el) {
      var collection = el.dataset.collection;
      AF.lists.bind(el, collection, {
        template: function(item) {
          var title = item.title || item.name || item.label || item.subject || Object.values(item).find(function(v) { return typeof v === 'string' && v.length > 0 && v.length < 100; }) || 'Item';
          var subtitle = item.description || item.subtitle || item.note || '';
          if (subtitle.length > 80) subtitle = subtitle.substring(0, 77) + '...';
          var meta = item._meta ? AF.timeAgo(item._meta.created_at) : '';
          return '<div style="padding:16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center;cursor:pointer;" data-item-id="' + item.id + '">' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-weight:600;font-size:14px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + title + '</div>' +
              (subtitle ? '<div style="font-size:12px;opacity:0.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + subtitle + '</div>' : '') +
            '</div>' +
            '<div style="font-size:12px;opacity:0.4;flex-shrink:0;margin-left:12px;">' + meta + '</div>' +
          '</div>';
        },
        empty: 'No items yet. Create your first one!'
      });
    });

    // Auto-bind navigation buttons (data-af-action="navigate")
    document.querySelectorAll('[data-af-action="navigate"]').forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.preventDefault();
        var screen = el.dataset.screen;
        if (screen) AF.navigate(screen);
      });
    });

    // Auto-bind delete buttons (data-af-action="delete")
    document.querySelectorAll('[data-af-action="delete"]').forEach(function(el) {
      el.addEventListener('click', async function(e) {
        e.preventDefault();
        if (!confirm('Are you sure?')) return;
        var collection = el.dataset.collection;
        var id = el.dataset.id;
        if (collection && id) {
          try {
            await AF.data.delete(collection, id);
            AF.toast('Deleted', 'success');
            AF.emit('data:changed', { collection, action: 'delete', id });
          } catch(err) { AF.toast(err.message, 'error'); }
        }
      });
    });

    // Wire nav bar items
    document.querySelectorAll('[data-nav]').forEach(function(el) {
      el.addEventListener('click', function() { AF.navigate(el.dataset.nav); });
    });
  }

  // Expose globally
  window.AF = AF;

})(typeof window !== 'undefined' ? window : {});

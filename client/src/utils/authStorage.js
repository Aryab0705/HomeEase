export const ROLES = ['customer', 'provider', 'admin', 'super_admin'];

export const ROLE_STORAGE_KEYS = {
  customer:    { token: 'customerToken',   user: 'customerUser' },
  provider:    { token: 'providerToken',   user: 'providerUser' },
  admin:       { token: 'adminToken',      user: 'adminUser' },
  super_admin: { token: 'adminToken',      user: 'adminUser' },
};

export const ROLE_DASHBOARDS = {
  customer:    '/dashboard',
  provider:    '/provider/dashboard',
  admin:       '/admin/dashboard',
  super_admin: '/admin/dashboard',
};

export const getRoleFromPath = (pathname = '') => {
  const path = pathname || (typeof window !== 'undefined' ? window.location.pathname : '');
  if (path.startsWith('/provider')) return 'provider';
  if (path.startsWith('/admin')) return 'admin';
  return 'customer';
};

export const getDefaultRole = () => getRoleFromPath();

const canUseStorage = () => typeof window !== 'undefined' && window.sessionStorage;

const parseUser = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const getStoredSession = (role = getDefaultRole()) => {
  if (!canUseStorage() || !ROLE_STORAGE_KEYS[role]) return { role, token: null, user: null };
  const keys = ROLE_STORAGE_KEYS[role];

  // Primary: sessionStorage (per tab isolation)
  let token = sessionStorage.getItem(keys.token);
  let user = parseUser(sessionStorage.getItem(keys.user));

  // Fallback / legacy check: localStorage (and migrate to sessionStorage)
  if (!token && typeof window !== 'undefined' && window.localStorage) {
    const legacyToken = localStorage.getItem(keys.token) || localStorage.getItem('accessToken');
    const legacyUser = parseUser(localStorage.getItem(keys.user) || localStorage.getItem('user'));
    if (legacyToken && legacyUser && legacyUser.role === role) {
      token = legacyToken;
      user = legacyUser;
      sessionStorage.setItem(keys.token, token);
      sessionStorage.setItem(keys.user, JSON.stringify(user));
    }
  }

  return { role, token, user };
};

export const setStoredSession = (role, user, token) => {
  if (!canUseStorage() || !ROLE_STORAGE_KEYS[role]) return;
  const keys = ROLE_STORAGE_KEYS[role];
  if (token) sessionStorage.setItem(keys.token, token);
  if (user) sessionStorage.setItem(keys.user, JSON.stringify(user));

  // Clean legacy shared localStorage keys so multi-tab localhost doesn't collide
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem(keys.token);
    localStorage.removeItem(keys.user);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  }
};

export const updateStoredUser = (role, userPatch) => {
  if (!canUseStorage() || !ROLE_STORAGE_KEYS[role]) return null;
  const current = getStoredSession(role).user || {};
  const nextUser = { ...current, ...userPatch };
  sessionStorage.setItem(ROLE_STORAGE_KEYS[role].user, JSON.stringify(nextUser));
  return nextUser;
};

export const clearStoredSession = (role = getDefaultRole()) => {
  if (!canUseStorage() || !ROLE_STORAGE_KEYS[role]) return;
  const keys = ROLE_STORAGE_KEYS[role];
  sessionStorage.removeItem(keys.token);
  sessionStorage.removeItem(keys.user);
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem(keys.token);
    localStorage.removeItem(keys.user);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  }
};

export const getSessionForRequest = (config = {}) => {
  const explicitRole = config.authRole || config.headers?.['X-Auth-Role'];
  const currentSession = getAnyStoredSession();
  const role = ROLE_STORAGE_KEYS[explicitRole]
    ? explicitRole
    : (currentSession.token ? currentSession.role : getRoleFromPath());
  return getStoredSession(role);
};

export const getAnyStoredSession = () => {
  // First check if current active tab has a session matching current path or any valid role
  const pathRole = getRoleFromPath();
  const pathSession = getStoredSession(pathRole);
  if (pathSession.token && pathSession.user) return pathSession;

  for (const role of ROLES) {
    const session = getStoredSession(role);
    if (session.token && session.user) return session;
  }
  return { role: pathRole, token: null, user: null };
};

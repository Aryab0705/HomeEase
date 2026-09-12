import { createSlice } from '@reduxjs/toolkit';
import {
  clearStoredSession,
  getDefaultRole,
  getStoredSession,
  setStoredSession,
  updateStoredUser,
  getAnyStoredSession,
} from '../utils/authStorage';

// Initialize with the role that has a valid session, or default to URL path
const anySession = getAnyStoredSession();
const activeRole = anySession.token && anySession.user ? anySession.role : getDefaultRole();
const session = getStoredSession(activeRole);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    activeRole,
    user:  session.user  || null,
    token: session.token || null,
    isAuthenticated: !!(session.token && session.user),
    loading: false,
    error: null,
  },
  reducers: {
    setCredentials(state, action) {
      const { user, accessToken } = action.payload;
      const role = user?.role || state.activeRole || activeRole;
      state.activeRole = role;
      state.user  = user;
      state.token = accessToken;
      state.isAuthenticated = true;
      state.error = null;
      setStoredSession(role, user, accessToken);
    },
    clearCredentials(state) {
      const role = state.user?.role || state.activeRole || getDefaultRole();
      state.user  = null;
      state.token = null;
      state.isAuthenticated = false;
      clearStoredSession(role);
    },
    updateUser(state, action) {
      const role = state.user?.role || state.activeRole || getDefaultRole();
      state.user = updateStoredUser(role, action.payload) || { ...state.user, ...action.payload };
    },
    setActiveRole(state, action) {
      const role = action.payload || getDefaultRole();
      const nextSession = getStoredSession(role);
      state.activeRole = role;
      state.user = nextSession.user;
      state.token = nextSession.token;
      state.isAuthenticated = !!(nextSession.token && nextSession.user);
      state.error = null;
    },
    setAuthLoading(state, action) { state.loading = action.payload; },
    setAuthError(state, action)   { state.error   = action.payload; },
  },
});

export const { setCredentials, clearCredentials, updateUser, setActiveRole, setAuthLoading, setAuthError } = authSlice.actions;
export default authSlice.reducer;

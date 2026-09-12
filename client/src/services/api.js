import axios from 'axios';
import { clearStoredSession, getSessionForRequest, setStoredSession } from '../utils/authStorage';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const API = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

// ── Token refresh state ──────────────────────────────────────────────────────
// Prevents the race condition where multiple simultaneous 401 requests each
// trigger their own refresh call, causing the token to be rotated mid-flight.
let isRefreshing = false;
let refreshQueue = []; // callbacks waiting for the new token

const processQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  refreshQueue = [];
};

const isAuthEndpoint = (url = '') => (
  url.includes('/auth/login') ||
  url.includes('/auth/register') ||
  url.includes('/auth/forgot-password') ||
  url.includes('/auth/reset-password') ||
  url.includes('/auth/refresh-token')
);

// ── Request interceptor — attach access token ────────────────────────────────
API.interceptors.request.use(
  (config) => {
    const session = getSessionForRequest(config);
    if (session.token) config.headers.Authorization = `Bearer ${session.token}`;
    if (session.role) config.headers['X-Auth-Role'] = session.role;
    delete config.authRole;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — handle 401, refresh token, retry ─────────────────
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Only handle 401 from API calls that haven't already been retried
    // and are not the refresh-token call itself.
    if (
      error.response?.status !== 401 ||
      original._retry ||
      isAuthEndpoint(original.url)
    ) {
      return Promise.reject(error);
    }

    // If a refresh is already in flight, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return API(original);
      });
    }

    // First 401 — kick off the refresh
    original._retry = true;
    isRefreshing = true;

    try {
      const session = getSessionForRequest(original);
      const { data } = await axios.post(
        `${BASE_URL}/auth/refresh-token`,
        { role: session.role },
        {
          withCredentials: true,
          headers: { 'X-Auth-Role': session.role },
        }
      );

      // The refresh endpoint uses ApiResponse wrapper:
      // { statusCode, success, message, data: { accessToken } }
      const newToken = data.data?.accessToken ?? data.accessToken;
      if (!newToken) throw new Error('No token in refresh response');

      setStoredSession(session.role, session.user, newToken);
      API.defaults.headers.common.Authorization = `Bearer ${newToken}`;
      original.headers.Authorization = `Bearer ${newToken}`;

      processQueue(null, newToken);
      return API(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearStoredSession(getSessionForRequest(original).role);
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default API;

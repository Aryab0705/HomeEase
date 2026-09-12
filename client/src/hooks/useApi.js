import { useState, useCallback } from 'react';
import API from '../services/api';

/**
 * useApi — generic hook for one-shot API calls with loading/error state.
 *
 * Usage:
 *   const { loading, error, request } = useApi();
 *   const data = await request('post', '/auth/login', { email, password });
 */
export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const request = useCallback(async (method, url, data = null, config = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await API[method](url, data, config);
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || 'Something went wrong';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, request };
};

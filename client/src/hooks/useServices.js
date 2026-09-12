import { useState, useEffect, useCallback } from 'react';
import API from '../services/api';

/**
 * useServices — fetches service catalogue with optional filters.
 *
 * @param {object} params - { category, search, page, limit, isActive }
 */
export const useServices = (params = {}) => {
  const [services, setServices] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [total,    setTotal]    = useState(0);

  const paramKey = JSON.stringify(params);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await API.get('/services', { params });
      const list = data.data?.services ?? data.data ?? [];
      setServices(list);
      setTotal(data.data?.total ?? list.length);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey]);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  return { services, loading, error, total, refetch: fetchServices };
};

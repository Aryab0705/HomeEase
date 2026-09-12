import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import API from '../services/api';

/**
 * useBookings — fetches bookings for the current user's role.
 *
 * Automatically picks the correct endpoint based on the user's role:
 *   customer  → GET /bookings/my
 *   provider  → GET /bookings/provider
 *   admin     → GET /admin/bookings
 *
 * @param {object} params - query params (status, page, limit, etc.)
 */
export const useBookings = (params = {}) => {
  const { user } = useSelector(s => s.auth);
  const role = user?.role || 'customer';

  const [bookings,   setBookings]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  const endpointMap = {
    customer: '/bookings/my',
    provider: '/bookings/my',
    admin:    '/bookings/all',
  };

  // Stringify params so useCallback doesn't re-create on each render
  const paramKey = JSON.stringify(params);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = endpointMap[role] || '/bookings/my';
      const { data } = await API.get(endpoint, { params });
      // Handle both {data: {bookings: []}} and {data: []} shapes
      const list = data.data?.bookings ?? data.data ?? [];
      setBookings(list);
      if (data.data?.pagination) setPagination(data.data.pagination);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, paramKey]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  return { bookings, loading, error, pagination, refetch: fetchBookings };
};

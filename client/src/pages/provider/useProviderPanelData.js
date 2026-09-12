import { useCallback, useEffect, useMemo, useState } from 'react';
import API from '../../services/api';
import { ensureSocket } from '../../services/socket';
import { calculateProviderMetrics, makeMonthlySeries, makeStatusSeries } from './providerPanelUtils';

const EMPTY_RATING = {
  average: 0,
  totalReviews: 0,
  workQuality: 0,
  punctuality: 0,
  professionalism: 0,
  valueForMoney: 0,
  distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
};

const initialState = {
  provider: null,
  bookings: [],
  reviews: [],
  rating: EMPTY_RATING,
  notifications: [],
  chats: [],
};

export const useProviderPanelData = () => {
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [providerRes, bookingsRes, notificationsRes, chatsRes] = await Promise.allSettled([
        API.get('/providers/me/profile'),
        API.get('/bookings/my', { params: { limit: 100 } }),
        API.get('/notifications'),
        API.get('/chats'),
      ]);

      const provider = providerRes.status === 'fulfilled' ? providerRes.value.data.data : null;
      const bookings = bookingsRes.status === 'fulfilled' ? bookingsRes.value.data.data?.bookings || [] : [];
      const notifications = notificationsRes.status === 'fulfilled' ? notificationsRes.value.data.data?.notifications || notificationsRes.value.data.data || [] : [];
      const chats = chatsRes.status === 'fulfilled' ? chatsRes.value.data.data || [] : [];

      let reviews = [];
      let rating = EMPTY_RATING;
      if (provider?._id) {
        try {
          const reviewsRes = await API.get(`/reviews/provider/${provider._id}`, { params: { limit: 50 } });
          reviews = reviewsRes.data.data?.reviews || [];
          // Server-computed aggregate — authoritative over the denormalised
          // copy stored on the provider document.
          rating = { ...EMPTY_RATING, ...(reviewsRes.data.data?.rating || {}) };
        } catch (err) {
          console.error('[Provider reviews load failed]', {
            providerId: provider._id,
            status: err?.response?.status,
            message: err?.response?.data?.message,
          });
          reviews = [];
          rating = { ...EMPTY_RATING, ...(provider.rating || {}) };
        }
      }

      setState({ provider, bookings, reviews, rating, notifications, chats });
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load provider workspace');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Live review + rating updates over the EXISTING socket connection ──────
  // No second socket system: this reuses the app-wide instance created at login.
  const providerId = state.provider?._id;
  useEffect(() => {
    const socket = ensureSocket();
    if (!socket || !providerId) return undefined;

    socket.emit('join_provider', { providerId });

    const onReviewCreated = (payload) => {
      if (String(payload?.providerId) !== String(providerId)) return;
      const incoming = payload.review;
      if (!incoming?._id) return;

      setState((prev) => {
        if (prev.reviews.some((r) => String(r._id) === String(incoming._id))) return prev;
        return {
          ...prev,
          reviews: [incoming, ...prev.reviews],
          rating: { ...prev.rating, ...(payload.rating || {}) },
          provider: prev.provider
            ? { ...prev.provider, rating: { ...prev.provider.rating, ...(payload.rating || {}) } }
            : prev.provider,
        };
      });
    };

    const onRatingUpdated = (payload) => {
      if (String(payload?.providerId) !== String(providerId)) return;
      if (!payload?.rating) return;
      setState((prev) => ({
        ...prev,
        rating: { ...prev.rating, ...payload.rating },
        provider: prev.provider
          ? { ...prev.provider, rating: { ...prev.provider.rating, ...payload.rating } }
          : prev.provider,
      }));
    };

    const onBookingStatusUpdated = (payload) => {
      const bId = payload?.bookingId || payload?._id || payload?.booking?._id;
      const nextStatus = payload?.status || payload?.booking?.status;
      if (!bId) {
        load();
        return;
      }
      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          String(b._id) === String(bId) ? { ...b, ...(payload.booking || {}), status: nextStatus || b.status, updatedAt: new Date().toISOString() } : b
        ),
      }));
    };

    socket.on('review:created', onReviewCreated);
    socket.on('provider:ratingUpdated', onRatingUpdated);
    socket.on('booking:statusUpdated', onBookingStatusUpdated);

    return () => {
      socket.emit('leave_provider', { providerId });
      socket.off('review:created', onReviewCreated);
      socket.off('provider:ratingUpdated', onRatingUpdated);
      socket.off('booking:statusUpdated', onBookingStatusUpdated);
    };
  }, [providerId, load]);

  const metrics = useMemo(
    () => calculateProviderMetrics(state.provider, state.bookings),
    [state.provider, state.bookings],
  );

  const monthlySeries = useMemo(() => makeMonthlySeries(state.bookings), [state.bookings]);
  const statusSeries = useMemo(() => makeStatusSeries(state.bookings), [state.bookings]);

  return {
    ...state,
    loading,
    error,
    metrics,
    monthlySeries,
    statusSeries,
    reload: load,
  };
};

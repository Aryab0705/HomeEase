import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Star } from 'lucide-react';
import Avatar from '../common/Avatar';
import StarRating from '../common/StarRating';
import Spinner from '../common/Spinner';
import API from '../../services/api';
import { ensureSocket } from '../../services/socket';
import { timeAgo } from '../../utils/helpers';

/**
 * Categories rendered under each review. `key` is the canonical field on the
 * Review model; `legacy` is the pre-existing field name kept for older reviews.
 *
 * The fallback matters because GET /reviews/provider/:id reads with `.lean()`,
 * which skips Mongoose document hydration — so the model's legacy backfill hook
 * does not run and old documents arrive with only the legacy keys populated.
 */
export const REVIEW_CATEGORY_LABELS = [
  { key: 'workQuality', label: 'Work Quality', legacy: 'quality' },
  { key: 'punctuality', label: 'Punctuality', legacy: 'timeliness' },
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'valueForMoney', label: 'Value for Money' },
];

/** Canonical value first, then the legacy field, then nothing. */
const categoryScore = (ratings, category) =>
  ratings?.[category.key] ?? (category.legacy ? ratings?.[category.legacy] : undefined);


const EMPTY_RATING = {
  average: 0,
  totalReviews: 0,
  workQuality: 0,
  punctuality: 0,
  professionalism: 0,
  valueForMoney: 0,
  distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
};

/**
 * A single public review. Only ever renders public-safe customer fields
 * (name + avatar) — the API never sends phone/email/address.
 */
export const PublicReviewCard = ({ review }) => {
  const customer = review?.customerId;
  const ratings = review?.ratings || {};

  return (
    <div
      style={{
        padding: 18,
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: 12,
        background: '#fff',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        <Avatar src={customer?.avatar?.url} name={customer?.name || 'Customer'} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 15 }}>{customer?.name || 'HomeEase Customer'}</strong>
            <StarRating rating={review?.overallRating || 0} size={14} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>
              {Number(review?.overallRating || 0).toFixed(1)}
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
            {timeAgo(review?.createdAt)}
          </span>
        </div>
      </div>

      {review?.comment && (
        <p style={{ fontSize: 14, lineHeight: 1.65, marginBottom: 12 }}>“{review.comment}”</p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {REVIEW_CATEGORY_LABELS.map(c => ({ ...c, score: categoryScore(ratings, c) }))
          .filter(c => c.score)
          .map(c => (
            <span
              key={c.key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: 'var(--text-light)',
                background: 'var(--bg, #f8fafc)',
                padding: '4px 10px',
                borderRadius: 999,
              }}
            >
              {c.label}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 700, color: 'var(--text-dark)' }}>
                <Star size={11} fill="#f59e0b" stroke="#f59e0b" />
                {c.score}
              </span>
            </span>
          ))}
      </div>

      {review?.providerResponse?.comment && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderLeft: '3px solid var(--dark-accent, #0f172a)',
            background: '#f8fafc',
            borderRadius: '0 10px 10px 0',
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageSquare size={12} /> Response from provider
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>{review.providerResponse.comment}</p>
        </div>
      )}
    </div>
  );
};

/**
 * Public reviews block for a provider.
 *
 * All numbers come from GET /reviews/provider/:id, which aggregates the real
 * Review documents server-side. Nothing here is hardcoded, and the endpoint is
 * public so signed-out visitors see the same reputation.
 */
const ProviderReviewsSection = ({ providerId, pageSize = 5 }) => {
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(EMPTY_RATING);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const seenIds = useRef(new Set());
  // Monotonic token for the newest in-flight request. A response whose token is
  // stale (provider switched, or the component unmounted) must not write state:
  // otherwise a slow fetch for the previous provider lands last and overwrites
  // the current provider's reviews with someone else's.
  const requestId = useRef(0);

  useEffect(() => () => { requestId.current += 1; }, []);

  const fetchPage = useCallback(
    async (page = 1, { append = false } = {}) => {
      if (!providerId) return;
      const token = (requestId.current += 1);
      const isCurrent = () => requestId.current === token;

      append ? setLoadingMore(true) : setLoading(true);
      try {
        const res = await API.get(`/reviews/provider/${providerId}`, {
          params: { page, limit: pageSize },
        });
        if (!isCurrent()) return;
        const data = res.data?.data || {};
        const incoming = data.reviews || [];

        setRating({ ...EMPTY_RATING, ...(data.rating || {}) });
        setPagination(data.pagination || { page, pages: 0, total: incoming.length });
        setReviews(prev => {
          if (!append) {
            seenIds.current = new Set(incoming.map(r => String(r._id)));
            return incoming;
          }
          const fresh = incoming.filter(r => !seenIds.current.has(String(r._id)));
          fresh.forEach(r => seenIds.current.add(String(r._id)));
          return [...prev, ...fresh];
        });
        setError(null);
      } catch (err) {
        if (!isCurrent()) return;
        console.error('[Provider reviews load failed]', {
          providerId,
          status: err?.response?.status,
          message: err?.response?.data?.message,
          raw: err?.response?.data ?? err.message,
        });
        setError(err?.response?.data?.message || 'Could not load reviews right now.');
      } finally {
        if (isCurrent()) append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [providerId, pageSize]
  );

  useEffect(() => {
    seenIds.current = new Set();
    fetchPage(1);
  }, [fetchPage]);

  // ── Live updates over the EXISTING socket connection ──────────────────────
  // Signed-out visitors simply have no socket; the section still works, it just
  // updates on next load instead of instantly.
  useEffect(() => {
    const socket = ensureSocket();
    if (!socket || !providerId) return undefined;

    socket.emit('join_provider', { providerId });

    const onReviewCreated = payload => {
      if (String(payload?.providerId) !== String(providerId)) return;
      const incoming = payload.review;
      if (!incoming?._id || seenIds.current.has(String(incoming._id))) return;
      seenIds.current.add(String(incoming._id));
      setReviews(prev => [incoming, ...prev]);
      if (payload.rating) setRating(prev => ({ ...prev, ...payload.rating }));
      setPagination(prev => ({ ...prev, total: (prev.total || 0) + 1 }));
    };

    const onRatingUpdated = payload => {
      if (String(payload?.providerId) !== String(providerId)) return;
      if (payload.rating) setRating(prev => ({ ...prev, ...payload.rating }));
    };

    socket.on('review:created', onReviewCreated);
    socket.on('provider:ratingUpdated', onRatingUpdated);

    return () => {
      socket.emit('leave_provider', { providerId });
      socket.off('review:created', onReviewCreated);
      socket.off('provider:ratingUpdated', onRatingUpdated);
    };
  }, [providerId]);

  const total = rating.totalReviews || 0;

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Reviews</h2>

      <div className="card" style={{ padding: 24, marginBottom: 18 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <Spinner />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ minWidth: 160 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
                  {Number(rating.average || 0).toFixed(1)}
                </span>
                <span style={{ fontSize: 16, color: 'var(--text-light)' }}>/ 5</span>
              </div>
              <div style={{ margin: '8px 0 4px' }}>
                <StarRating rating={rating.average || 0} size={18} />
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
                {total === 0
                  ? 'No reviews yet'
                  : `Based on ${total} review${total === 1 ? '' : 's'}`}
              </p>
            </div>

            {total > 0 && (
              <>
                <div style={{ flex: 1, minWidth: 220 }}>
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = rating.distribution?.[star] || 0;
                    const pct = total ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 12, width: 28, color: 'var(--text-light)' }}>{star} ★</span>
                        <div style={{ flex: 1, height: 7, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#f59e0b', transition: 'width .3s ease' }} />
                        </div>
                        <span style={{ fontSize: 12, width: 24, textAlign: 'right', color: 'var(--text-light)' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ minWidth: 200 }}>
                  {REVIEW_CATEGORY_LABELS.map(c => (
                    <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{c.label}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700 }}>
                        <Star size={12} fill="#f59e0b" stroke="#f59e0b" />
                        {Number(rating[c.key] || 0).toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="card" style={{ padding: 18, fontSize: 14, color: '#b91c1c' }}>{error}</div>
      )}

      {!loading && !error && reviews.length === 0 && (
        <div className="card empty-state" style={{ padding: 28, textAlign: 'center' }}>
          <Star size={26} style={{ color: 'var(--text-light)', margin: '0 auto 8px' }} />
          <p style={{ fontSize: 14, color: 'var(--text-light)' }}>
            This provider has no reviews yet. Be the first to book and share your experience.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {reviews.map(review => (
          <PublicReviewCard key={review._id} review={review} />
        ))}
      </div>

      {pagination.pages > pagination.page && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            className="btn btn-outline"
            disabled={loadingMore}
            onClick={() => fetchPage(pagination.page + 1, { append: true })}
          >
            {loadingMore ? 'Loading…' : `Show more reviews (${Math.max(0, pagination.total - reviews.length)} left)`}
          </button>
        </div>
      )}
    </section>
  );
};

export default ProviderReviewsSection;

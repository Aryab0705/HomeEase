import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Star, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import API from '../../services/api';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const StarDisplay = ({ rating }) => (
  <div style={{ display: 'flex', gap: 2 }}>
    {[1,2,3,4,5].map(s => (
      <Star key={s} size={13} fill={s <= rating ? '#f59e0b' : 'none'} color={s <= rating ? '#f59e0b' : '#d1d5db'} />
    ))}
  </div>
);

const AdminReviews = () => {
  const [reviews, setReviews]   = useState([]);
  const [summary, setSummary]   = useState({});
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [minRating, setMinRating] = useState('');
  const LIMIT = 10;

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (minRating) params.minRating = minRating;
      const res = await API.get('/admin/reviews', { params });
      setReviews(res.data.data?.reviews || []);
      setTotal(res.data.data?.pagination?.total || 0);
      setSummary(res.data.data?.summary || {});
    } catch { toast.error('Failed to load reviews'); }
    finally { setLoading(false); }
  }, [page, minRating]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const totalPages = Math.ceil(total / LIMIT);

  const ratingBreakdown = [
    { stars: 5, count: summary.fiveStar || 0 },
    { stars: 4, count: summary.fourStar || 0 },
    { stars: 3, count: summary.threeStar || 0 },
    { stars: 2, count: summary.twoStar || 0 },
    { stars: 1, count: summary.oneStar || 0 },
  ];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Star size={22} color="#f59e0b" fill="#f59e0b" /> Reviews & Ratings
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              {summary.total || 0} total reviews · Avg rating: {(summary.avgRating || 0).toFixed(1)} ★
            </p>
          </div>
          <button onClick={fetchReviews} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#f59e0b', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginBottom: 24, alignItems: 'start' }}>
        {/* Rating breakdown card */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: '#1e293b' }}>{(summary.avgRating || 0).toFixed(1)}</div>
            <StarDisplay rating={Math.round(summary.avgRating || 0)} />
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>{summary.total || 0} reviews</div>
          </div>
          {ratingBreakdown.map(({ stars, count }) => (
            <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#64748b', width: 14, textAlign: 'right' }}>{stars}</span>
              <Star size={12} fill="#f59e0b" color="#f59e0b" />
              <div style={{ flex: 1, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#f59e0b', borderRadius: 4, width: summary.total ? `${(count / summary.total) * 100}%` : '0%', transition: 'width 0.5s' }} />
              </div>
              <span style={{ fontSize: 12, color: '#64748b', width: 24, textAlign: 'right' }}>{count}</span>
            </div>
          ))}
          <div style={{ marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Filter by rating:</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['', '5', '4', '3', '2', '1'].map(r => (
                <button key={r} onClick={() => { setMinRating(r); setPage(1); }}
                  style={{ padding: '4px 10px', borderRadius: 6, border: minRating === r ? 'none' : '1px solid #e2e8f0', background: minRating === r ? '#f59e0b' : 'white', color: minRating === r ? 'white' : '#374151', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  {r ? `${r}★+` : 'All'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reviews list */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <Star size={40} color="#e2e8f0" style={{ margin: '0 auto 12px' }} />
              <div style={{ color: '#64748b' }}>No reviews found</div>
            </div>
          ) : (
            <>
              {reviews.map((r, i) => {
                // The reviewer is populated on `customerId`; `userId`/`rating`
                // are the legacy shapes kept as a fallback for older documents.
                const reviewer = r.customerId || r.userId;
                const score = r.overallRating ?? r.rating ?? 0;
                return (
                <div key={r._id} style={{ padding: '16px 20px', borderBottom: i < reviews.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e7ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                        {reviewer?.name?.[0] || '?'}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{reviewer?.name || 'Customer'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>→ {r.providerId?.userId?.name || 'Provider'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StarDisplay rating={score} />
                      <span style={{ fontSize: 12, color: '#64748b' }}>{formatDate(r.createdAt)}</span>
                    </div>
                  </div>
                  {r.comment && (
                    <p style={{ margin: '10px 0 0', fontSize: 13, color: '#374151', lineHeight: 1.5, paddingLeft: 46 }}>{r.comment}</p>
                  )}
                </div>
                );
              })}
              {totalPages > 1 && (
                <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>Page {page} of {totalPages}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: page === 1 ? 0.4 : 1 }}>
                      <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: page === totalPages ? 0.4 : 1 }}>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminReviews;

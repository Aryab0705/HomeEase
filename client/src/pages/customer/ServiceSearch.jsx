import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, SlidersHorizontal, MapPin, X,
  CheckCircle, ShieldCheck, Award
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StarRating from '../../components/common/StarRating';
import { PageSpinner } from '../../components/common/Spinner';
import API from '../../services/api';
import { CATEGORY_ICONS, SERVICE_CATEGORIES, formatCurrency } from '../../utils/helpers';

/* ── Category "All" card ───────────────────────────────────────────────── */
const _ALL_CAT = { key: '', icon: '🏠', label: 'All Services' };

/* ── Premium Category Card ─────────────────────────────────────────────── */
const CategoryCard = ({ icon, label, selected, onClick }) => (
  <button
    onClick={onClick}
    className={`category-card${selected ? ' selected' : ''}`}
  >
    <span className="category-card-icon">{icon}</span>
    <span className="category-card-name">{label}</span>
  </button>
);

/* ── Provider Card ─────────────────────────────────────────────────────── */
const ProviderCard = ({ p, index, onClick }) => {
  const isAvailable = p.availability?.isAvailable;
  const isVerified  = p.verificationStatus === 'verified' || p.verification?.overallStatus === 'verified';
  const isIdentityVerified = p.verification?.identity?.status === 'verified';
  const isSkillsVerified = p.verification?.skills?.status === 'verified';
  const hasVerifiedQual = p.verification?.qualification?.status === 'verified';
  const name        = p.userId?.name || 'Provider';
  const avatar      = p.userId?.avatar?.url;
  const rating      = p.rating?.average || 0;
  const reviews     = p.rating?.totalReviews || 0;
  const city        = p.serviceArea?.city;
  const price       = p.services?.[0]?.basePrice || 0;
  const tags        = p.services?.slice(0, 3).map(s => s.category) || [];
  const experience  = p.verification?.experience?.yearsOfExperience ?? p.experience ?? 0;
  const jobs        = p.completedJobs || 0;
  const response    = p.responseTime || '<1h';

  return (
    <motion.div
      className="provider-card"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      onClick={onClick}
    >
      {/* Availability badge */}
      {isAvailable && (
        <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 1 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#dcfce7', color: '#15803d',
            fontSize: 11, fontWeight: 700, padding: '4px 10px',
            borderRadius: 99, border: '1px solid #bbf7d0',
          }}>
            <span className="availability-dot" />
            Available
          </span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="provider-card-header">
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              style={{ width: 68, height: 68, borderRadius: 14, objectFit: 'cover', border: '2px solid var(--border)' }}
            />
          ) : (
            <div style={{
              width: 68, height: 68, borderRadius: 14,
              background: 'linear-gradient(135deg, var(--dark-accent), #7fa8ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 800, color: 'var(--text-dark)',
            }}>
              {name?.[0] || '?'}
            </div>
          )}
          {isVerified && (
            <div style={{
              position: 'absolute', bottom: -4, right: -4,
              width: 22, height: 22, borderRadius: '50%',
              background: '#22C55E', border: '2px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }} title="HomeEase Verified Professional">
              <CheckCircle size={13} color="white" fill="white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-dark)', lineHeight: 1.2 }}>
              {name}
            </h3>
            {isVerified && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#15803d',
                padding: '1px 6px', borderRadius: 99, border: '1px solid #bbf7d0'
              }}>
                <ShieldCheck size={10} /> Verified Pro
              </span>
            )}
          </div>
          {/* Stars */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <StarRating rating={rating} size={13} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>
              {rating.toFixed(1)}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
              ({reviews} reviews)
            </span>
          </div>
          {/* Trust & Category Badges */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {tags.map(t => (
              <span key={t} style={{
                fontSize: 11, background: 'var(--primary)',
                color: '#3b5a99', padding: '2px 8px', borderRadius: 99,
                fontWeight: 600, border: '1px solid var(--accent)',
              }}>
                {CATEGORY_ICONS[t]} {t}
              </span>
            ))}
            {isIdentityVerified && (
              <span style={{
                fontSize: 10, background: '#f1f5f9', color: '#475569',
                padding: '2px 6px', borderRadius: 99, fontWeight: 600
              }}>
                ✓ ID Verified
              </span>
            )}
            {hasVerifiedQual && (
              <span style={{
                fontSize: 10, background: '#eff6ff', color: '#1d4ed8',
                padding: '2px 6px', borderRadius: 99, fontWeight: 600
              }}>
                ★ Certified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="provider-card-body">
        {/* Stats row */}
        <div className="provider-card-stats">
          <div className="provider-stat-cell">
            <div className="provider-stat-value">{experience}<span style={{ fontSize: 10, fontWeight: 500 }}>yr</span></div>
            <div className="provider-stat-label">Exp.</div>
          </div>
          <div className="provider-stat-cell">
            <div className="provider-stat-value">{jobs}</div>
            <div className="provider-stat-label">Jobs</div>
          </div>
          <div className="provider-stat-cell">
            <div className="provider-stat-value" style={{ fontSize: 12 }}>{response}</div>
            <div className="provider-stat-label">Response</div>
          </div>
        </div>

        {/* Location + Price */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-light)' }}>
            <MapPin size={13} />
            {city || 'Location N/A'}
          </div>
          <div>
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--dark-accent)' }}>
              {formatCurrency(price)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 500 }}> Visit Fee</span>
          </div>
        </div>

        {/* CTA */}
        <button
          className="btn btn-primary"
          style={{ width: '100%', fontSize: 14, padding: '12px', fontWeight: 700, borderRadius: 10 }}
          onClick={onClick}
        >
          View Profile & Book →
        </button>
      </div>
    </motion.div>
  );
};

/* ════════════════════════════════════════════════════════════════════════════ */
const ServiceSearch = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [providers, setProviders]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [pagination, setPagination]   = useState({});
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    search:    searchParams.get('search')    || '',
    category:  searchParams.get('category') || '',
    minRating: searchParams.get('minRating')|| '',
    city:      searchParams.get('city')     || '',
    sortBy:    searchParams.get('sortBy')   || 'rating',
    page: 1,
  });

  const fetchProviders = async (f = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => v && params.set(k, v));
      const res = await API.get(`/providers?${params}`);
      setProviders(res.data.data.providers);
      setPagination(res.data.data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProviders(); }, []);

  const handleFilter = (key, val) => {
    const f = { ...filters, [key]: val, page: 1 };
    setFilters(f);
    fetchProviders(f);
  };

  const clearAllFilters = () => {
    const f = { search: '', category: '', minRating: '', city: '', sortBy: 'rating', page: 1 };
    setFilters(f);
    fetchProviders(f);
  };

  const hasActiveFilters = filters.category || filters.minRating || filters.city;

  return (
    <AppLayout>

          {/* ── Page Header ── */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Find Services</h1>
            <p style={{ color: 'var(--text-light)', fontSize: 14 }}>Discover verified professionals near you</p>
          </div>

          {/* ── Search Bar ── */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', pointerEvents: 'none' }} />
              <input
                className="input"
                style={{ paddingLeft: 44, height: 48, borderRadius: 12, fontSize: 14 }}
                placeholder="Search providers or services..."
                value={filters.search}
                onChange={e => handleFilter('search', e.target.value)}
              />
            </div>
            <button
              className="btn btn-outline"
              style={{ height: 48, gap: 8, borderRadius: 12, position: 'relative' }}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal size={16} />
              Filters
              {hasActiveFilters && (
                <span style={{
                  position: 'absolute', top: -6, right: -6,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--dark-accent)', color: 'var(--text-dark)',
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid white',
                }}>!</span>
              )}
            </button>
          </div>

          {/* ── Premium Category Cards ── */}
          <div className="category-scroll" style={{ marginBottom: 24 }}>
            {/* All */}
            <CategoryCard
              icon="🏠"
              label="All Services"
              selected={!filters.category}
              onClick={() => handleFilter('category', '')}
            />
            {SERVICE_CATEGORIES.map(cat => (
              <CategoryCard
                key={cat}
                icon={CATEGORY_ICONS[cat] || '🔧'}
                label={cat}
                selected={filters.category === cat}
                onClick={() => handleFilter('category', cat)}
              />
            ))}
          </div>

          {/* ── Content Grid (filters + results) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: showFilters ? '260px 1fr' : '1fr', gap: 24 }}>

            {/* Filter Panel */}
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                className="card"
                style={{ padding: 20, height: 'fit-content', position: 'sticky', top: 16 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>Filters</h3>
                  <button onClick={() => setShowFilters(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: 4 }}>
                    <X size={17} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label className="label">City</label>
                    <input className="input" placeholder="Mumbai, Delhi..." value={filters.city} onChange={e => handleFilter('city', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Minimum Rating</label>
                    <select className="input" value={filters.minRating} onChange={e => handleFilter('minRating', e.target.value)}>
                      <option value="">Any Rating</option>
                      <option value="3">3★ & above</option>
                      <option value="4">4★ & above</option>
                      <option value="4.5">4.5★ & above</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Sort By</label>
                    <select className="input" value={filters.sortBy} onChange={e => handleFilter('sortBy', e.target.value)}>
                      <option value="rating">Top Rated</option>
                      <option value="experience">Most Experienced</option>
                      <option value="jobs">Most Jobs Done</option>
                      <option value="newest">Newest</option>
                    </select>
                  </div>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: 4 }}
                    onClick={clearAllFilters}
                  >
                    <X size={14} /> Clear Filters
                  </button>
                </div>
              </motion.div>
            )}

            {/* Results */}
            <div>
              {loading ? (
                <PageSpinner />
              ) : (
                <>
                  {/* Result count */}
                  <p style={{ color: 'var(--text-light)', fontSize: 13, marginBottom: 16, fontWeight: 500 }}>
                    <span style={{ color: 'var(--text-dark)', fontWeight: 700 }}>{pagination.total || 0}</span>
                    {' '}provider{pagination.total !== 1 ? 's' : ''} found
                    {filters.category && <span style={{ color: 'var(--dark-accent)' }}> in {filters.category}</span>}
                  </p>

                  {providers.length === 0 ? (
                    <div className="card empty-state">
                      <div className="empty-state-icon">🔍</div>
                      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No providers found</h3>
                      <p style={{ color: 'var(--text-light)', maxWidth: 300, marginBottom: 20, fontSize: 14 }}>
                        Try adjusting your filters or search for a different service.
                      </p>
                      <button className="btn btn-primary" onClick={clearAllFilters}>Clear Filters</button>
                    </div>
                  ) : (
                    <div className="grid-3">
                      {providers.map((p, i) => (
                        <ProviderCard
                          key={p._id}
                          p={p}
                          index={i}
                          onClick={() => navigate(`/providers/${p._id}`)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {pagination.pages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 32 }}>
                      {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(pg => (
                        <button
                          key={pg}
                          className={`btn btn-sm ${pg === filters.page ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => { const f = { ...filters, page: pg }; setFilters(f); fetchProviders(f); }}
                        >
                          {pg}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </AppLayout>
  );
};

export default ServiceSearch;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Calendar, MapPin, ChevronRight, Plus } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/common/StatusBadge';
import { PageSpinner } from '../../components/common/Spinner';
import API from '../../services/api';
import { formatDate, formatCurrency, CATEGORY_ICONS } from '../../utils/helpers';
import toast from 'react-hot-toast';

const STATUS_FILTERS = ['all', 'upcoming', 'finished', 'closed'];

const STATUS_GROUPS = {
  upcoming:    ['pending', 'accepted', 'on_the_way', 'arrived'],
  finished:    ['completed'],
  closed:      ['cancelled', 'rejected'],
};

const STATUS_LABELS = {
  upcoming:    'Upcoming',
  finished:    'Finished',
  closed:      'Closed',
};

const STATUS_COLORS = {
  upcoming:    { bg: '#dbeafe', color: '#1d4ed8' },
  in_progress: { bg: '#fce7f3', color: '#9d174d' },
  finished:    { bg: '#dcfce7', color: '#15803d' },
  closed:      { bg: '#fee2e2', color: '#991b1b' },
};

const BookingsList = () => {
  const navigate  = useNavigate();
  const [bookings, setBookings]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatus]   = useState('all');
  const [search, setSearch]         = useState('');
  const [pagination, setPagination] = useState({});
  const [page, setPage]             = useState(1);

  const fetchBookings = async (pg = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pg, limit: 20 });
      const res = await API.get(`/bookings/my?${params}`);
      setBookings(res.data.data.bookings);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  const filtered = bookings.filter(b => {
    const matchesSearch = search === '' ||
      b.serviceId?.name?.toLowerCase().includes(search.toLowerCase()) ||
      b.address?.city?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return STATUS_GROUPS[statusFilter]?.includes(b.status);
  });

  const groupBookings = list => {
    const groups = {};
    Object.keys(STATUS_GROUPS).forEach(g => {
      groups[g] = list.filter(b => STATUS_GROUPS[g].includes(b.status));
    });
    return groups;
  };

  const grouped = groupBookings(filtered);

  return (
    <AppLayout>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>My Bookings</h1>
              <p style={{ color: 'var(--text-light)', fontSize: 14 }}>Track and manage all your service bookings</p>
            </div>
            <button
              className="btn btn-primary"
              style={{ gap: 6 }}
              onClick={() => navigate('/services')}
            >
              <Plus size={16} /> New Booking
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 400, marginBottom: 16 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input
              className="input"
              style={{ paddingLeft: 38 }}
              placeholder="Search by service or city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Status pills */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
            {STATUS_FILTERS.map(s => {
              const isActive = statusFilter === s;
              const colors   = STATUS_COLORS[s] || {};
              return (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  style={{
                    padding: '6px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                    border: isActive ? 'none' : '1.5px solid var(--border)',
                    cursor: 'pointer', transition: 'all 0.2s',
                    background: isActive ? (s === 'all' ? 'var(--dark-accent)' : colors.bg) : 'white',
                    color: isActive ? (s === 'all' ? 'var(--text-dark)' : colors.color) : 'var(--text-light)',
                    boxShadow: isActive ? '0 2px 8px rgba(171,196,255,0.3)' : 'none',
                  }}
                >
                  {s === 'all' ? 'All Bookings' : STATUS_LABELS[s]}
                  {s !== 'all' && grouped[s]?.length > 0 && (
                    <span style={{
                      marginLeft: 6, fontSize: 11, fontWeight: 700,
                      background: isActive ? 'rgba(0,0,0,0.12)' : 'var(--primary)',
                      padding: '1px 6px', borderRadius: 99,
                      color: isActive ? 'inherit' : 'var(--text-light)',
                    }}>
                      {grouped[s].length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Content */}
          {loading ? <PageSpinner /> : (
            <>
              {filtered.length === 0 ? (
                <div className="card empty-state">
                  <div className="empty-state-icon">📋</div>
                  <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No bookings found</h3>
                  <p style={{ color: 'var(--text-light)', fontSize: 14, maxWidth: 300, marginBottom: 24 }}>
                    {statusFilter !== 'all'
                      ? `You don't have any ${STATUS_LABELS[statusFilter]?.toLowerCase()} bookings.`
                      : 'Start by booking a service from our verified professionals.'}
                  </p>
                  <button className="btn btn-primary btn-lg" onClick={() => navigate('/services')}>
                    Browse Services
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                  {Object.keys(grouped).map(group => (
                    grouped[group].length > 0 && (
                      <div key={group}>
                        {/* Group Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.6px', color: 'var(--text-light)',
                          }}>
                            {STATUS_LABELS[group]}
                          </span>
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            background: STATUS_COLORS[group]?.bg || 'var(--primary)',
                            color: STATUS_COLORS[group]?.color || 'var(--text-light)',
                            padding: '2px 8px', borderRadius: 99,
                          }}>
                            {grouped[group].length}
                          </span>
                          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {grouped[group].map((b, i) => {
                            const timeSlot = b.scheduledTimeSlot?.start
                              ? ` · ${b.scheduledTimeSlot.start}`
                              : '';
                            return (
                              <motion.div
                                key={b._id}
                                className="card"
                                style={{ padding: '18px 22px', cursor: 'pointer', transition: 'all 0.2s' }}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
                                onClick={() => navigate(`/bookings/${b._id}`)}
                                onMouseEnter={e => {
                                  e.currentTarget.style.borderColor = 'var(--dark-accent)';
                                  e.currentTarget.style.transform = 'translateX(4px)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.borderColor = 'var(--border)';
                                  e.currentTarget.style.transform = 'translateX(0)';
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                  {/* Service icon */}
                                  <div style={{
                                    width: 52, height: 52, borderRadius: 14,
                                    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 24, flexShrink: 0,
                                    border: '1px solid var(--accent)',
                                  }}>
                                    {CATEGORY_ICONS[b.serviceId?.category] || '🔧'}
                                  </div>

                                  {/* Info */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, flexWrap: 'wrap' }}>
                                      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-dark)' }}>
                                        {b.serviceId?.name || 'Service'}
                                      </h3>
                                      <StatusBadge status={b.status} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 12, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Calendar size={12} />
                                        {formatDate(b.scheduledDate)}{timeSlot}
                                      </span>
                                      {b.address?.city && (
                                        <span style={{ fontSize: 12, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <MapPin size={12} /> {b.address.city}
                                        </span>
                                      )}
                                      {b.providerId?.userId?.name && (
                                        <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
                                          👷 {b.providerId.userId.name}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Amount + arrow */}
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-dark)', marginBottom: 2 }}>
                                      {formatCurrency(b.siteVisitFee || b.consultationFee || b.pricing?.consultationFee || b.totalAmount || b.estimatedAmount || 0)}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 500 }}>
                                      Site Visit Fee
                                    </div>
                                  </div>
                                  <ChevronRight size={17} color="var(--text-light)" />
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 28 }}>
                  {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(pg => (
                    <button
                      key={pg}
                      className={`btn btn-sm ${pg === page ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => { setPage(pg); fetchBookings(pg); }}
                    >
                      {pg}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </AppLayout>
  );
};

export default BookingsList;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DollarSign, CheckCircle, Clock, Star, TrendingUp } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/common/StatusBadge';
import { PageSpinner } from '../../components/common/Spinner';
import API from '../../services/api';
import { formatDate, formatCurrency, CATEGORY_ICONS } from '../../utils/helpers';
import toast from 'react-hot-toast';

const ProviderDashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile]   = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, bRes] = await Promise.all([
          API.get('/providers/me/profile'),
          API.get('/bookings/my?limit=8'),
        ]);
        setProfile(pRes.data.data);
        setBookings(bRes.data.data.bookings);
      } catch { toast.error('Failed to load dashboard'); }
      finally  { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <AppLayout><PageSpinner /></AppLayout>;

  const stats = [
    { label: 'Total Earnings',        value: formatCurrency(profile?.totalEarnings || 0), icon: <DollarSign size={22} />, color: '#22c55e', bg: '#dcfce7' },
    { label: 'Completed Site Visits', value: profile?.completedJobs || 0,                 icon: <CheckCircle size={22} />, color: '#5a85ff', bg: '#eef2ff' },
    { label: 'Avg Rating',            value: `${(profile?.rating?.average || 0).toFixed(1)} ★`, icon: <Star size={22} />, color: '#f59e0b', bg: '#fef3c7' },
    { label: 'Total Reviews',         value: profile?.rating?.totalReviews || 0,           icon: <TrendingUp size={22} />, color: '#8b5cf6', bg: '#ede9fe' },
  ];

  const pendingBookings = bookings.filter(b => b.status === 'pending');

  return (
    <AppLayout>
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 style={{ fontSize: 26 }}>Provider Dashboard</h1>
                {profile?.verificationStatus === 'verified' ? (
                  <span className="badge badge-success">✓ Verified</span>
                ) : (
                  <span className="badge badge-warning">⏳ {profile?.verificationStatus}</span>
                )}
              </div>
              <p style={{ color: 'var(--text-light)' }}>Manage your bookings and grow your business.</p>
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/provider/profile')}>Edit Profile</button>
          </motion.div>

          {/* Verification alert */}
          {profile?.verificationStatus !== 'verified' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 16, background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 12, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <p style={{ fontWeight: 600, color: '#92400e', fontSize: 14 }}>Verification Pending</p>
                <p style={{ color: '#78350f', fontSize: 13 }}>Upload your documents to get verified and start receiving bookings.</p>
              </div>
              <button className="btn btn-sm btn-primary" style={{ marginLeft: 'auto' }} onClick={() => navigate('/provider/profile')}>Upload Docs</button>
            </motion.div>
          )}

          {/* Stat cards */}
          <div className="grid-4" style={{ marginBottom: 28 }}>
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                className="stat-card-premium"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <style>{`.stat-card-premium:nth-child(${i + 1})::before { background: ${s.color}; }`}</style>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {s.icon}
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-dark)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
              </motion.div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Pending requests */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="card">
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 16 }}>Pending Requests <span className="badge badge-warning" style={{ marginLeft: 8 }}>{pendingBookings.length}</span></h2>
              </div>
              {pendingBookings.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-light)' }}>
                  <Clock size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <p style={{ fontSize: 14 }}>No pending requests</p>
                </div>
              ) : pendingBookings.map(b => (
                <div key={b._id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{b.serviceId?.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{b.customerId?.name} · {formatDate(b.scheduledDate)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{b.address?.city}</div>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={() => navigate(`/provider/bookings/${b._id}`)}>Respond</button>
                </div>
              ))}
            </motion.div>

            {/* Recent bookings */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="card">
              <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 16 }}>Recent Activity</h2>
                <button onClick={() => navigate('/provider/bookings')} style={{ fontSize: 13, color: '#5a85ff', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View All →</button>
              </div>
              {bookings.slice(0, 5).map(b => (
                <div key={b._id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{CATEGORY_ICONS[b.serviceId?.category] || '🔧'}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{b.serviceId?.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{formatDate(b.scheduledDate)}</div>
                    </div>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))}
            </motion.div>
          </div>
    </AppLayout>
  );
};

export default ProviderDashboard;

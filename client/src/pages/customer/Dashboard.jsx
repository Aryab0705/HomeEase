import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BookOpen, Clock, CheckCircle, XCircle,
  ArrowRight, Plus, MessageSquare,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/common/StatusBadge';
import { PageSpinner } from '../../components/common/Spinner';
import API from '../../services/api';
import { formatDate, formatCurrency, CATEGORY_ICONS } from '../../utils/helpers';
import toast from 'react-hot-toast';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4 } },
};
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

/* ── Premium Stat Card ────────────────────────────────────────────────────── */
const StatCard = ({ label, value, icon, color, bg, accent, trend }) => (
  <motion.div variants={fadeUp} className="stat-card-premium">
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '16px 16px 0 0' }} />
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: bg, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      {trend && (
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
          background: trend.startsWith('+') ? '#dcfce7' : '#fee2e2',
          color: trend.startsWith('+') ? '#15803d' : '#991b1b',
        }}>
          {trend}
        </span>
      )}
    </div>
    <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, color: 'var(--text-dark)', marginBottom: 4 }}>{value}</div>
    <div style={{ fontSize: 13, color: 'var(--text-light)', fontWeight: 500 }}>{label}</div>
  </motion.div>
);

/* ── Quick Action ─────────────────────────────────────────────────────────── */
const QuickAction = ({ to, icon, label, description, primary }) => (
  <Link
    to={to}
    style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 18px', borderRadius: 12,
      border: primary ? 'none' : '1.5px solid var(--border)',
      background: primary ? 'linear-gradient(135deg, var(--dark-accent), #7fa8ff)' : 'var(--white)',
      textDecoration: 'none', transition: 'all 0.2s',
      boxShadow: primary ? '0 4px 16px rgba(171,196,255,0.4)' : 'none',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      if (!primary) e.currentTarget.style.borderColor = 'var(--dark-accent)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform = 'translateY(0)';
      if (!primary) e.currentTarget.style.borderColor = 'var(--border)';
    }}
  >
    <div style={{
      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
      background: primary ? 'rgba(255,255,255,0.25)' : 'var(--primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: primary ? 'var(--text-dark)' : 'var(--dark-accent)',
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: primary ? 'rgba(30,41,59,0.7)' : 'var(--text-light)' }}>{description}</div>
    </div>
  </Link>
);

/* ════════════════════════════════════════════════════════════════════════════ */
const CustomerDashboard = () => {
  const { user } = useSelector(s => s.auth);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState({ total: 0, pending: 0, completed: 0, cancelled: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await API.get('/bookings/my?limit=6');
        const bk  = res.data.data.bookings;
        setBookings(bk);
        setStats({
          total:     res.data.data.pagination.total,
          pending:   bk.filter(b => ['pending','accepted','on_the_way','arrived'].includes(b.status)).length,
          completed: bk.filter(b => b.status === 'completed').length,
          cancelled: bk.filter(b => b.status === 'cancelled').length,
        });
      } catch { toast.error('Failed to load dashboard'); }
      finally  { setLoading(false); }
    };
    fetchData();
  }, []);

  const statCards = [
    { label: 'Total Bookings', value: stats.total,     icon: <BookOpen size={22} />,    color: '#2563eb', bg: '#dbeafe', accent: '#3b82f6', trend: '+12%' },
    { label: 'Active',         value: stats.pending,   icon: <Clock size={22} />,        color: '#d97706', bg: '#fef3c7', accent: '#f59e0b' },
    { label: 'Completed',      value: stats.completed, icon: <CheckCircle size={22} />,  color: '#16a34a', bg: '#dcfce7', accent: '#22c55e', trend: '+8%'  },
    { label: 'Cancelled',      value: stats.cancelled, icon: <XCircle size={22} />,      color: '#dc2626', bg: '#fee2e2', accent: '#ef4444' },
  ];

  if (loading) return (
    <AppLayout>
      <PageSpinner />
    </AppLayout>
  );

  return (
    <AppLayout>
      {/* Greeting */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
          Welcome back, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p style={{ color: 'var(--text-light)', fontSize: 15 }}>
          Here's what's happening with your bookings today.
        </p>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        className="grid-4"
        variants={stagger}
        initial="hidden"
        animate="show"
        style={{ marginBottom: 28 }}
      >
        {statCards.map(s => <StatCard key={s.label} {...s} />)}
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <QuickAction to="/services" icon={<Plus size={18} />}          label="Book a Service" description="Find verified professionals" primary />
          <QuickAction to="/bookings" icon={<BookOpen size={18} />}      label="View Bookings"  description="Track all your bookings" />
          <QuickAction to="/chat"     icon={<MessageSquare size={18} />} label="Messages"       description="Chat with providers" />
        </div>
      </motion.div>

      {/* Recent Bookings */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" className="card">
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Recent Bookings</h2>
          <Link to="/bookings" style={{ fontSize: 13, color: 'var(--dark-accent)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            View All <ArrowRight size={14} />
          </Link>
        </div>

        {bookings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>No bookings yet</h3>
            <p style={{ color: 'var(--text-light)', fontSize: 14, maxWidth: 280, marginBottom: 24 }}>
              Start by booking a service from our verified professionals.
            </p>
            <Link to="/services" className="btn btn-primary btn-lg">Browse Services</Link>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Provider</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                          {CATEGORY_ICONS[b.serviceId?.category] || '🔧'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{b.serviceId?.name || 'Service'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{b.serviceId?.category}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{b.providerId?.userId?.name || '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-light)' }}>{formatDate(b.scheduledDate)}</td>
                    <td style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(b.siteVisitFee || b.consultationFee || b.pricing?.consultationFee || b.totalAmount || b.estimatedAmount || 0)}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td>
                      <Link to={`/bookings/${b._id}`} style={{ fontSize: 12, color: 'var(--dark-accent)', textDecoration: 'none', fontWeight: 600 }}>
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default CustomerDashboard;

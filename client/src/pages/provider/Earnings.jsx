import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, CheckCircle, Calendar, ArrowDownLeft } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { SkeletonTable } from '../../components/common/Skeleton';
import API from '../../services/api';

const statCard = (icon, label, value, color) => (
  <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icon}
    </div>
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-dark)' }}>{value}</p>
    </div>
  </div>
);

const Earnings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(urlTab === 'payouts' ? 'payouts' : 'earnings');
  const [bookings, setBookings]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState(null);

  useEffect(() => {
    if (urlTab === 'payouts') setActiveTab('payouts');
  }, [urlTab]);

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        // Fetch provider bookings to compute site visit earnings & payouts ledger
        const { data } = await API.get('/bookings/my', { params: { limit: 100 } });
        setBookings(data.data?.bookings ?? []);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load earnings');
      } finally {
        setLoading(false);
      }
    };
    fetchEarnings();
  }, []);

  const getSiteVisitFee = (b) => {
    const fee =
      b?.siteVisitFee ||
      b?.consultationFee ||
      b?.pricing?.consultationFee ||
      b?.totalAmount ||
      b?.estimatedAmount ||
      0;
    return Number(fee);
  };

  const isCompletedVisit = (b) =>
    b.settlementStatus === 'PROVIDER_EARNED' ||
    b.status === 'settled' ||
    b.status === 'completed';

  const completedVisits = bookings.filter(isCompletedVisit);

  const totalEarnings = completedVisits.reduce((sum, b) => sum + getSiteVisitFee(b), 0);
  const completedVisitsCount = completedVisits.length;

  const now = new Date();
  const thisMonthEarnings = completedVisits
    .filter(b => {
      const d = new Date(b.settledAt || b.siteVisitCompletedAt || b.completedAt || b.updatedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, b) => sum + getSiteVisitFee(b), 0);

  const avgSiteVisitFee = completedVisitsCount ? Math.round(totalEarnings / completedVisitsCount) : 0;

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  const displayedList = activeTab === 'payouts'
    ? bookings.filter(b => ['PROVIDER_EARNED', 'REFUNDED'].includes(b.settlementStatus) || ['settled', 'completed', 'cancelled'].includes(b.status))
    : completedVisits;

  return (
    <AppLayout>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Earnings & Settlements</h1>
        <p style={{ color: 'var(--text-light)', fontSize: 14 }}>
          Track internal site visit consultation earnings, payouts, and customer decisions
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {statCard(<DollarSign size={22} color="#22C55E" />, 'Total Earnings', formatCurrency(totalEarnings), '#22C55E')}
        {statCard(<CheckCircle size={22} color="#6366f1" />, 'Completed Site Visits', completedVisitsCount, '#6366f1')}
        {statCard(<TrendingUp size={22} color="#f59e0b" />, 'This Month', formatCurrency(thisMonthEarnings), '#f59e0b')}
        {statCard(<Calendar size={22} color="#3b82f6" />, 'Average Site Visit Fee', formatCurrency(avgSiteVisitFee), '#3b82f6')}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <button
          type="button"
          onClick={() => { setActiveTab('earnings'); setSearchParams({}); }}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'earnings' ? '#eff6ff' : 'transparent',
            color: activeTab === 'earnings' ? '#1d4ed8' : 'var(--text-light)',
          }}
        >
          Completed Site Visits ({completedVisitsCount})
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('payouts'); setSearchParams({ tab: 'payouts' }); }}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'payouts' ? '#eff6ff' : 'transparent',
            color: activeTab === 'payouts' ? '#1d4ed8' : 'var(--text-light)',
          }}
        >
          Payouts & Ledger ({displayedList.length})
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
            {activeTab === 'payouts' ? 'Settlements & Payout Ledger' : 'Completed Site Visits'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 4 }}>
            {activeTab === 'payouts'
              ? 'Complete record of credited site visit fees and refunded cancellations'
              : 'Every completed site visit credits your stored consultation fee'}
          </p>
        </div>

        {loading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : error ? (
          <p style={{ color: 'var(--error)', textAlign: 'center', padding: 32 }}>{error}</p>
        ) : displayedList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-light)' }}>
            <DollarSign size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <p style={{ fontWeight: 600, marginBottom: 6 }}>No records found</p>
            <p style={{ fontSize: 13 }}>Your site visit fees will appear here once visits are completed</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Date', 'Customer', 'Service', 'Site Visit Fee', 'Status', 'Project Outcome'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-light)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedList.map((b, i) => {
                  const fee = getSiteVisitFee(b);
                  const isEarned = b.settlementStatus === 'PROVIDER_EARNED' || b.status === 'settled' || b.status === 'completed';
                  const isRefunded = b.settlementStatus === 'REFUNDED' || b.paymentStatus === 'refunded';

                  return (
                    <motion.tr
                      key={b._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'white' : 'var(--bg)' }}
                    >
                      <td style={{ padding: '12px 12px', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                        {formatDate(b.settledAt || b.siteVisitCompletedAt || b.completedAt || b.updatedAt)}
                      </td>
                      <td style={{ padding: '12px 12px', fontWeight: 500 }}>
                        {b.customerId?.name || 'Customer'}
                      </td>
                      <td style={{ padding: '12px 12px', color: 'var(--text-light)' }}>
                        {b.serviceId?.name || b.serviceId?.category || 'Service'}
                      </td>
                      <td style={{ padding: '12px 12px', fontWeight: 700, color: isEarned ? '#16a34a' : '#94a3b8' }}>
                        {isEarned ? `+${formatCurrency(fee)}` : '₹0'}
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        {isEarned ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#dcfce7', color: '#15803d' }}>
                            ✓ Settled to Provider
                          </span>
                        ) : isRefunded ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#fee2e2', color: '#991b1b' }}>
                            Refunded to Customer
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#f1f5f9', color: '#475569' }}>
                            {b.status?.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 12px', fontSize: 12, color: 'var(--text-light)' }}>
                        {b.customerDecision === 'PROCEED'
                          ? 'Agreed to Proceed'
                          : b.customerDecision === 'NOT_PROCEED'
                          ? 'Declined Project (Fee Retained)'
                          : isRefunded
                          ? 'Cancelled before arrival'
                          : 'Visit Completed'}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Earnings;

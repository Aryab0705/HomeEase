import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, RefreshCw, ArrowUp, Wallet, CreditCard } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import API from '../../services/api';
import toast from 'react-hot-toast';

const PERIODS = [
  { value: 'daily',   label: 'Daily (30d)' },
  { value: 'weekly',  label: 'Weekly (12w)' },
  { value: 'monthly', label: 'Monthly (12m)' },
  { value: 'yearly',  label: 'Yearly (5y)' },
];

const formatINR = (v) => `₹${(v || 0).toLocaleString('en-IN')}`;

const AdminRevenue = () => {
  const [period, setPeriod]   = useState('monthly');
  const [data, setData]       = useState([]);
  const [totals, setTotals]   = useState({});
  const [loading, setLoading] = useState(true);

  const fetchRevenue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/admin/revenue', { params: { period } });
      setData(res.data.data?.data || []);
      setTotals(res.data.data?.totals || {});
    } catch {
      toast.error('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 10, letterSpacing: '-0.3px' }}>
              <CreditCard size={24} color="#2563eb" /> Revenue & Financial Analytics
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              Real-time platform revenue, provider earnings ledger, and commission breakdown
            </p>
          </div>
          <button
            onClick={fetchRevenue}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8,
              background: '#2563eb', color: 'white',
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              boxShadow: '0 1px 3px rgba(37, 99, 235, 0.2)'
            }}
          >
            <RefreshCw size={14} /> Refresh Data
          </button>
        </div>
      </motion.div>

      {/* Period Switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: period === p.value ? 'none' : '1px solid #e2e8f0',
              background: period === p.value ? '#2563eb' : 'white',
              color: period === p.value ? 'white' : '#374151',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: period === p.value ? '0 1px 3px rgba(37, 99, 235, 0.2)' : 'none'
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          {
            label: 'Total Captured Revenue',
            value: formatINR(totals.revenue),
            color: '#2563eb',
            bg: '#eff6ff',
            icon: <CreditCard size={20} />
          },
          {
            label: 'Provider Earnings (Settled)',
            value: formatINR(totals.providerEarnings || 0),
            color: '#10b981',
            bg: '#ecfdf5',
            icon: <Wallet size={20} />
          },
          {
            label: 'Platform Commission (15%)',
            value: formatINR(totals.commission),
            color: '#6366f1',
            bg: '#eef2ff',
            icon: <TrendingUp size={20} />
          },
          {
            label: 'Total Site Visits / Bookings',
            value: (totals.bookings || 0).toLocaleString('en-IN'),
            color: '#3b82f6',
            bg: '#eff6ff',
            icon: <ArrowUp size={20} />
          },
        ].map(card => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'white',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: card.bg, color: card.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>{card.value}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{card.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Area Chart */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{
          background: 'white',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: 24,
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>
          Revenue & Platform Commission Trend
        </h3>
        {loading ? (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            Loading revenue data...
          </div>
        ) : data.length === 0 ? (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            No revenue recorded in this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="comGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
                formatter={(v, name) => [formatINR(v), name === 'revenue' ? 'Captured Payments' : 'Commission (15%)']}
              />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} fill="url(#revGrad)" dot={false} name="Captured Revenue" />
              <Area type="monotone" dataKey="commission" stroke="#6366f1" strokeWidth={2} fill="url(#comGrad)" dot={false} name="Commission (15%)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Bar Chart — Bookings */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{
          background: 'white',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>
          Site Visit Bookings per Period
        </h3>
        {!loading && data.length > 0 && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: 10, fontSize: 13 }} />
              <Bar dataKey="bookings" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Site Visits" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>
    </div>
  );
};

export default AdminRevenue;

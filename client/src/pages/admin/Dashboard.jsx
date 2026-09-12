import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  TrendingUp, TrendingDown, Users, Briefcase, BookOpen, DollarSign,
  Star, AlertCircle, Shield, Clock, CheckCircle, XCircle, Activity,
  Zap, ArrowRight, RefreshCw, Calendar, ShieldCheck,
  CreditCard, Wallet, RotateCcw
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

import API from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { SkeletonCard } from '../../components/common/Skeleton';

// --- StatCard Component ---
const StatCard = ({ title, value, icon, color, bg, subtitle, trend, trendValue, prefix, suffix, onClick, urgent, highlight }) => (
  <motion.div
    whileHover={{ scale: 1.02, y: -2 }}
    onClick={onClick}
    style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      border: `1px solid ${urgent ? color : highlight ? '#cbd5e1' : '#e2e8f0'}`,
      boxShadow: highlight ? '0 4px 12px rgba(90, 133, 255, 0.08)' : '0 1px 3px rgba(0,0,0,0.05)',
      cursor: onClick ? 'pointer' : 'default',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}
  >
    {urgent && (
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: color }} />
    )}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
      <div style={{
        width: '42px', height: '42px', borderRadius: '10px',
        background: bg, color: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
      }}>
        {icon}
      </div>
      {trendValue && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: trend === 'up' ? '#16a34a' : '#dc2626' }}>
          {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {trendValue}
        </div>
      )}
      {urgent && (
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '12px' }}>
          Action Required
        </span>
      )}
    </div>

    <div>
      <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', marginBottom: '4px' }}>
        {prefix}{value}{suffix}
      </div>
      <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
          {subtitle}
        </div>
      )}
    </div>
  </motion.div>
);

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PIE_COLORS = {
  completed: '#10b981',
  settled: '#059669',
  pending: '#f59e0b',
  cancelled: '#ef4444',
  accepted: '#6366f1',
  on_the_way: '#3b82f6',
  arrived: '#8b5cf6',
  site_visit_completed: '#06b6d4',
  customer_decision: '#ec4899',
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [revenuePeriod, setRevenuePeriod] = useState('Monthly');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const autoRefreshTimerRef = useRef(null);
  const isFetchingRef = useRef(false);

  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      const res = await API.get('/admin/dashboard');
      setData(res.data.data);
      setLastUpdated(new Date());
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to load dashboard data. Please try again.';
      if (!isSilent) {
        setError(errMsg);
        toast.error(errMsg, { id: 'admin-dashboard-error' });
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  // Auto-refresh polling every 30 seconds
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshTimerRef.current = setInterval(() => {
        fetchDashboardData(true);
      }, 30000);
    }
    return () => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
    };
  }, [autoRefresh, fetchDashboardData]);

  if (loading && !data) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '20px', color: '#1e293b', marginBottom: '8px' }}>{error}</h2>
        <button
          onClick={() => fetchDashboardData(false)}
          style={{
            padding: '10px 20px', background: '#3b82f6', color: 'white',
            border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer'
          }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const {
    overview = {},
    charts = {},
    recentBookings = [],
    recentProviders = [],
    pendingVerificationsList = [],
    activityFeed = [],
  } = data || {};

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  // Dynamic charts formatting
  const revenueData = (revenuePeriod === 'Daily' ? (charts.dailyRevenue || []) : (charts.monthlyRevenue || charts.revenue || [])).map(d => {
    let name = '';
    if (d._id?.day) {
      name = `${MONTH_NAMES[d._id.month - 1]} ${d._id.day}`;
    } else if (d._id?.month) {
      name = `${MONTH_NAMES[d._id.month - 1]} ${d._id.year || ''}`;
    } else {
      name = d.label || String(d._id);
    }
    return {
      name,
      revenue: d.revenue || 0,
      commission: Math.round((d.revenue || 0) * 0.15)
    };
  });

  const bookingsData = (charts.monthlyBookings || []).map(d => ({
    name: MONTH_NAMES[d._id?.month - 1] || d.label || String(d._id),
    count: d.count
  }));

  const pieData = (charts.bookingStatusBreakdown || []).map(d => ({
    name: d._id?.replace(/_/g, ' ')?.toUpperCase() || 'UNKNOWN',
    rawStatus: d._id,
    value: d.count
  }));

  const topCategories = (charts.categoryBreakdown || charts.topCategories || []).map(d => ({
    name: d._id || 'Uncategorized',
    count: d.count
  }));

  const cardStyle = {
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    padding: '24px'
  };

  const sectionTitleStyle = {
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '4px',
    letterSpacing: '-0.2px'
  };

  const sectionSubtitleStyle = {
    fontSize: '13px',
    color: '#64748b',
    marginBottom: '20px'
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ paddingBottom: '40px' }}>
      
      {/* Top Banner with Greeting and Live Refresh Controls */}
      <motion.div
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '14px',
          padding: '24px 28px',
          color: 'white',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.15)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '6px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }}>
              {greeting}, {user?.name?.split(' ')[0] || 'Admin'}!
            </h1>
            <span style={{
              background: 'rgba(34, 197, 94, 0.2)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              color: '#86efac',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
              Live DB
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 14px 0' }}>
            Site visit activity, customer payments, and provider earnings ledger
          </p>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,0.08)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
              {overview.bookingsToday || 0} Site Visits Today
            </span>
            <span style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
              {overview.pendingVerifications || 0} Verifications Pending
            </span>
            <span style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
              {formatCurrency(overview.revenueToday || 0)} Paid Today
            </span>
          </div>
        </div>

        {/* Live Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              background: autoRefresh ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${autoRefresh ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.15)'}`,
              color: autoRefresh ? '#86efac' : '#94a3b8',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s'
            }}
          >
            <Activity size={14} />
            {autoRefresh ? 'Auto-refresh: ON (30s)' : 'Auto-refresh: OFF'}
          </button>

          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            title="Refresh now"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'white',
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </motion.div>

      {/* SECTION 1: Operations & Financial KPI Cards */}
      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
          Site Visit Operations & User Growth
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard
            title="Total Users"
            value={overview.totalUsers || ((overview.totalCustomers || 0) + (overview.totalProviders || 0))}
            icon={<Users size={20} />}
            color="#3b82f6"
            bg="#eff6ff"
            subtitle={`${overview.totalCustomers || 0} customers · ${overview.totalProviders || 0} providers`}
            onClick={() => navigate('/admin/users')}
          />
          <StatCard
            title="Active Providers"
            value={overview.activeProviders || 0}
            icon={<Briefcase size={20} />}
            color="#10b981"
            bg="#dcfce7"
            subtitle="Verified & ready for bookings"
            onClick={() => navigate('/admin/providers')}
          />
          <StatCard
            title="Pending Verification"
            value={overview.pendingVerifications || 0}
            icon={<ShieldCheck size={20} />}
            color="#f59e0b"
            bg="#fef3c7"
            urgent={overview.pendingVerifications > 0}
            subtitle="Awaiting admin document review"
            onClick={() => navigate('/admin/verification')}
          />
          <StatCard
            title="Active Site Visits"
            value={overview.activeBookings || 0}
            icon={<Activity size={20} />}
            color="#6366f1"
            bg="#e0e7ff"
            subtitle="Accepted / On Way / Arrived"
            onClick={() => navigate('/admin/bookings')}
          />
          <StatCard
            title="Completed Site Visits"
            value={overview.completedSiteVisits || overview.completedBookings || 0}
            icon={<CheckCircle size={20} />}
            color="#059669"
            bg="#ecfdf5"
            subtitle="Successfully inspected / settled"
            onClick={() => navigate('/admin/bookings')}
          />
          <StatCard
            title="Cancelled Visits"
            value={overview.cancelledSiteVisits || overview.cancelledBookings || 0}
            icon={<XCircle size={20} />}
            color="#ef4444"
            bg="#fee2e2"
            subtitle="Cancelled before visit"
            onClick={() => navigate('/admin/bookings')}
          />
        </div>
      </div>

      {/* SECTION 2: Real Financial Ledger Overview */}
      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
          Finance & Settlement Ledger
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard
            title="Total Captured Payments"
            value={formatCurrency(overview.totalRevenue || 0)}
            icon={<CreditCard size={20} />}
            color="#2563eb"
            bg="#eff6ff"
            highlight={true}
            subtitle={`${overview.successfulPaymentsCount || 0} successful online payments`}
            onClick={() => navigate('/admin/payments')}
          />
          <StatCard
            title="Provider Earnings Settled"
            value={formatCurrency(overview.totalProviderEarnings || 0)}
            icon={<Wallet size={20} />}
            color="#10b981"
            bg="#ecfdf5"
            highlight={true}
            subtitle={`From ${overview.settledVisitsCount || 0} settled site visits`}
            onClick={() => navigate('/admin/revenue')}
          />
          <StatCard
            title="Platform Commission (Est.)"
            value={formatCurrency(overview.platformCommission || 0)}
            icon={<DollarSign size={20} />}
            color="#8b5cf6"
            bg="#f3e8ff"
            subtitle="Platform margin / operations"
            onClick={() => navigate('/admin/revenue')}
          />
          <StatCard
            title="Refunded to Customers"
            value={formatCurrency(overview.refundedAmount || 0)}
            icon={<RotateCcw size={20} />}
            color="#f97316"
            bg="#fff7ed"
            subtitle={`${overview.refundedPaymentsCount || 0} refunded bookings`}
            onClick={() => navigate('/admin/payments')}
          />
        </div>
      </div>

      {/* SECTION 3: Real-Time Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Revenue Overview Chart */}
        <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={sectionTitleStyle}>Revenue Trends</h3>
              <p style={sectionSubtitleStyle}>Real-time captured payments from database</p>
            </div>
            <div style={{ display: 'flex', gap: '6px', background: '#f8fafc', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              {['Daily', 'Monthly'].map(period => (
                <button
                  key={period}
                  onClick={() => setRevenuePeriod(period)}
                  style={{
                    padding: '6px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '6px',
                    background: revenuePeriod === period ? 'white' : 'transparent',
                    color: revenuePeriod === period ? '#0f172a' : '#64748b',
                    border: 'none',
                    boxShadow: revenuePeriod === period ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    cursor: 'pointer'
                  }}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={v => `₹${v}`} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={(value, name) => [`${formatCurrency(value)}`, name === 'revenue' ? 'Captured Payments' : 'Commission (15%)']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Site Visits Status Breakdown */}
        <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={cardStyle}>
          <h3 style={sectionTitleStyle}>Site Visit Statuses</h3>
          <p style={sectionSubtitleStyle}>Real-time breakdown of all bookings</p>
          <ResponsiveContainer width="100%" height={240}>
            {pieData.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                No booking records yet
              </div>
            ) : (
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.rawStatus] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            )}
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* SECTION 4: Provider Registrations & Categories */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={cardStyle}>
          <h3 style={sectionTitleStyle}>Monthly Booking Volume</h3>
          <p style={sectionSubtitleStyle}>Site visit requests received per month</p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={bookingsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={cardStyle}>
          <h3 style={sectionTitleStyle}>Top Service Categories</h3>
          <p style={sectionSubtitleStyle}>Most booked services on HomeEase</p>
          <ResponsiveContainer width="100%" height={230}>
            {topCategories.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                No categorized bookings yet
              </div>
            ) : (
              <BarChart data={topCategories} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* SECTION 5: Recent Site Visits Table */}
      <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ ...cardStyle, padding: 0, overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h3 style={{ ...sectionTitleStyle, marginBottom: '2px' }}>Recent Site Visits</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Latest customer bookings and consultation fees</p>
          </div>
          <button
            onClick={() => navigate('/admin/bookings')}
            style={{ color: '#2563eb', background: 'none', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            View All Bookings <ArrowRight size={14} />
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer</th>
                <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Provider</th>
                <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Service</th>
                <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                <th style={{ padding: '12px 20px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Site Visit Fee</th>
                <th style={{ padding: '12px 24px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    No site visit bookings recorded yet
                  </td>
                </tr>
              ) : recentBookings.slice(0, 7).map(booking => {
                const fee = booking.siteVisitFee || booking.consultationFee || booking.pricing?.consultationFee || booking.totalAmount || 0;
                return (
                  <tr key={booking._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 24px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{booking.customerId?.name || 'Customer'}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{booking.customerId?.email}</div>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '14px', color: '#334155' }}>
                      {booking.providerId?.userId?.name || 'Assigned Provider'}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '14px', color: '#334155' }}>
                      {booking.serviceId?.name || 'Home Service'}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#64748b' }}>
                      {formatDate(booking.scheduledDate)}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                      {formatCurrency(fee)}
                    </td>
                    <td style={{ padding: '14px 24px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: '16px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                        background: PIE_COLORS[booking.status] ? `${PIE_COLORS[booking.status]}18` : '#f1f5f9',
                        color: PIE_COLORS[booking.status] || '#64748b'
                      }}>
                        {booking.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* SECTION 6: Live Activity Stream & Verification Queue */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Real Live Activity Feed */}
        <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={sectionTitleStyle}>Live Activity Stream</h3>
              <p style={sectionSubtitleStyle}>Real-time platform events & transactions</p>
            </div>
            <span style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} /> {lastUpdated.toLocaleTimeString()}
            </span>
          </div>

          <div style={{ position: 'relative', paddingLeft: '20px' }}>
            <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: '2px', background: '#e2e8f0' }} />
            {activityFeed.length === 0 ? (
              <div style={{ padding: '24px 0', color: '#94a3b8', textAlign: 'center' }}>No live activity recorded yet</div>
            ) : activityFeed.slice(0, 7).map((item, i) => {
              let Icon = Zap, color = '#64748b', bg = '#f1f5f9';
              if (item.type === 'user_registered') { Icon = Users; color = '#2563eb'; bg = '#eff6ff'; }
              if (item.type === 'provider_registered') { Icon = Briefcase; color = '#8b5cf6'; bg = '#f3e8ff'; }
              if (item.type === 'booking_created') { Icon = BookOpen; color = '#10b981'; bg = '#ecfdf5'; }
              if (item.type === 'payment_recorded') { Icon = CreditCard; color = '#059669'; bg = '#ecfdf5'; }
              if (item.type === 'review_submitted') { Icon = Star; color = '#eab308'; bg = '#fef9c3'; }
              if (item.type === 'complaint_raised') { Icon = AlertCircle; color = '#ef4444'; bg = '#fee2e2'; }
              
              return (
                <div key={i} style={{ display: 'flex', gap: '14px', marginBottom: '18px', position: 'relative' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', background: 'white', border: `2px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: color, position: 'absolute', left: '-27px', top: '2px'
                  }}>
                    <Icon size={13} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{item.title}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', wordBreak: 'break-word' }}>{item.description}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{item.timeAgo || 'Just now'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Pending Provider Verifications */}
        <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ ...sectionTitleStyle, marginBottom: '2px' }}>Pending Verifications</h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Providers awaiting document review</p>
            </div>
            <button
              onClick={() => navigate('/admin/verification')}
              style={{ color: '#2563eb', background: 'none', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              Open Center <ArrowRight size={14} />
            </button>
          </div>
          <div>
            {pendingVerificationsList.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                <CheckCircle size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 600, color: '#1e293b' }}>All Caught Up!</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>No pending provider verifications in queue.</div>
              </div>
            ) : pendingVerificationsList.slice(0, 5).map(p => (
              <div key={p._id} style={{ padding: '14px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706', fontWeight: 700, flexShrink: 0 }}>
                    {p.userId?.name?.[0] || 'P'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{p.userId?.name || 'Provider'}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{p.primaryCategory || 'Home Services'}</div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/admin/verification')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* SECTION 7: System Status Footer */}
      <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={{ ...cardStyle, background: '#f8fafc', padding: '18px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
              API Operational
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
              MongoDB Atlas Connected
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
              Site Visit Fee Model Active
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            HomeEase Admin Platform v2.0 · Refreshed at {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
      </motion.div>

    </motion.div>
  );
};

export default Dashboard;

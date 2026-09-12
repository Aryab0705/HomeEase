import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Search, Filter, Eye, ChevronLeft, ChevronRight,
  Calendar, RefreshCw, DollarSign, Clock, CheckCircle, XCircle
} from 'lucide-react';
import API from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  pending:              { bg: '#fef3c7', text: '#92400e', label: 'Pending' },
  accepted:             { bg: '#dbeafe', text: '#1e40af', label: 'Accepted' },
  on_the_way:           { bg: '#e0e7ff', text: '#3730a3', label: 'On the Way' },
  arrived:              { bg: '#f3e8ff', text: '#6b21a8', label: 'Arrived' },
  site_visit_completed: { bg: '#e0f2fe', text: '#0369a1', label: 'Visit Done' },
  customer_decision:    { bg: '#fef9c3', text: '#854d0e', label: 'Decision' },
  settled:              { bg: '#dcfce7', text: '#15803d', label: 'Settled' },
  completed:            { bg: '#dcfce7', text: '#166534', label: 'Completed' },
  cancelled:            { bg: '#fee2e2', text: '#991b1b', label: 'Cancelled' },
  rejected:             { bg: '#f3f4f6', text: '#374151', label: 'Rejected' },
};

const AdminBookings = () => {
  const [bookings, setBookings]   = useState([]);
  const [summary, setSummary]     = useState({});
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);
  const [status, setStatus]       = useState('');
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState('');
  const LIMIT = 15;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (status) params.status = status;
      if (search) params.search = search;
      const res = await API.get('/admin/bookings', { params });
      setBookings(res.data.data?.bookings || []);
      setTotal(res.data.data?.pagination?.total || 0);
      setSummary(res.data.data?.summary || {});
    } catch { toast.error('Failed to load bookings'); }
    finally { setLoading(false); }
  }, [page, status, search]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const totalPages = Math.ceil(total / LIMIT);

  const statusTabs = [
    { value: '', label: 'All', count: summary.total },
    { value: 'pending', label: 'Pending', count: summary.pending },
    { value: 'accepted,on_the_way,arrived,site_visit_completed', label: 'Active', count: summary.active },
    { value: 'settled,completed', label: 'Settled / Done', count: summary.completed },
    { value: 'cancelled', label: 'Cancelled', count: summary.cancelled },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
              <BookOpen size={22} color="#3b82f6" /> Booking Management
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              {total} total bookings · ₹{(summary.totalRevenue || 0).toLocaleString('en-IN')} revenue
            </p>
          </div>
          <button onClick={fetch} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total', value: summary.total || 0, color: '#3b82f6', bg: '#eff6ff', icon: <BookOpen size={18} /> },
          { label: 'Pending', value: summary.pending || 0, color: '#f59e0b', bg: '#fffbeb', icon: <Clock size={18} /> },
          { label: 'Active', value: summary.active || 0, color: '#6366f1', bg: '#eef2ff', icon: <Filter size={18} /> },
          { label: 'Completed', value: summary.completed || 0, color: '#22c55e', bg: '#f0fdf4', icon: <CheckCircle size={18} /> },
          { label: 'Cancelled', value: summary.cancelled || 0, color: '#ef4444', bg: '#fef2f2', icon: <XCircle size={18} /> },
        ].map(card => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>{card.value}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{card.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 16 }}>
        {/* Status Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 20px' }}>
          {statusTabs.map(tab => (
            <button key={tab.value} onClick={() => { setStatus(tab.value); setPage(1); }}
              style={{ padding: '14px 16px', border: 'none', background: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderBottom: status === tab.value ? '2px solid #3b82f6' : '2px solid transparent', color: status === tab.value ? '#3b82f6' : '#64748b', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {tab.label}
              {tab.count !== undefined && <span style={{ background: status === tab.value ? '#dbeafe' : '#f1f5f9', color: status === tab.value ? '#1d4ed8' : '#64748b', borderRadius: 20, padding: '1px 7px', fontSize: 11 }}>{tab.count}</span>}
            </button>
          ))}
        </div>
        {/* Search */}
        <div style={{ padding: '14px 20px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by customer name or service..." type="text"
                style={{ width: '100%', paddingLeft: 34, padding: '9px 12px 9px 34px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }} />
            </div>
            <button type="submit" style={{ padding: '9px 20px', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Search</button>
            {(search || status) && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); setStatus(''); setPage(1); }}
              style={{ padding: '9px 16px', borderRadius: 8, background: '#f1f5f9', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: 13 }}>Clear</button>}
          </form>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <BookOpen size={40} color="#e2e8f0" style={{ margin: '0 auto 12px' }} />
            <div style={{ color: '#64748b', fontSize: 15 }}>No bookings found</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['#', 'Customer', 'Provider', 'Service', 'Date', 'Amount', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map((b, i) => {
                  const st = STATUS_COLORS[b.status] || { bg: '#f1f5f9', text: '#374151', label: b.status };
                  return (
                    <tr key={b._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>#{(i + 1 + (page - 1) * LIMIT).toString().padStart(3, '0')}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{b.customerId?.name || 'N/A'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{b.customerId?.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>{b.providerId?.userId?.name || 'N/A'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{b.serviceId?.name || 'N/A'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{b.serviceId?.category}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} color="#94a3b8" />{formatDate(b.scheduledDate)}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{formatCurrency(b.totalAmount || 0)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: st.bg, color: st.text, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, background: '#eff6ff', color: '#3b82f6', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          <Eye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #e2e8f0', background: page === 1 ? '#f8fafc' : 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === 1 ? '#cbd5e1' : '#374151' }}>
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    style={{ width: 34, height: 34, borderRadius: 8, border: p === page ? 'none' : '1px solid #e2e8f0', background: p === page ? '#3b82f6' : 'white', color: p === page ? 'white' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: p === page ? 700 : 400 }}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #e2e8f0', background: page === totalPages ? '#f8fafc' : 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === totalPages ? '#cbd5e1' : '#374151' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBookings;

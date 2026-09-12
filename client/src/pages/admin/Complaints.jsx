import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Search, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, Clock, Eye } from 'lucide-react';
import API from '../../services/api';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  open:         { bg: '#fee2e2', text: '#991b1b', label: 'Open' },
  under_review: { bg: '#fef3c7', text: '#92400e', label: 'Under Review' },
  resolved:     { bg: '#dcfce7', text: '#166534', label: 'Resolved' },
  closed:       { bg: '#f1f5f9', text: '#475569', label: 'Closed' },
};

const CATEGORY_LABELS = {
  work_quality: 'Work Quality', payment_issue: 'Payment Issue',
  no_show: 'No Show', unprofessional_behavior: 'Unprofessional',
  overcharging: 'Overcharging', other: 'Other',
};

const AdminComplaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [summary, setSummary]       = useState({});
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [status, setStatus]         = useState('');
  const [resolving, setResolving]   = useState(null);
  const LIMIT = 10;

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (status) params.status = status;
      const res = await API.get('/admin/complaints', { params });
      setComplaints(res.data.data?.complaints || []);
      setTotal(res.data.data?.pagination?.total || 0);
      setSummary(res.data.data?.summary || {});
    } catch { toast.error('Failed to load complaints'); }
    finally { setLoading(false); }
  }, [page, status]);

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  const handleResolve = async (id) => {
    setResolving(id);
    try {
      await API.patch(`/admin/complaints/${id}`, { status: 'resolved', resolution: 'Resolved by admin.' });
      toast.success('Complaint resolved');
      fetchComplaints();
    } catch { toast.error('Failed to resolve'); }
    finally { setResolving(null); }
  };

  const totalPages = Math.ceil(total / LIMIT);
  const statusTabs = [
    { value: '', label: 'All', count: (summary.open || 0) + (summary.under_review || 0) + (summary.resolved || 0) + (summary.closed || 0) },
    { value: 'open', label: 'Open', count: summary.open },
    { value: 'under_review', label: 'Under Review', count: summary.under_review },
    { value: 'resolved', label: 'Resolved', count: summary.resolved },
    { value: 'closed', label: 'Closed', count: summary.closed },
  ];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={22} color="#ef4444" /> Complaints & Disputes
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
              {summary.open || 0} open · {summary.under_review || 0} under review
            </p>
          </div>
          <button onClick={fetchComplaints} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Open', value: summary.open || 0, color: '#ef4444', bg: '#fef2f2' },
          { label: 'Under Review', value: summary.under_review || 0, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Resolved', value: summary.resolved || 0, color: '#22c55e', bg: '#f0fdf4' },
          { label: 'Closed', value: summary.closed || 0, color: '#64748b', bg: '#f8fafc' },
        ].map(c => (
          <div key={c.label} style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 20px' }}>
          {statusTabs.map(tab => (
            <button key={tab.value} onClick={() => { setStatus(tab.value); setPage(1); }}
              style={{ padding: '14px 16px', border: 'none', background: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderBottom: status === tab.value ? '2px solid #ef4444' : '2px solid transparent', color: status === tab.value ? '#ef4444' : '#64748b', marginBottom: -1, gap: 6, display: 'flex', alignItems: 'center' }}>
              {tab.label}
              {tab.count !== undefined && <span style={{ background: '#f1f5f9', borderRadius: 20, padding: '1px 7px', fontSize: 11, color: '#64748b' }}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading complaints...</div>
        ) : complaints.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <CheckCircle size={40} color="#22c55e" style={{ margin: '0 auto 12px' }} />
            <div style={{ color: '#64748b', fontSize: 15 }}>No complaints found — great news!</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Complaint', 'Category', 'Raised By', 'Against', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {complaints.map(c => {
                const st = STATUS_CONFIG[c.status] || { bg: '#f1f5f9', text: '#374151', label: c.status };
                return (
                  <tr key={c._id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>#{c._id.toString().slice(-6).toUpperCase()}</div>
                      <div style={{ fontSize: 12, color: '#374151', marginTop: 2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.reason}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}><span style={{ background: '#f1f5f9', color: '#374151', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>{CATEGORY_LABELS[c.category] || c.category}</span></td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{c.raisedBy?.name || 'N/A'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>{c.raisedAgainst?.name || 'N/A'}</td>
                    <td style={{ padding: '12px 16px' }}><span style={{ background: st.bg, color: st.text, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>{st.label}</span></td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{formatDate(c.createdAt)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {(c.status === 'open' || c.status === 'under_review') && (
                          <button onClick={() => handleResolve(c._id)} disabled={resolving === c._id}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            <CheckCircle size={12} /> {resolving === c._id ? '...' : 'Resolve'}
                          </button>
                        )}
                        <button style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, background: '#eff6ff', color: '#3b82f6', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                          <Eye size={12} /> View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Page {page} of {totalPages}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: page === 1 ? 0.4 : 1 }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: page === totalPages ? 0.4 : 1 }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminComplaints;

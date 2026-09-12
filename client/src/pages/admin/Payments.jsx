import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  CreditCard, Search, DollarSign, CheckCircle2, Clock,
  XCircle, RefreshCw, ChevronLeft, ChevronRight, Wallet, RotateCcw
} from 'lucide-react';
import API from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';

const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/payments', {
        params: { search, status: statusFilter, method: methodFilter, page, limit: 12 }
      });
      const data = res.data.data;
      setPayments(data.payments || []);
      setSummary(data.summary || {});
      setTotalPages(data.pagination?.pages || 1);
    } catch (err) {
      toast.error('Failed to load payment transactions');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, methodFilter, page]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'settled_to_provider':
        return {
          label: 'Settled to Provider',
          bg: '#eef2ff',
          color: '#4f46e5',
          border: '#c7d2fe'
        };
      case 'success':
        return {
          label: 'Captured / Paid',
          bg: '#ecfdf5',
          color: '#059669',
          border: '#a7f3d0'
        };
      case 'refunded':
        return {
          label: 'Refunded',
          bg: '#fff7ed',
          color: '#c2410c',
          border: '#fed7aa'
        };
      case 'pending':
        return {
          label: 'Pending',
          bg: '#fefce8',
          color: '#a16207',
          border: '#fef08a'
        };
      case 'failed':
      default:
        return {
          label: status || 'Failed',
          bg: '#fef2f2',
          color: '#b91c1c',
          border: '#fecaca'
        };
    }
  };

  const getSettlementBadge = (settlementStatus) => {
    if (settlementStatus === 'PROVIDER_EARNED') {
      return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#15803d' }}>PROVIDER EARNED</span>;
    }
    if (settlementStatus === 'REFUNDED') {
      return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#ffedd5', color: '#c2410c' }}>REFUNDED</span>;
    }
    if (settlementStatus === 'REFUND_PENDING') {
      return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#b91c1c' }}>REFUND PENDING</span>;
    }
    return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#64748b' }}>PENDING</span>;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '4px', letterSpacing: '-0.3px' }}>
            Payments & Transactions
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Real-time ledger of site visit fees, online customer payments, settlements, and refunds
          </p>
        </div>
        <button
          onClick={fetchPayments}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 16px', borderRadius: '8px', border: '1px solid #cbd5e1',
            background: 'white', color: '#334155', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <RefreshCw size={14} /> Refresh Ledger
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Total Captured Revenue</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '10px' }}>
            ₹{(summary.totalRevenue || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {summary.capturedCount || summary.successfulCount || 0} successful customer transactions
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Settled to Providers</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginTop: '10px' }}>
            ₹{(summary.settledToProviderAmount || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {summary.settledToProviderCount || 0} completed site visit payouts
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Refunded to Customers</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RotateCcw size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ea580c', marginTop: '10px' }}>
            ₹{(summary.refundedAmount || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {summary.refundedCount || 0} cancellations refunded
          </div>
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Pending / Failed</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#334155', marginTop: '10px' }}>
            {(summary.pendingCount || 0) + (summary.failedCount || 0)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            {summary.pendingCount || 0} pending · {summary.failedCount || 0} failed
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px 20px', marginBottom: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{
              padding: '9px 14px', borderRadius: '8px', border: '1px solid #cbd5e1',
              fontSize: '13px', fontWeight: 600, color: '#334155', background: 'white', outline: 'none'
            }}
          >
            <option value="all">All Statuses</option>
            <option value="captured">Captured (All Paid)</option>
            <option value="success">Success / Paid</option>
            <option value="settled_to_provider">Settled to Provider</option>
            <option value="refunded">Refunded</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => { setMethodFilter(e.target.value); setPage(1); }}
            style={{
              padding: '9px 14px', borderRadius: '8px', border: '1px solid #cbd5e1',
              fontSize: '13px', fontWeight: 600, color: '#334155', background: 'white', outline: 'none'
            }}
          >
            <option value="all">All Methods</option>
            <option value="razorpay">Razorpay Online</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
          </select>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by customer name/email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{
              width: '100%', padding: '9px 14px 9px 36px',
              borderRadius: '8px', border: '1px solid #cbd5e1',
              fontSize: '13px', outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}><PageSpinner /></div>
        ) : payments.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <CreditCard size={40} style={{ margin: '0 auto 12px', color: '#cbd5e1' }} />
            <div style={{ fontWeight: 600, fontSize: '15px', color: '#1e293b' }}>No payment records found</div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Try adjusting your filters or search term</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '14px 20px' }}>Transaction ID</th>
                  <th style={{ padding: '14px 20px' }}>Customer</th>
                  <th style={{ padding: '14px 20px' }}>Provider</th>
                  <th style={{ padding: '14px 20px' }}>Amount</th>
                  <th style={{ padding: '14px 20px' }}>Payment Status</th>
                  <th style={{ padding: '14px 20px' }}>Settlement Status</th>
                  <th style={{ padding: '14px 20px' }}>Method</th>
                  <th style={{ padding: '14px 20px' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const badge = getStatusBadge(p.status);
                  const feeSnapshot = p.bookingId?.siteVisitFee || p.bookingId?.consultationFee || p.amount;
                  return (
                    <tr key={p._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 20px', fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
                        {p.transactionId || p.razorpayPaymentId || p._id.slice(-8).toUpperCase()}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.customerId?.name || 'Customer'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{p.customerId?.email}</div>
                      </td>
                      <td style={{ padding: '14px 20px', color: '#334155' }}>
                        {p.providerId?.userId?.name || 'Assigned Provider'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                          ₹{(p.amount || 0).toLocaleString('en-IN')}
                        </div>
                        {feeSnapshot && feeSnapshot !== p.amount && (
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>Fee: ₹{feeSnapshot}</div>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          border: `1px solid ${badge.border}`,
                          background: badge.bg,
                          color: badge.color,
                          whiteSpace: 'nowrap'
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        {getSettlementBadge(p.bookingId?.settlementStatus)}
                      </td>
                      <td style={{ padding: '14px 20px', textTransform: 'uppercase', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                        {p.method || 'RAZORPAY'}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Page {page} of {totalPages}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                  background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                  background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminPayments;

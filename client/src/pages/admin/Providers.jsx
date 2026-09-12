import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Search, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight, Star, Briefcase } from 'lucide-react';
import API from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';

const Providers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'all';

  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = '/admin/providers';
      if (statusFilter === 'pending') {
        url = '/admin/providers/pending'; // Instruction says to fetch from this specifically for pending
      }
      
      const res = await API.get(url, {
        params: {
          search,
          status: statusFilter === 'all' || statusFilter === 'pending' ? undefined : statusFilter,
          page,
          limit: 10
        }
      });
      
      // Some endpoints return data.data.providers, some might return data.data directly
      const list = res.data.data?.providers || res.data.data || [];
      setProviders(Array.isArray(list) ? list : []);
      setTotalPages(res.data.data?.totalPages || 1);
    } catch (err) {
      setError('Failed to load providers');
      toast.error('Failed to fetch providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProviders();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search, statusFilter, page]);

  // Sync state to URL when changed
  useEffect(() => {
    if (statusFilter !== 'all') {
      setSearchParams({ filter: statusFilter });
    } else {
      setSearchParams({});
    }
  }, [statusFilter, setSearchParams]);

  const handleVerify = async (id, newStatus) => {
    try {
      await API.patch(`/admin/providers/${id}/verify`, { status: newStatus });
      toast.success(`Provider ${newStatus}`);
      fetchProviders();
    } catch (err) {
      toast.error(`Failed to ${newStatus} provider`);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Provider Management</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Review, verify, and manage service providers</p>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        {/* Filters & Search */}
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {['all', 'pending', 'verified', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => { setStatusFilter(status); setPage(1); }}
                style={{
                  padding: '8px 16px', fontSize: '13px', fontWeight: 600, borderRadius: '6px',
                  background: statusFilter === status ? '#3b82f6' : '#f8fafc',
                  color: statusFilter === status ? 'white' : '#64748b',
                  border: '1px solid', borderColor: statusFilter === status ? '#3b82f6' : '#e2e8f0',
                  cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s', whiteSpace: 'nowrap'
                }}
              >
                {status}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by name or category..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: '100%', padding: '10px 12px 10px 36px', borderRadius: '6px', border: '1px solid #e2e8f0',
                fontSize: '14px', outline: 'none', transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', minHeight: '400px' }}>
          {loading && providers.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}><PageSpinner /></div>
          ) : error ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#ef4444' }}>
              <AlertCircle size={40} style={{ margin: '0 auto 16px' }} />
              <div>{error}</div>
            </div>
          ) : providers.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
              <Briefcase size={40} style={{ margin: '0 auto 16px', color: '#cbd5e1' }} />
              <div style={{ fontSize: '16px', fontWeight: 600 }}>No providers found</div>
              <div style={{ fontSize: '14px', marginTop: '4px' }}>Try adjusting your filters or search query.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {providers.map((p) => {
                const name = p.userId?.name || p.name || 'Unknown';
                const avatar = p.userId?.avatar?.url || null;
                const effectiveStatus = (p.verification?.overallStatus === 'rejected' || p.verificationStatus === 'rejected' || p.status === 'rejected')
                  ? 'rejected'
                  : (p.verification?.overallStatus === 'verified' && p.verificationStatus === 'verified' && p.status === 'approved')
                  ? 'verified'
                  : 'pending';
                return (
                  <motion.div
                    key={p._id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    style={{
                      border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', background: 'white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                      {avatar ? (
                        <img src={avatar} alt={name} style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: '#e0e7ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, flexShrink: 0 }}>
                          {name[0]}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {name}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px', textTransform: 'capitalize' }}>
                          {p.category || p.primaryCategory || 'General Service'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize',
                            background: effectiveStatus === 'verified' ? '#dcfce7' : effectiveStatus === 'rejected' ? '#fee2e2' : '#fef3c7',
                            color: effectiveStatus === 'verified' ? '#15803d' : effectiveStatus === 'rejected' ? '#991b1b' : '#92400e'
                          }}>
                            {effectiveStatus}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#eab308' }}>
                            <Star size={12} fill="currentColor" /> {p.rating?.average || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Experience</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{p.experience ? `${p.experience} years` : 'N/A'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Jobs Done</div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{p.completedJobs || 0}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      {effectiveStatus !== 'verified' && (
                        <button
                          onClick={() => handleVerify(p._id, 'verified')}
                          style={{
                            flex: 1, padding: '8px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                            background: '#22c55e', color: 'white', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                          }}
                        >
                          <CheckCircle size={16} /> Approve
                        </button>
                      )}
                      {effectiveStatus !== 'rejected' ? (
                        <button
                          onClick={() => handleVerify(p._id, 'rejected')}
                          style={{
                            flex: 1, padding: '8px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                            background: 'white', color: '#ef4444', border: '1px solid #ef4444', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                          }}
                        >
                          <XCircle size={16} /> {effectiveStatus === 'verified' ? 'Suspend' : 'Reject'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleVerify(p._id, 'verified')}
                          style={{
                            flex: 1, padding: '8px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                            background: '#22c55e', color: 'white', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                          }}
                        >
                          <CheckCircle size={16} /> Re-approve
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Showing page {page} of {totalPages}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b',
                  cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Providers;

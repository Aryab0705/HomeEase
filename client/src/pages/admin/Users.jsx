import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Search, Shield, ShieldOff, MoreVertical, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import API from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { PageSpinner } from '../../components/common/Spinner';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await API.get('/admin/users', {
        params: {
          search,
          role: roleFilter === 'all' ? undefined : roleFilter,
          page,
          limit: 10
        }
      });
      setUsers(res.data.data?.users || []);
      setTotalPages(res.data.data?.totalPages || 1);
    } catch (err) {
      setError('Failed to load users');
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [search, roleFilter, page]);

  const handleBlockUnblock = async (userId, currentStatus) => {
    try {
      // Typically the backend flips the status or takes an action. 
      // Assuming PUT /api/admin/users/:id/block toggles the block status.
      await API.put(`/admin/users/${userId}/block`);
      toast.success(currentStatus === 'active' ? 'User blocked' : 'User unblocked');
      fetchUsers();
    } catch (err) {
      toast.error('Action failed');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>User Management</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Manage customers and providers on the platform</p>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        {/* Filters & Search */}
        <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['all', 'customer', 'provider'].map((role) => (
              <button
                key={role}
                onClick={() => { setRoleFilter(role); setPage(1); }}
                style={{
                  padding: '8px 16px', fontSize: '13px', fontWeight: 600, borderRadius: '6px',
                  background: roleFilter === role ? '#3b82f6' : '#f8fafc',
                  color: roleFilter === role ? 'white' : '#64748b',
                  border: '1px solid', borderColor: roleFilter === role ? '#3b82f6' : '#e2e8f0',
                  cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s'
                }}
              >
                {role === 'all' ? 'All Users' : role + 's'}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by name or email..."
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

        {/* Table */}
        <div style={{ overflowX: 'auto', minHeight: '400px' }}>
          {loading && users.length === 0 ? (
            <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><PageSpinner /></div>
          ) : error ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#ef4444' }}>
              <AlertCircle size={40} style={{ margin: '0 auto 16px' }} />
              <div>{error}</div>
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
              <Users size={40} style={{ margin: '0 auto 16px', color: '#cbd5e1' }} />
              <div style={{ fontSize: '16px', fontWeight: 600 }}>No users found</div>
              <div style={{ fontSize: '14px', marginTop: '4px' }}>Try adjusting your filters or search query.</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>User</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Role</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Joined Date</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e0e7ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                          {u.name?.[0] || 'U'}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{u.name}</div>
                          <div style={{ fontSize: '13px', color: '#64748b' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize',
                        background: u.role === 'provider' ? '#f3e8ff' : '#eff6ff',
                        color: u.role === 'provider' ? '#8b5cf6' : '#3b82f6'
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, textTransform: 'capitalize',
                        background: u.status === 'active' ? '#dcfce7' : '#fee2e2',
                        color: u.status === 'active' ? '#22c55e' : '#ef4444'
                      }}>
                        {u.status || 'active'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px', color: '#64748b' }}>
                      {formatDate(u.createdAt)}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleBlockUnblock(u._id, u.status || 'active')}
                        style={{
                          padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer',
                          background: 'transparent',
                          border: `1px solid ${u.status === 'active' ? '#ef4444' : '#22c55e'}`,
                          color: u.status === 'active' ? '#ef4444' : '#22c55e',
                          display: 'inline-flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        {u.status === 'active' ? <ShieldOff size={14} /> : <Shield size={14} />}
                        {u.status === 'active' ? 'Block' : 'Unblock'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

export default Users;

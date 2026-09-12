import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Shield, UserPlus, Power, AlertCircle, CheckCircle } from 'lucide-react';
import API from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';

const AdminManagement = () => {
  const { user } = useSelector(state => state.auth);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'admin'
  });

  const isSuperAdmin = user?.role === 'super_admin';

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await API.get('/admin/admins');
      setAdmins(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load admin users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchAdmins();
    }
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <Shield size={48} style={{ margin: '0 auto 16px', color: '#ef4444' }} />
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>Super Admin Access Required</h2>
        <p style={{ color: '#64748b', marginTop: '8px' }}>Only existing Super Admins can manage or provision additional Admin accounts.</p>
      </div>
    );
  }

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    try {
      await API.post('/admin/admins', form);
      toast.success('Admin account created successfully!');
      setShowModal(false);
      setForm({ name: '', email: '', password: '', phone: '', role: 'admin' });
      fetchAdmins();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create admin');
    }
  };

  const handleToggleBlock = async (id) => {
    try {
      await API.put(`/admin/admins/${id}/block`);
      toast.success('Admin status updated');
      fetchAdmins();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update admin status');
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Admin Management</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Provision new Admin accounts and manage administrative access (Super Admin only)</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserPlus size={18} /> Add New Admin
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}><PageSpinner /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Name</th>
                <th style={{ padding: '12px 16px' }}>Email</th>
                <th style={{ padding: '12px 16px' }}>Role</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#1e293b' }}>{a.name}</td>
                  <td style={{ padding: '14px 16px', color: '#64748b' }}>{a.email}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                      background: a.role === 'super_admin' ? '#f3e8ff' : '#eff6ff',
                      color: a.role === 'super_admin' ? '#6b21a8' : '#1d4ed8'
                    }}>
                      {a.role?.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                      background: a.isBlocked ? '#fee2e2' : '#dcfce7',
                      color: a.isBlocked ? '#991b1b' : '#15803d'
                    }}>
                      {a.isBlocked ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {a._id !== user?._id && (
                      <button
                        onClick={() => handleToggleBlock(a._id)}
                        className="btn btn-outline btn-sm"
                        style={{ borderColor: a.isBlocked ? '#22c55e' : '#ef4444', color: a.isBlocked ? '#22c55e' : '#ef4444' }}
                      >
                        <Power size={14} /> {a.isBlocked ? 'Activate' : 'Suspend'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '450px', width: '100%' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Provision New Admin Account</h3>
            <form onSubmit={handleCreateAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Full Name</label>
                <input required className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email Address</label>
                <input required type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Password (min 8 chars)</label>
                <input required type="password" minLength={8} className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Admin Role</label>
                <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="admin">Standard Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default AdminManagement;

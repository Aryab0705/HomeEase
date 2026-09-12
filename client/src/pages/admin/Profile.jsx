import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { User, Lock, Mail, Phone, Shield } from 'lucide-react';
import API from '../../services/api';
import { updateUser } from '../../redux/authSlice';

const AdminProfile = () => {
  const dispatch = useDispatch();
  const { user } = useSelector(state => state.auth);

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const res = await API.put('/users/profile', { name, phone });
      dispatch(updateUser(res.data.data));
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    try {
      setSavingPassword(true);
      await API.put('/users/change-password', { currentPassword, newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Admin Profile & Security</h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Manage your personal details and change account credentials</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Personal Details */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} color="#3b82f6" /> Personal Information
          </h3>
          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Email Address (Read only)</label>
              <input className="input" value={user?.email || ''} disabled style={{ background: '#f8fafc' }} />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input className="input" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="label">Role</label>
              <input className="input" value={user?.role?.replace('_', ' ').toUpperCase()} disabled style={{ background: '#f8fafc', fontWeight: 700 }} />
            </div>
            <button type="submit" disabled={savingProfile} className="btn btn-primary" style={{ marginTop: '8px' }}>
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} color="#3b82f6" /> Change Password
          </h3>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="label">Current Password</label>
              <input required type="password" className="input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            </div>
            <div>
              <label className="label">New Password (min 8 chars)</label>
              <input required type="password" minLength={8} className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <button type="submit" disabled={savingPassword} className="btn btn-primary" style={{ marginTop: '8px' }}>
              {savingPassword ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminProfile;

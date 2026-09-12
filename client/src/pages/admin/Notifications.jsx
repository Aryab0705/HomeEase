import React, { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Bell, Send, Users, ShieldAlert } from 'lucide-react';
import API from '../../services/api';

const AdminNotifications = () => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState('all');
  const [loading, setLoading] = useState(false);

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      return toast.error('Please enter both title and message');
    }

    try {
      setLoading(true);
      const res = await API.post('/admin/notifications/broadcast', {
        title: title.trim(),
        message: message.trim(),
        targetRole
      });
      toast.success(res.data?.message || 'Platform announcement sent!');
      setTitle('');
      setMessage('');
    } catch (err) {
      toast.error('Failed to send announcement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Platform Broadcast Notifications</h1>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Send announcements or important platform notifications to users and providers</p>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <form onSubmit={handleBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label className="label">Target Audience</label>
            <select value={targetRole} onChange={e => setTargetRole(e.target.value)} className="input">
              <option value="all">All Users (Customers & Providers)</option>
              <option value="customer">Customers Only</option>
              <option value="provider">Providers Only</option>
            </select>
          </div>

          <div>
            <label className="label">Announcement Title</label>
            <input
              required
              className="input"
              placeholder="e.g. Scheduled System Maintenance / New Feature Release"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Message Content</label>
            <textarea
              required
              className="input"
              style={{ height: '120px', resize: 'vertical' }}
              placeholder="Write detailed notification message here..."
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
          >
            <Send size={16} /> {loading ? 'Sending...' : 'Send Broadcast Announcement'}
          </button>
        </form>
      </div>
    </motion.div>
  );
};

export default AdminNotifications;

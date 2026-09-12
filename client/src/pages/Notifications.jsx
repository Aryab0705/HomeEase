import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import AppLayout from '../components/layout/AppLayout';
import { PageSpinner } from '../components/common/Spinner';
import { setNotifications, markOneRead, markAllRead, setUnreadCount } from '../redux/notificationSlice';
import API from '../services/api';
import { timeAgo } from '../utils/helpers';
import toast from 'react-hot-toast';

const TYPE_ICONS = {
  booking_confirmed:  '✅',
  booking_cancelled:  '❌',
  booking_accepted:   '🤝',
  booking_completed:  '🎉',
  new_message:        '💬',
  review_received:    '⭐',
  quote_received:     '📋',
  provider_verified:  '🛡️',
  dispute_resolved:   '⚖️',
  payment_received:   '💰',
};

const Notifications = () => {
  const dispatch = useDispatch();
  const { notifications, unreadCount } = useSelector(s => s.notification);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get('/notifications?limit=30');
        dispatch(setNotifications(res.data.data.notifications));
        dispatch(setUnreadCount(res.data.data.unreadCount));
      } catch { toast.error('Failed to load notifications'); }
      finally  { setLoading(false); }
    };
    load();
  }, [dispatch]);

  const handleMarkRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      dispatch(markOneRead(id));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await API.patch('/notifications/read-all');
      dispatch(markAllRead());
      toast.success('All notifications marked as read');
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await API.delete(`/notifications/${id}`);
      dispatch(setNotifications(notifications.filter(n => n._id !== id)));
      toast.success('Notification deleted');
    } catch {}
  };

  return (
    <AppLayout>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 26, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                Notifications
                {unreadCount > 0 && <span className="badge badge-error">{unreadCount} unread</span>}
              </h1>
              <p style={{ color: 'var(--text-light)' }}>Stay updated with your bookings and messages</p>
            </div>
            {unreadCount > 0 && (
              <button className="btn btn-outline btn-sm" onClick={handleMarkAllRead} style={{ gap: 6 }}>
                <CheckCheck size={15} /> Mark All Read
              </button>
            )}
          </div>

          {loading ? <PageSpinner /> : notifications.length === 0 ? (
            <div className="card" style={{ padding: 64, textAlign: 'center' }}>
              <Bell size={48} color="var(--border)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: 18, marginBottom: 6 }}>All caught up!</h3>
              <p style={{ color: 'var(--text-light)', fontSize: 14 }}>No notifications yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifications.map((n, i) => (
                <motion.div key={n._id}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  onClick={() => !n.isRead && handleMarkRead(n._id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px',
                    background: n.isRead ? 'white' : 'var(--primary)',
                    border: `1px solid ${n.isRead ? 'var(--border)' : 'var(--accent)'}`,
                    borderRadius: 12, cursor: n.isRead ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                  }}>
                  {/* Icon */}
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: n.isRead ? 'var(--bg)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {TYPE_ICONS[n.type] || '🔔'}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: n.isRead ? 500 : 700, fontSize: 14, marginBottom: 3 }}>{n.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 4 }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{timeAgo(n.createdAt)}</div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {!n.isRead && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--dark-accent)' }} />}
                    <button onClick={(e) => handleDelete(n._id, e)} className="btn btn-icon" style={{ background: 'transparent', color: 'var(--text-light)', padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AppLayout>
  );
};

export default Notifications;

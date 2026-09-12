import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Briefcase, BookOpen, DollarSign, Star,
  MessageSquare, FileText, Settings, Shield, Bell,
  LogOut, Menu, X, ChevronRight, Home, CreditCard, BarChart3,
  AlertTriangle, FileCheck, Megaphone, Database, Lock, User,
  Building2, Calendar, TrendingUp, Layers, Globe, ClipboardList,
  ShieldCheck, ShieldX, CheckCircle, XCircle, CheckCheck
} from 'lucide-react';
import API from '../../services/api';
import toast from 'react-hot-toast';
import { timeAgo } from '../../utils/helpers';
import { setNotifications, markOneRead, markAllRead, setUnreadCount } from '../../redux/notificationSlice';

const adminGroups = [
  {
    label: 'Overview',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ]
  },
  {
    label: 'User Management',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/providers', label: 'Providers', icon: Briefcase },
    ]
  },
  {
    label: 'Verification',
    items: [
      { to: '/admin/verification', label: 'Provider Verification', icon: ShieldCheck },
    ]
  },
  {
    label: 'Operations',
    items: [
      { to: '/admin/bookings', label: 'Bookings', icon: BookOpen },
      { to: '/admin/services', label: 'Services & Categories', icon: Layers },
      { to: '/admin/reviews', label: 'Reviews & Complaints', icon: Star },
    ]
  },
  {
    label: 'Finance & Analytics',
    items: [
      { to: '/admin/payments', label: 'Payments', icon: CreditCard },
      { to: '/admin/revenue', label: 'Reports / Analytics', icon: BarChart3 },
    ]
  },
  {
    label: 'Communication & System',
    items: [
      { to: '/admin/notifications', label: 'Notifications', icon: Bell },
      { to: '/admin/admins', label: 'Admin Management', icon: Shield, superAdminOnly: true },
      { to: '/admin/profile', label: 'Profile', icon: User },
    ]
  }
];

const PAGE_TITLE_MAP = {
  '/admin/dashboard': 'Dashboard',
  '/admin/users': 'User Management',
  '/admin/providers': 'Service Providers',
  '/admin/verification': 'Provider Verification',
  '/admin/bookings': 'Bookings & Site Visits',
  '/admin/services': 'Services & Categories',
  '/admin/reviews': 'Customer Reviews & Complaints',
  '/admin/payments': 'Payments & Transactions',
  '/admin/revenue': 'Reports & Analytics',
  '/admin/notifications': 'Platform Notifications',
  '/admin/admins': 'Admin Management',
  '/admin/profile': 'Admin Profile',
  '/admin/settings': 'System Settings',
};

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [overviewAlerts, setOverviewAlerts] = useState({ pendingVerifications: 0, openComplaints: 0 });
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector(state => state.auth);
  const { notifications = [], unreadCount = 0 } = useSelector(state => state.notification || {});

  const currentPageLabel = PAGE_TITLE_MAP[location.pathname] || 'Admin Console';

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        setSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Dismiss dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAlertsAndNotifications = async () => {
    try {
      const res = await API.get('/admin/dashboard');
      const { overview } = res.data.data || {};
      setOverviewAlerts({
        pendingVerifications: overview?.pendingVerifications || 0,
        openComplaints: overview?.openComplaints || 0,
      });
    } catch {}

    try {
      setLoadingNotifs(true);
      const res = await API.get('/notifications?limit=20');
      const list = res.data.data?.notifications || res.data.data || [];
      const count = res.data.data?.unreadCount || 0;
      dispatch(setNotifications(list));
      dispatch(setUnreadCount(count));
    } catch {} finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    fetchAlertsAndNotifications();
  }, [dispatch]);

  const totalBadgeCount = (overviewAlerts.pendingVerifications || 0) + (overviewAlerts.openComplaints || 0) + (unreadCount || 0);

  const handleMarkAllAsRead = async () => {
    try {
      await API.patch('/notifications/read-all');
      dispatch(markAllRead());
      toast.success('Marked all notifications as read');
    } catch {
      toast.error('Failed to mark notifications as read');
    }
  };

  const handleNotificationClick = async (item) => {
    if (!item.isRead) {
      try {
        await API.patch(`/notifications/${item._id}/read`);
        dispatch(markOneRead(item._id));
      } catch {}
    }
    setShowNotifications(false);
    if (item.type === 'account_verified' || item.title?.toLowerCase().includes('verification')) {
      navigate('/admin/verification');
    } else if (item.type === 'dispute_update' || item.title?.toLowerCase().includes('complaint')) {
      navigate('/admin/reviews');
    } else if (item.type?.startsWith('booking')) {
      navigate('/admin/bookings');
    } else if (item.type === 'payment_received') {
      navigate('/admin/payments');
    } else {
      navigate('/admin/notifications');
    }
  };

  const handleLogout = async () => {
    try {
      await API.post('/auth/logout');
      navigate('/login');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const sidebarWidth = sidebarOpen ? 280 : 64;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{
          background: 'white',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
          overflow: 'hidden',
          whiteSpace: 'nowrap'
        }}
      >
        {/* Sidebar Header with Menu button to LEFT of Logo */}
        <div style={{
          padding: sidebarOpen ? '18px 16px' : '18px 14px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          gap: 12,
          minHeight: 73,
          boxSizing: 'border-box'
        }}>
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            title={sidebarOpen ? 'Collapse sidebar (Ctrl+B)' : 'Expand sidebar (Ctrl+B)'}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#475569',
              flexShrink: 0,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e2eafc';
              e.currentTarget.style.color = '#3b82f6';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.color = '#475569';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <Menu size={18} />
          </button>

          {sidebarOpen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, overflow: 'hidden' }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: 'linear-gradient(135deg, #5a85ff, #7fa8ff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(90, 133, 255, 0.25)'
              }}>
                🏠
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>HomeEase</div>
                <div style={{ fontSize: 11, color: '#5a85ff', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Admin Panel</div>
              </motion.div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: sidebarOpen ? '16px 12px' : '16px 8px' }}>
          {adminGroups.map((group, groupIdx) => (
            <div key={groupIdx} style={{ marginBottom: 20 }}>
              {sidebarOpen && (
                <div style={{
                  fontSize: 11, fontWeight: 700, color: '#94a3b8',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  marginBottom: 8, paddingLeft: 12,
                }}>
                  {group.label}
                </div>
              )}
              {group.items.filter(item => !item.superAdminOnly || isSuperAdmin).map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.to;
                return (
                  <button
                    key={item.to}
                    onClick={() => navigate(item.to)}
                    title={!sidebarOpen ? item.label : ''}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: sidebarOpen ? 'flex-start' : 'center',
                      gap: 12,
                      padding: sidebarOpen ? '10px 12px' : '10px 0',
                      borderRadius: 8,
                      border: 'none',
                      background: isActive ? '#eff6ff' : 'transparent',
                      color: isActive ? '#5a85ff' : '#64748b',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      marginBottom: 2,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Icon size={18} style={{ flexShrink: 0 }} />
                    {sidebarOpen && (
                      <>
                        <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                        {isActive && <ChevronRight size={16} />}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Info */}
        <div style={{ padding: sidebarOpen ? '16px' : '16px 12px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: '#e0e7ff', color: '#5a85ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, flexShrink: 0
            }}>
              {user?.name?.[0] || 'A'}
            </div>
            {sidebarOpen && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.name || 'Admin User'}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>
                  {user?.role?.replace('_', ' ') || 'Admin'}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div style={{ flex: 1, marginLeft: sidebarWidth, transition: 'margin-left 0.3s' }}>
        {/* Top Navbar */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: 'white', borderBottom: '1px solid #e2e8f0',
          padding: '16px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Breadcrumb / Section Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0, letterSpacing: '-0.2px' }}>
              {currentPageLabel}
            </h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              borderRadius: 16,
              background: '#eef2ff',
              color: '#4f46e5',
              fontSize: 11,
              fontWeight: 600,
              border: '1px solid #e0e7ff'
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              Live System
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Notifications */}
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button
                onClick={() => {
                  setShowNotifications(prev => !prev);
                  setShowProfile(false);
                }}
                aria-label="View notifications"
                title="Notifications"
                style={{
                  width: 40, height: 40, borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  background: showNotifications ? '#eff6ff' : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  color: showNotifications ? '#2563eb' : '#64748b',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                  boxShadow: showNotifications ? '0 0 0 2px rgba(37,99,235,0.15)' : 'none'
                }}
              >
                <Bell size={20} />
                {totalBadgeCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9,
                    background: '#ef4444', border: '2px solid white',
                    color: 'white', fontSize: 10, fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }}>
                    {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: 380,
                      maxWidth: 'calc(100vw - 32px)',
                      background: 'white',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.15), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
                      zIndex: 120,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      maxHeight: 520,
                    }}
                  >
                    {/* Header */}
                    <div style={{
                      padding: '12px 16px',
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Notifications</span>
                        {totalBadgeCount > 0 && (
                          <span style={{
                            background: '#fee2e2',
                            color: '#b91c1c',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 10
                          }}>
                            {totalBadgeCount} New
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#2563eb',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 6px',
                            borderRadius: 4
                          }}
                        >
                          <CheckCheck size={14} />
                          Mark all read
                        </button>
                      )}
                    </div>

                    {/* Scrollable list */}
                    <div style={{ overflowY: 'auto', flex: 1, maxHeight: 380 }}>
                      {/* Actionable Alerts (Pending Verifications / Complaints) */}
                      {(overviewAlerts.pendingVerifications > 0 || overviewAlerts.openComplaints > 0) && (
                        <div style={{ padding: '8px 12px 4px', borderBottom: '1px solid #f1f5f9' }}>
                          <div style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#64748b',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            marginBottom: 6,
                            paddingLeft: 4
                          }}>
                            Action Required
                          </div>

                          {overviewAlerts.pendingVerifications > 0 && (
                            <div
                              onClick={() => {
                                navigate('/admin/verification');
                                setShowNotifications(false);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '9px 12px',
                                borderRadius: 8,
                                background: '#fefce8',
                                border: '1px solid #fef08a',
                                cursor: 'pointer',
                                marginBottom: 6,
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#fef9c3'}
                              onMouseLeave={e => e.currentTarget.style.background = '#fefce8'}
                            >
                              <div style={{
                                width: 30, height: 30, borderRadius: 6,
                                background: '#fef08a', color: '#854d0e',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <ShieldCheck size={16} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#854d0e', lineHeight: 1.2 }}>
                                  Provider Verifications
                                </div>
                                <div style={{ fontSize: 11, color: '#a16207', marginTop: 2 }}>
                                  {overviewAlerts.pendingVerifications} provider{overviewAlerts.pendingVerifications > 1 ? 's' : ''} awaiting review
                                </div>
                              </div>
                              <ChevronRight size={16} color="#854d0e" />
                            </div>
                          )}

                          {overviewAlerts.openComplaints > 0 && (
                            <div
                              onClick={() => {
                                navigate('/admin/reviews');
                                setShowNotifications(false);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '9px 12px',
                                borderRadius: 8,
                                background: '#fff1f2',
                                border: '1px solid #fecdd3',
                                cursor: 'pointer',
                                marginBottom: 4,
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#ffe4e6'}
                              onMouseLeave={e => e.currentTarget.style.background = '#fff1f2'}
                            >
                              <div style={{
                                width: 30, height: 30, borderRadius: 6,
                                background: '#fee2e2', color: '#9f1239',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <AlertTriangle size={16} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#9f1239', lineHeight: 1.2 }}>
                                  Customer Complaints
                                </div>
                                <div style={{ fontSize: 11, color: '#be123c', marginTop: 2 }}>
                                  {overviewAlerts.openComplaints} unresolved dispute{overviewAlerts.openComplaints > 1 ? 's' : ''}
                                </div>
                              </div>
                              <ChevronRight size={16} color="#9f1239" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notification List */}
                      {loadingNotifs ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                          Loading notifications...
                        </div>
                      ) : notifications.length === 0 && overviewAlerts.pendingVerifications === 0 && overviewAlerts.openComplaints === 0 ? (
                        <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: '#f1f5f9', color: '#94a3b8',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 10px'
                          }}>
                            <Bell size={22} />
                          </div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#334155' }}>
                            All caught up!
                          </p>
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                            No new notifications or alerts at this time.
                          </p>
                        </div>
                      ) : (
                        notifications.map((item) => (
                          <div
                            key={item._id}
                            onClick={() => handleNotificationClick(item)}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 12,
                              padding: '12px 16px',
                              background: item.isRead ? 'white' : '#f8fafc',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                              position: 'relative'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.background = item.isRead ? 'white' : '#f8fafc'}
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: 8,
                              background: item.type === 'system' ? '#eff6ff' : '#f1f5f9',
                              color: item.type === 'system' ? '#2563eb' : '#64748b',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 14, flexShrink: 0, marginTop: 2
                            }}>
                              {item.type === 'system' ? <Megaphone size={16} /> :
                               item.type === 'account_verified' ? <ShieldCheck size={16} /> :
                               item.type === 'dispute_update' ? <AlertTriangle size={16} /> :
                               item.type === 'payment_received' ? <DollarSign size={16} /> :
                               <Bell size={16} />}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <div style={{
                                  fontSize: 13,
                                  fontWeight: item.isRead ? 600 : 700,
                                  color: '#0f172a',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {item.title}
                                </div>
                                <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>
                                  {timeAgo(item.createdAt)}
                                </span>
                              </div>
                              <p style={{
                                margin: '3px 0 0',
                                fontSize: 12,
                                color: '#64748b',
                                lineHeight: 1.4,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}>
                                {item.message}
                              </p>
                            </div>

                            {!item.isRead && (
                              <div style={{
                                width: 7, height: 7, borderRadius: '50%',
                                background: '#2563eb', flexShrink: 0, marginTop: 6
                              }} />
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Footer */}
                    <div style={{
                      padding: '10px 16px',
                      background: '#f8fafc',
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <button
                        onClick={() => {
                          navigate('/admin/notifications');
                          setShowNotifications(false);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#475569',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: 0
                        }}
                      >
                        <Megaphone size={14} color="#2563eb" />
                        Broadcast Announcements
                      </button>

                      <button
                        onClick={() => setShowNotifications(false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          fontSize: 12,
                          cursor: 'pointer',
                          padding: '2px 6px'
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Dropdown */}
            <div style={{ position: 'relative' }} ref={profileRef}>
              <button
                onClick={() => {
                  setShowProfile(!showProfile);
                  setShowNotifications(false);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 8,
                  border: '1px solid #e2e8f0', background: 'white',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 6,
                  background: '#e0e7ff', color: '#5a85ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                }}>
                  {user?.name?.[0] || 'A'}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                  {user?.name?.split(' ')[0] || 'Admin'}
                </span>
              </button>

              {showProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    position: 'absolute', top: '100%', right: 0,
                    marginTop: 8, width: 200,
                    background: 'white', borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 100,
                  }}
                >
                  <button
                    onClick={() => { navigate('/admin/profile'); setShowProfile(false); }}
                    style={{
                      width: '100%', padding: '12px 16px',
                      border: 'none', background: 'none',
                      textAlign: 'left', fontSize: 14,
                      color: '#1e293b', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <User size={16} />
                    Profile
                  </button>
                  <button
                    onClick={() => { navigate('/admin/settings'); setShowProfile(false); }}
                    style={{
                      width: '100%', padding: '12px 16px',
                      border: 'none', background: 'none',
                      textAlign: 'left', fontSize: 14,
                      color: '#1e293b', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <Settings size={16} />
                    Settings
                  </button>
                  <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%', padding: '12px 16px',
                      border: 'none', background: 'none',
                      textAlign: 'left', fontSize: 14,
                      color: '#ef4444', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ padding: '24px' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;

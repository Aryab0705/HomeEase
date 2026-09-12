import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, Search, BookOpen, MessageSquare, Bell, User,
  LogOut, Menu, X, Settings, BarChart2, Users, Shield,
  AlertCircle, ChevronDown, HelpCircle,
} from 'lucide-react';
import { clearCredentials } from '../../redux/authSlice';
import { disconnectSocket } from '../../services/socket';
import Avatar from '../common/Avatar';
import API from '../../services/api';
import toast from 'react-hot-toast';
import { useSidebar } from '../../context/useSidebar';

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, isAuthenticated } = useSelector(s => s.auth);
  const { unreadCount } = useSelector(s => s.notification);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { open: sidebarOpen, toggle: toggleSidebar } = useSidebar();

  const handleLogout = async () => {
    try { await API.post('/auth/logout'); } catch {}
    disconnectSocket();
    dispatch(clearCredentials());
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const navLinks = isAuthenticated ? (
    user?.role === 'admin' ? [
      { to: '/admin/dashboard', label: 'Dashboard', icon: <BarChart2 size={17} /> },
      { to: '/admin/users',     label: 'Users',     icon: <Users size={17} /> },
      { to: '/admin/providers', label: 'Providers',  icon: <Shield size={17} /> },
      { to: '/admin/bookings',  label: 'Bookings',   icon: <BookOpen size={17} /> },
      { to: '/admin/disputes',  label: 'Disputes',   icon: <AlertCircle size={17} /> },
    ] : user?.role === 'provider' ? [
      { to: '/provider/dashboard', label: 'Dashboard', icon: <Home size={17} /> },
      { to: '/provider/bookings',  label: 'Bookings',  icon: <BookOpen size={17} /> },
      { to: '/provider/earnings',  label: 'Earnings',  icon: <BarChart2 size={17} /> },
    ] : [
      { to: '/dashboard',  label: 'Home',     icon: <Home size={17} /> },
      { to: '/services',   label: 'Services', icon: <Search size={17} /> },
      { to: '/bookings',   label: 'Bookings', icon: <BookOpen size={17} /> },
      { to: '/chat',       label: 'Chat',     icon: <MessageSquare size={17} /> },
    ]
  ) : [
    { to: '/',        label: 'Home' },
    { to: '/services',label: 'Services' },
    { to: '/about',   label: 'About' },
  ];

  const profilePath = user?.role === 'provider' ? '/provider/profile' : '/profile';
  const settingsPath = user?.role === 'provider' ? '/provider/settings' : '/settings';

  const dropdownItems = [
    { to: profilePath,  label: 'My Profile',    icon: <User size={15} /> },
    { to: settingsPath, label: 'Settings',      icon: <Settings size={15} /> },
    { to: '/help',     label: 'Help & Support', icon: <HelpCircle size={15} /> },
  ];

  return (
    <nav style={{
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div className="navbar-inner" style={{ display: 'flex', alignItems: 'center', height: 64, gap: 12 }}>

        {/* ── Sidebar hamburger toggle (authenticated only) ── */}
        {isAuthenticated && (
          <button
            onClick={toggleSidebar}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: 'transparent', border: '1.5px solid var(--border)',
              cursor: 'pointer', color: 'var(--text-light)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--primary)';
              e.currentTarget.style.color = 'var(--text-dark)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-light)';
            }}
          >
            <Menu size={18} />
          </button>
        )}

        {/* ── Logo ── */}
        <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--dark-accent), #7fa8ff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>🏠</div>
          <span style={{ fontFamily: "'Plus Jakarta Sans'", fontWeight: 800, fontSize: 18, color: 'var(--text-dark)' }}>
            Home<span style={{ color: '#5a85ff' }}>Ease</span>
          </span>
        </NavLink>

        {/* ── Desktop Nav Links ── */}
        <div style={{ display: 'flex', gap: 4, flex: 1 }} className="desktop-nav">
          {navLinks.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 13px', borderRadius: 8,
                fontSize: 14, fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--text-dark)' : 'var(--text-light)',
                background: isActive ? 'var(--primary)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.2s',
              })}
            >
              {link.icon}{link.label}
            </NavLink>
          ))}
        </div>

        {/* ── Right side ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {isAuthenticated ? (
            <>
              {/* Notifications bell */}
              <NavLink
                to="/notifications"
                style={{ position: 'relative', display: 'flex', padding: 8, borderRadius: 8, color: 'var(--text-light)', textDecoration: 'none', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    minWidth: 18, height: 18, borderRadius: '50%',
                    background: 'var(--error)', color: 'white',
                    fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid white',
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </NavLink>

              {/* Profile dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px 6px 6px', border: '1.5px solid var(--border)',
                    borderRadius: 10, background: 'white', cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <Avatar src={user?.avatar?.url} name={user?.name} size="sm" />
                  <span className="navbar-user-name" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>{user?.name?.split(' ')[0]}</span>
                  <ChevronDown size={14} color="var(--text-light)" style={{ transition: 'transform 0.2s', transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: 'absolute', right: 0, top: '110%',
                        background: 'white', borderRadius: 14,
                        border: '1px solid var(--border)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
                        width: 220, padding: 10, zIndex: 200,
                      }}
                    >
                      {/* User Info Header — no email, just name + role */}
                      <div style={{ padding: '10px 8px 12px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar src={user?.avatar?.url} name={user?.name} size="md" />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', lineHeight: 1.3 }}>
                              {user?.name}
                            </div>
                            <span style={{
                              display: 'inline-block', marginTop: 4,
                              fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                              padding: '2px 8px', borderRadius: 6,
                              background: user?.role === 'admin' ? '#fee2e2' : user?.role === 'provider' ? '#dbeafe' : '#d1fae5',
                              color: user?.role === 'admin' ? '#dc2626' : user?.role === 'provider' ? '#2563eb' : '#059669',
                            }}>
                              {user?.role}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      {dropdownItems.map(item => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setProfileOpen(false)}
                          style={({ isActive }) => ({
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 10px', borderRadius: 8,
                            fontSize: 13, color: isActive ? 'var(--dark-accent)' : 'var(--text-dark)',
                            textDecoration: 'none', fontWeight: 500,
                            background: isActive ? 'var(--primary)' : 'transparent',
                            transition: 'all 0.15s',
                          })}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ color: 'var(--text-light)' }}>{item.icon}</span>
                          {item.label}
                        </NavLink>
                      ))}

                      <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }} />

                      <button
                        onClick={() => { setProfileOpen(false); handleLogout(); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 10px', borderRadius: 8, fontSize: 13,
                          color: 'var(--error)', background: 'transparent',
                          border: 'none', cursor: 'pointer', width: '100%',
                          fontWeight: 500, transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <LogOut size={15} /> Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <NavLink to="/login"    className="btn btn-outline btn-sm">Login</NavLink>
              <NavLink to="/register" className="btn btn-primary btn-sm">Sign Up</NavLink>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => isAuthenticated ? toggleSidebar() : setMobileOpen(!mobileOpen)}
            className="btn btn-icon"
            style={{ display: 'none', background: 'var(--bg)' }}
            id="mobile-menu-btn"
          >
            {(isAuthenticated ? sidebarOpen : mobileOpen) ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── Mobile Nav ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', borderTop: '1px solid var(--border)', background: 'white' }}
          >
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {isAuthenticated && (
                <button
                  onClick={() => { toggleSidebar(); setMobileOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, fontSize: 14, color: 'var(--text-dark)', background: 'var(--primary)', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  <Menu size={17} /> {sidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}
                </button>
              )}
              {navLinks.map(link => (
                <NavLink key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 12px', borderRadius: 8, fontSize: 14, fontWeight: 500,
                    color: isActive ? 'var(--text-dark)' : 'var(--text-light)',
                    background: isActive ? 'var(--primary)' : 'transparent',
                    textDecoration: 'none',
                  })}
                >
                  {link.icon}{link.label}
                </NavLink>
              ))}
              {isAuthenticated && (
                <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, fontSize: 14, color: 'var(--error)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                  <LogOut size={17} /> Logout
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </nav>
  );
};

export default Navbar;

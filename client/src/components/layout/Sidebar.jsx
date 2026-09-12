import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  AlertCircle, BarChart2, Bell, BookOpen, Briefcase, CalendarClock, Camera,
  ChevronDown, ClipboardList, DollarSign, FileBadge, Home, LogOut, MessageSquare,
  Settings, Shield, ShieldCheck, Star, User, Users, Wrench,
} from 'lucide-react';
import { useSidebar } from '../../context/useSidebar';
import { clearCredentials } from '../../redux/authSlice';
import toast from 'react-hot-toast';

const customerGroups = [
  { label: 'Main', items: [
    { to: '/dashboard', label: 'Dashboard', icon: Home },
    { to: '/services', label: 'Find Services', icon: Briefcase },
    { to: '/bookings', label: 'Bookings', icon: BookOpen },
  ] },
  { label: 'Communication', items: [
    { to: '/chat', label: 'Messages', icon: MessageSquare },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ] },
  { label: 'Account', items: [{ to: '/profile', label: 'Profile', icon: User }] },
];

const providerGroups = [
  {
    label: 'MAIN',
    items: [
      {
        id: 'dashboard',
        to: '/provider/dashboard',
        label: 'Dashboard',
        icon: Home,
        description: 'Overview',
      },
    ],
  },
  {
    label: 'WORK',
    items: [
      {
        id: 'bookings',
        label: 'Bookings',
        icon: BookOpen,
        description: 'Manage bookings',
        children: [
          { to: '/provider/bookings', label: 'All' },
          { to: '/provider/active-jobs', label: 'Active' },
          { to: '/provider/history', label: 'Completed' },
        ],
      },
      {
        id: 'services',
        to: '/provider/services',
        label: 'My Services',
        icon: Wrench,
        description: 'Services & Pricing',
      },
      {
        id: 'schedule',
        to: '/provider/availability',
        label: 'Schedule',
        icon: CalendarClock,
        description: 'Availability & Hours',
      },
    ],
  },
  {
    label: 'BUSINESS',
    items: [
      {
        id: 'earnings',
        to: '/provider/earnings',
        label: 'Earnings',
        icon: DollarSign,
        description: 'Revenue & Settlements',
      },
      {
        id: 'reviews',
        to: '/provider/reviews',
        label: 'Reviews',
        icon: Star,
        description: 'Customer Feedback',
      },
    ],
  },
  {
    label: 'VERIFICATION',
    items: [
      {
        id: 'verification',
        label: 'Verification Center',
        icon: ShieldCheck,
        description: 'Identity & Skills',
        children: [
          { to: '/provider/certificates', label: 'Overview' },
          { to: '/provider/certificates?tab=identity', label: 'Identity Verification' },
          { to: '/provider/certificates?tab=skills', label: 'Experience & Skills' },
          { to: '/provider/certificates?tab=documents', label: 'Documents' },
          { to: '/provider/certificates?tab=status', label: 'Verification Status' },
        ],
      },
    ],
  },
  {
    label: 'COMMUNICATION',
    items: [
      {
        id: 'messages',
        to: '/chat',
        label: 'Messages',
        icon: MessageSquare,
        description: 'Customer Chats',
      },
      {
        id: 'notifications',
        to: '/provider/notifications',
        label: 'Notifications',
        icon: Bell,
        description: 'Alerts',
      },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      {
        id: 'profile',
        to: '/provider/profile',
        label: 'Profile',
        icon: User,
        description: 'Personal & Professional',
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: Settings,
        description: 'Account & Security',
        children: [
          { to: '/provider/settings', label: 'Account' },
          { to: '/provider/settings?tab=security', label: 'Security' },
        ],
      },
      {
        id: 'logout',
        label: 'Logout',
        icon: LogOut,
        description: 'Sign out',
        isLogout: true,
      },
    ],
  },
];

const adminGroups = [
  { label: 'Admin', items: [
    { to: '/admin/dashboard', label: 'Dashboard', icon: BarChart2 },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/providers', label: 'Providers', icon: Shield },
    { to: '/admin/bookings', label: 'Bookings', icon: BookOpen },
    { to: '/admin/services', label: 'Services', icon: ClipboardList },
    { to: '/admin/disputes', label: 'Disputes', icon: AlertCircle },
  ] },
];

const isChildActive = (childTo, location) => {
  const currentPath = location.pathname;
  const currentSearch = location.search;
  const currentHash = location.hash;

  if (childTo.includes('?')) {
    const [targetPath, targetQuery] = childTo.split('?');
    if (currentPath !== targetPath) return false;
    const targetParams = new URLSearchParams(targetQuery);
    const currentParams = new URLSearchParams(currentSearch);
    for (const [key, val] of targetParams.entries()) {
      if (currentParams.get(key) !== val) return false;
    }
    return true;
  }

  if (childTo.includes('#')) {
    const [targetPath, targetHash] = childTo.split('#');
    if (currentPath !== targetPath) return false;
    return currentHash === `#${targetHash}`;
  }

  if (currentPath === childTo) {
    if (!currentSearch && !currentHash) return true;
    const currentTab = new URLSearchParams(currentSearch).get('tab');
    const currentAction = new URLSearchParams(currentSearch).get('action');
    if (!currentTab && !currentAction && !currentHash) return true;
    return false;
  }

  return false;
};

const isParentActive = (item, location) => {
  if (item.children && item.children.length > 0) {
    return item.children.some(child => isChildActive(child.to, location) || location.pathname === child.to.split('?')[0].split('#')[0]);
  }
  return item.to && location.pathname === item.to;
};

const getGroups = role => {
  if (role === 'admin') return adminGroups;
  if (role === 'provider') return providerGroups;
  return customerGroups;
};

const SidebarItem = ({ item, open, location, onLogout }) => {
  const Icon = item.icon;
  const hasChildren = Boolean(item.children && item.children.length > 0);
  const parentActive = isParentActive(item, location);
  const [isOpen, setIsOpen] = useState(parentActive);

  // Keep active parent expanded whenever route changes
  useEffect(() => {
    if (parentActive) {
      setIsOpen(true);
    }
  }, [parentActive, location.pathname, location.search, location.hash]);

  if (item.isLogout) {
    return (
      <div className="sidebar-tooltip-wrapper">
        <button
          type="button"
          onClick={onLogout}
          className="sidebar-link"
          style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer' }}
          title={!open ? item.label : undefined}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#dc2626';
            e.currentTarget.style.background = '#fef2f2';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <span className="sidebar-link-icon" style={{ color: 'inherit' }}><Icon size={19} /></span>
          {open && (
            <span className="sidebar-link-copy">
              <span className="sidebar-link-label">{item.label}</span>
              {item.description && <span className="sidebar-link-description">{item.description}</span>}
            </span>
          )}
        </button>
        {!open && (
          <span className="sidebar-tooltip">
            <strong>{item.label}</strong>
          </span>
        )}
      </div>
    );
  }

  if (!hasChildren) {
    return (
      <div className="sidebar-tooltip-wrapper">
        <NavLink
          to={item.to}
          end={item.to.endsWith('dashboard')}
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          title={!open ? item.label : undefined}
        >
          <span className="sidebar-link-icon"><Icon size={19} /></span>
          {open && (
            <span className="sidebar-link-copy">
              <span className="sidebar-link-label">{item.label}</span>
              {item.description && <span className="sidebar-link-description">{item.description}</span>}
            </span>
          )}
        </NavLink>
        {!open && (
          <span className="sidebar-tooltip">
            <strong>{item.label}</strong>
            {item.description && <small>{item.description}</small>}
          </span>
        )}
      </div>
    );
  }

  // Parent with expandable submenus
  return (
    <div className="sidebar-tooltip-wrapper" style={{ marginBottom: 2 }}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`sidebar-link${parentActive ? ' active' : ''}`}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          background: parentActive ? '#e2eafc' : 'transparent',
          borderColor: parentActive ? 'rgba(37, 99, 235, 0.18)' : 'transparent',
          color: parentActive ? '#1d4ed8' : 'inherit',
          padding: '8px 12px',
        }}
        title={!open ? item.label : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span className="sidebar-link-icon" style={{ color: parentActive ? '#2563eb' : 'inherit' }}>
            <Icon size={19} />
          </span>
          {open && (
            <span className="sidebar-link-copy">
              <span className="sidebar-link-label" style={{ fontWeight: parentActive ? 800 : 700 }}>
                {item.label}
              </span>
              {item.description && <span className="sidebar-link-description">{item.description}</span>}
            </span>
          )}
        </div>
        {open && (
          <ChevronDown
            size={16}
            style={{
              color: parentActive ? '#2563eb' : '#94a3b8',
              transition: 'transform 200ms ease',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              flexShrink: 0,
            }}
          />
        )}
      </button>

      {/* Floating flyout tooltip when sidebar is collapsed */}
      {!open && (
        <span className="sidebar-tooltip" style={{ minWidth: 175, background: '#ffffff', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(15,23,42,0.12)' }}>
          <strong style={{ display: 'block', marginBottom: 6, color: '#1d4ed8', borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>{item.label}</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
            {item.children.map(child => {
              const active = isChildActive(child.to, location);
              return (
                <NavLink
                  key={child.to}
                  to={child.to}
                  style={{
                    color: active ? '#1d4ed8' : '#475569',
                    fontWeight: active ? 750 : 500,
                    fontSize: 12,
                    textDecoration: 'none',
                    padding: '3px 6px',
                    borderRadius: 6,
                    background: active ? '#e2eafc' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: active ? '#2563eb' : '#cbd5e1' }} />
                  {child.label}
                </NavLink>
              );
            })}
          </div>
        </span>
      )}

      {/* Expanded submenu children */}
      {open && isOpen && (
        <div
          style={{
            marginLeft: 22,
            paddingLeft: 10,
            borderLeft: '2px solid #e2eafc',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            marginTop: 3,
            marginBottom: 6,
          }}
        >
          {item.children.map(child => {
            const active = isChildActive(child.to, location);
            return (
              <NavLink
                key={child.to}
                to={child.to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: active ? 750 : 600,
                  color: active ? '#1d4ed8' : '#64748b',
                  background: active ? '#e2eafc' : 'transparent',
                  border: active ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.background = '#eff6ff';
                    e.currentTarget.style.color = '#1d4ed8';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#64748b';
                  }
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: active ? '#2563eb' : '#cbd5e1',
                    flexShrink: 0,
                  }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {child.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
};

const SidebarGroup = ({ group, open, location, onLogout }) => (
  <section className="sidebar-group">
    {open && <div className="sidebar-group-label">{group.label}</div>}
    <div className="sidebar-group-items">
      {group.items.map(item => (
        <SidebarItem
          key={item.id || item.to || item.label}
          item={item}
          open={open}
          location={location}
          onLogout={onLogout}
        />
      ))}
    </div>
  </section>
);

const SidebarFooter = ({ open, role }) => (
  <div className="sidebar-footer">
    <div className="sidebar-footer-badge">
      <span>{role === 'provider' ? 'Pro' : role === 'admin' ? 'Admin' : 'HE'}</span>
      {open && (
        <div>
          <strong>{role === 'provider' ? 'Provider Panel' : role === 'admin' ? 'Admin Console' : 'HomeEase'}</strong>
          <small>{role === 'provider' ? 'Business workspace' : 'Secure workspace'}</small>
        </div>
      )}
    </div>
  </div>
);

const Sidebar = () => {
  const { user } = useSelector(s => s.auth);
  const { open, toggle } = useSidebar();
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const role = user?.role || 'customer';
  const groups = getGroups(role);

  const handleLogout = () => {
    dispatch(clearCredentials());
    navigate('/login');
    toast.success('Logged out successfully');
  };

  return (
    <>
      <aside className={`sidebar${open ? '' : ' sidebar-collapsed'}`} aria-label={`${role} navigation`}>
        <div className="sidebar-scroll">
          <div className="sidebar-heading">
            <span className="sidebar-heading-mark">{role === 'provider' ? 'P' : role === 'admin' ? 'A' : 'H'}</span>
            {open && (
              <div>
                <strong>{role === 'provider' ? 'Provider Dashboard' : role === 'admin' ? 'Admin' : 'Menu'}</strong>
                <small>{role === 'provider' ? 'Manage your business' : 'Navigate workspace'}</small>
              </div>
            )}
          </div>
          <nav className="sidebar-nav">
            {groups.map(group => (
              <SidebarGroup
                key={group.label}
                group={group}
                open={open}
                location={location}
                onLogout={handleLogout}
              />
            ))}
          </nav>
        </div>
        <SidebarFooter open={open} role={role} />
      </aside>
      {open && <button className="sidebar-mobile-backdrop" aria-label="Close sidebar" onClick={toggle} />}
    </>
  );
};

export default Sidebar;


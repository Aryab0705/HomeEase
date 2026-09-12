import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Lock, Shield, Eye, EyeOff, Check, AlertCircle,
  LogOut, Trash2, Sliders, Radio, MapPin, Save, User,
  Mail, Phone, ShieldCheck, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import AppLayout from '../../components/layout/AppLayout';
import { PageSpinner } from '../../components/common/Spinner';
import { PageHeader, PanelCard } from './ProviderPanelComponents';
import API from '../../services/api';
import { clearCredentials } from '../../redux/authSlice';

// ── Custom iOS-Style Toggle Switch ───────────────────────────────────────────
const ToggleSwitch = ({ checked, onChange, disabled = false, id }) => (
  <button
    type="button"
    role="switch"
    id={id}
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    style={{
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      width: 44,
      height: 24,
      borderRadius: 9999,
      transition: 'background-color 200ms ease',
      backgroundColor: checked ? '#2563eb' : '#cbd5e1',
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      padding: 2,
      opacity: disabled ? 0.6 : 1,
      flexShrink: 0,
    }}
  >
    <span
      style={{
        display: 'inline-block',
        width: 20,
        height: 20,
        borderRadius: '50%',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'transform 200ms ease',
        transform: checked ? 'translateX(20px)' : 'translateX(0px)',
      }}
    />
  </button>
);

const ProviderSettings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.auth.user);

  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'security' ? 'security' : 'account';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Provider Settings State
  const [settings, setSettings] = useState({
    notificationPreferences: {
      bookingRequests: true,
      messages: true,
      payments: true,
      verification: true,
      announcements: true,
      emailNotifications: true,
      smsNotifications: false,
    },
    emergencyService: false,
    serviceRadius: 20,
    isAvailable: true,
    emergencyAvailability: false,
    user: null,
  });

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [savingPassword, setSavingPassword] = useState(false);

  // Load Settings from Backend API
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data } = await API.get('/providers/me/settings');
      if (data.data) {
        setSettings(prev => ({
          ...prev,
          ...data.data,
          notificationPreferences: {
            ...prev.notificationPreferences,
            ...(data.data.notificationPreferences || {}),
          },
        }));
      }
    } catch (err) {
      console.error('Failed to load provider settings:', err);
      toast.error(err?.response?.data?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Save Settings to Backend API
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        notificationPreferences: settings.notificationPreferences,
        emergencyService: settings.emergencyService,
        serviceRadius: Number(settings.serviceRadius),
        isAvailable: settings.isAvailable,
        emergencyAvailability: settings.emergencyAvailability,
      };

      const { data } = await API.put('/providers/me/settings', payload);
      if (data.data) {
        setSettings(prev => ({
          ...prev,
          ...data.data,
        }));
      }
      toast.success('Settings saved successfully and updated!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  // Handle Notification Toggle
  const handleToggleNotification = (key) => {
    setSettings(prev => ({
      ...prev,
      notificationPreferences: {
        ...prev.notificationPreferences,
        [key]: !prev.notificationPreferences[key],
      },
    }));
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setSavingPassword(true);
    try {
      await API.put('/users/change-password', {
        currentPassword,
        newPassword,
      });
      toast.success('Password changed successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out of your provider dashboard?')) {
      dispatch(clearCredentials());
      toast.success('Logged out successfully');
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
          <PageSpinner />
        </div>
      </AppLayout>
    );
  }

  const notificationChannels = [
    {
      key: 'bookingRequests',
      label: 'Booking Requests',
      desc: 'Receive instant notifications when customers book a new site visit.',
      badge: 'High Priority',
    },
    {
      key: 'messages',
      label: 'Customer Messages',
      desc: 'Get notified when customers send direct questions or location updates.',
    },
    {
      key: 'payments',
      label: 'Payments & Settlements',
      desc: 'Alerts when site visit consultation fee is paid or credited to your ledger.',
      badge: 'Financial',
    },
    {
      key: 'verification',
      label: 'Verification & Badges',
      desc: 'Status updates regarding identity verification, licenses, and reviews.',
    },
    {
      key: 'announcements',
      label: 'Platform Announcements',
      desc: 'News on platform features, seasonal bonuses, and updates.',
    },
    {
      key: 'emailNotifications',
      label: 'Email Summaries',
      desc: 'Send copy of critical booking alerts and receipts to your registered email.',
    },
  ];

  return (
    <AppLayout>
      <div className="provider-workspace">
        <PageHeader
          eyebrow="Preferences"
          title="Account Settings"
          description="Manage service operations, notification delivery channels, password, and account security."
          actions={
            activeTab === 'account' ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveSettings}
                disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            ) : null
          }
        />

        {/* Tab Navigation Pill Bar */}
        <div className="provider-tabs" style={{ marginBottom: 24 }}>
          <button
            type="button"
            className={activeTab === 'account' ? 'active' : ''}
            onClick={() => setSearchParams({})}
          >
            <Sliders size={16} style={{ marginRight: 6 }} />
            Account & Operations
          </button>
          <button
            type="button"
            className={activeTab === 'security' ? 'active' : ''}
            onClick={() => setSearchParams({ tab: 'security' })}
          >
            <Lock size={16} style={{ marginRight: 6 }} />
            Security & Access
          </button>
        </div>

        {activeTab === 'account' ? (
          <div className="provider-grid provider-grid-2">
            {/* ── CARD 1: Service Operations & Availability ── */}
            <PanelCard
              title="Service Operations & Dispatch"
              subtitle="Control your online dispatch status and emergency job acceptance."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Availability Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: settings.isAvailable ? '#f0fdf4' : '#f8fafc',
                    border: settings.isAvailable ? '1px solid #bbf7d0' : '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: settings.isAvailable ? '#22c55e' : '#94a3b8',
                          display: 'inline-block',
                        }}
                      />
                      <strong style={{ fontSize: 15, color: 'var(--text-dark)' }}>
                        Working Availability
                      </strong>
                      <span
                        className={`badge ${settings.isAvailable ? 'badge-success' : 'badge-warning'}`}
                        style={{ fontSize: 11 }}
                      >
                        {settings.isAvailable ? 'Online / Active' : 'Paused'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)', lineHeight: 1.4 }}>
                      {settings.isAvailable
                        ? 'Your profile is visible and eligible to receive new site visit bookings.'
                        : 'Temporarily pause incoming bookings without affecting existing scheduled jobs.'}
                    </p>
                  </div>
                  <ToggleSwitch
                    id="toggle-availability"
                    checked={settings.isAvailable}
                    onChange={(val) => setSettings(prev => ({ ...prev, isAvailable: val }))}
                  />
                </div>

                {/* Emergency Service Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: settings.emergencyService ? '#eff6ff' : '#f8fafc',
                    border: settings.emergencyService ? '1px solid #bfdbfe' : '1px solid var(--border)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Zap size={16} color={settings.emergencyService ? '#2563eb' : '#64748b'} />
                      <strong style={{ fontSize: 15, color: 'var(--text-dark)' }}>
                        Instant Emergency Service
                      </strong>
                      {settings.emergencyService && (
                        <span className="badge badge-primary" style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8' }}>
                          24/7 Enabled
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)', lineHeight: 1.4 }}>
                      Accept urgent emergency site visits outside of regular business hours.
                    </p>
                  </div>
                  <ToggleSwitch
                    id="toggle-emergency"
                    checked={settings.emergencyService}
                    onChange={(val) => setSettings(prev => ({ ...prev, emergencyService: val }))}
                  />
                </div>

                {/* Service Radius Slider */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>
                      <MapPin size={16} color="#2563eb" />
                      Service Coverage Radius
                    </label>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: '#1d4ed8',
                        background: '#e2eafc',
                        padding: '4px 10px',
                        borderRadius: 8,
                      }}
                    >
                      {settings.serviceRadius} km
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-light)', margin: '0 0 12px', lineHeight: 1.4 }}>
                    Maximum travel distance from your registered service base for on-site consultation visits.
                  </p>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={settings.serviceRadius}
                    onChange={(e) => setSettings(prev => ({ ...prev, serviceRadius: Number(e.target.value) }))}
                    style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
                    <span>5 km (Local)</span>
                    <span>50 km</span>
                    <span>100 km (Wide Region)</span>
                  </div>
                </div>

                {/* Account Summary Strip */}
                {currentUser && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: '#e2eafc',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#2563eb',
                      }}
                    >
                      <User size={18} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)' }}>
                        {currentUser.name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-light)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span>{currentUser.email}</span>
                        {currentUser.phone && <span>• {currentUser.phone}</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </PanelCard>

            {/* ── CARD 2: Notification Channels & Preferences ── */}
            <PanelCard
              title="Notification Channels"
              subtitle="Choose which platform updates trigger notifications and emails."
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {notificationChannels.map((item, idx) => (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 16,
                      padding: '14px 0',
                      borderBottom: idx < notificationChannels.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <strong style={{ fontSize: 14, color: 'var(--text-dark)' }}>
                          {item.label}
                        </strong>
                        {item.badge && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: '#e2eafc',
                              color: '#1d4ed8',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-light)', lineHeight: 1.4 }}>
                        {item.desc}
                      </p>
                    </div>
                    <ToggleSwitch
                      id={`toggle-${item.key}`}
                      checked={Boolean(settings.notificationPreferences[item.key])}
                      onChange={() => handleToggleNotification(item.key)}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveSettings}
                  disabled={saving}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </PanelCard>
          </div>
        ) : (
          /* ── SECURITY TAB ── */
          <div className="provider-grid provider-grid-2">
            {/* Password Change Card */}
            <PanelCard
              title="Change Password"
              subtitle="Update your dashboard login password. Minimum 8 characters required."
            >
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Current Password */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-dark)' }}>
                    Current Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPasswords.current ? 'text' : 'password'}
                      className="input"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Enter current password"
                      required
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-light)',
                        cursor: 'pointer',
                      }}
                    >
                      {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-dark)' }}>
                    New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      className="input"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Minimum 8 characters"
                      required
                      minLength={8}
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-light)',
                        cursor: 'pointer',
                      }}
                    >
                      {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'var(--text-dark)' }}>
                    Confirm New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      className="input"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Re-enter new password"
                      required
                      minLength={8}
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-light)',
                        cursor: 'pointer',
                      }}
                    >
                      {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingPassword}
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
                  >
                    <Lock size={16} />
                    {savingPassword ? 'Updating Password...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </PanelCard>

            {/* Session & Danger Zone Card */}
            <PanelCard
              title="Session & Danger Zone"
              subtitle="Control active sessions or manage account state."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Active Session Info */}
                <div style={{ padding: 16, borderRadius: 12, background: '#f8fafc', border: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: 14, display: 'block', marginBottom: 4, color: 'var(--text-dark)' }}>
                    Active Provider Session
                  </strong>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-light)', lineHeight: 1.4 }}>
                    Logged in as <strong>{currentUser?.email}</strong> with Provider privileges.
                  </p>
                </div>

                {/* Logout Action */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <strong style={{ display: 'block', fontSize: 14, color: 'var(--text-dark)' }}>
                      End Dashboard Session
                    </strong>
                    <span style={{ fontSize: 12.5, color: 'var(--text-light)' }}>
                      Safely log out from this browser session.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleLogout}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>

                {/* Danger Zone */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 12,
                    border: '1px solid #fee2e2',
                    background: '#fff5f5',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <AlertCircle size={18} color="#dc2626" />
                    <strong style={{ color: '#dc2626', fontSize: 14 }}>
                      Deactivate Provider Account
                    </strong>
                  </div>
                  <p style={{ fontSize: 12.5, color: '#7f1d1d', margin: '0 0 14px', lineHeight: 1.4 }}>
                    Deactivating your provider account pauses all listings, hides you from customer search, and marks active availability as offline. Existing completed bookings ledger will remain accessible for records.
                  </p>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to pause and deactivate your provider account? You can reactivate anytime by toggling working availability back on.')) {
                        setSettings(prev => ({ ...prev, isAvailable: false }));
                        API.put('/providers/me/settings', { isAvailable: false })
                          .then(() => toast.success('Provider account deactivated and paused.'))
                          .catch(() => toast.error('Failed to update status'));
                      }
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Trash2 size={16} />
                    Deactivate Account
                  </button>
                </div>
              </div>
            </PanelCard>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ProviderSettings;

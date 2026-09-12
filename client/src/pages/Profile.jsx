import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import { User, Mail, Phone, Lock, Camera, Eye, EyeOff } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import Avatar from '../components/common/Avatar';
import { updateUser } from '../redux/authSlice';
import API from '../services/api';
import toast from 'react-hot-toast';

const Profile = () => {
  const dispatch    = useDispatch();
  const { user }    = useSelector(s => s.auth);
  const [saving, setSaving]       = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [showPass, setShowPass]   = useState({ current: false, new: false, confirm: false });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ defaultValues: { name: user?.name, phone: user?.phone } });
  const { register: passReg, handleSubmit: passSubmit, reset: passReset, watch: passWatch, formState: { errors: passErrors } } = useForm();

  useEffect(() => { reset({ name: user?.name, phone: user?.phone }); }, [reset, user]);

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] }, maxFiles: 1,
    onDrop: async (files) => {
      const file = files[0];
      setAvatarPreview(URL.createObjectURL(file));
      const fd = new FormData();
      fd.append('image', file); // Changed from 'avatar' to 'image' to match backend Multer middleware
      try {
        const res = await API.put('/users/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        dispatch(updateUser({ avatar: res.data.data.avatar }));
        toast.success('Avatar updated!');
      } catch (err) {
        console.error('Avatar upload error:', err);
        toast.error(err?.response?.data?.message || 'Avatar upload failed. Cloudinary not configured.');
        setAvatarPreview(null);
      }
    },
  });

  const onSave = async (data) => {
    setSaving(true);
    try {
      const res = await API.put('/users/profile', data);
      dispatch(updateUser(res.data.data));
      toast.success('Profile updated!');
    } catch (e) { toast.error(e?.response?.data?.message || 'Failed to update'); }
    finally { setSaving(false); }
  };

  const onPassword = async (data) => {
    setPassLoading(true);
    try {
      await API.put('/users/change-password', data);
      toast.success('Password changed!');
      passReset();
    } catch (e) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setPassLoading(false); }
  };

  return (
    <AppLayout>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 26 }}>My Profile</h1>
            <p style={{ color: 'var(--text-light)', marginTop: 4 }}>Manage your personal information and security</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
            {/* Profile info */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 17, marginBottom: 24 }}>Personal Information</h2>

              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
                <div style={{ position: 'relative' }}>
                  {avatarPreview || user?.avatar?.url ? (
                    <img src={avatarPreview || user.avatar.url} alt="avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <Avatar name={user?.name} size="2xl" />
                  )}
                  <div {...getRootProps()} style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--dark-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid white' }}>
                    <input {...getInputProps()} />
                    <Camera size={13} color="var(--text-dark)" />
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{user?.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 2, textTransform: 'capitalize' }}>{user?.role}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>Click camera to change photo</div>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSave)}>
                <div className="form-group">
                  <label className="label">Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                    <input className={`input ${errors.name ? 'input-error' : ''}`} style={{ paddingLeft: 36 }}
                      {...register('name', { required: 'Name is required' })} />
                  </div>
                  {errors.name && <p className="error-text">{errors.name.message}</p>}
                </div>

                <div className="form-group">
                  <label className="label">Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                    <input className="input" style={{ paddingLeft: 36, background: 'var(--bg)', cursor: 'not-allowed' }} value={user?.email} disabled />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>Email cannot be changed</p>
                </div>

                <div className="form-group">
                  <label className="label">Phone Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                    <input className="input" style={{ paddingLeft: 36 }} type="tel" {...register('phone')} />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </motion.div>

            {/* Change password */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card" style={{ padding: 28 }}>
              <h2 style={{ fontSize: 17, marginBottom: 24 }}>Change Password</h2>

              <form onSubmit={passSubmit(onPassword)}>
                <div className="form-group">
                  <label className="label">Current Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                    <input className={`input ${passErrors.currentPassword ? 'input-error' : ''}`}
                      type={showPass.current ? 'text' : 'password'} style={{ paddingLeft: 36, paddingRight: 40 }}
                      {...passReg('currentPassword', { required: 'Current password is required' })} />
                    <button type="button" onClick={() => setShowPass(p => ({ ...p, current: !p.current }))}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                      {showPass.current ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {passErrors.currentPassword && <p className="error-text">{passErrors.currentPassword.message}</p>}
                </div>

                {showPasswordFields && (
                  <>
                    <div className="form-group">
                      <label className="label">New Password</label>
                      <div style={{ position: 'relative' }}>
                        <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                        <input className={`input ${passErrors.newPassword ? 'input-error' : ''}`}
                          type={showPass.new ? 'text' : 'password'} style={{ paddingLeft: 36, paddingRight: 40 }}
                          {...passReg('newPassword', { required: 'New password is required', minLength: { value: 8, message: 'Min 8 characters' } })} />
                        <button type="button" onClick={() => setShowPass(p => ({ ...p, new: !p.new }))}
                          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                          {showPass.new ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {passErrors.newPassword && <p className="error-text">{passErrors.newPassword.message}</p>}
                    </div>

                    <div className="form-group">
                      <label className="label">Confirm New Password</label>
                      <div style={{ position: 'relative' }}>
                        <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                        <input className={`input ${passErrors.confirmPassword ? 'input-error' : ''}`}
                          type={showPass.confirm ? 'text' : 'password'} style={{ paddingLeft: 36, paddingRight: 40 }}
                          {...passReg('confirmPassword', { required: 'Please confirm password', validate: v => v === passWatch('newPassword') || 'Passwords do not match' })} />
                        <button type="button" onClick={() => setShowPass(p => ({ ...p, confirm: !p.confirm }))}
                          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                          {showPass.confirm ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {passErrors.confirmPassword && <p className="error-text">{passErrors.confirmPassword.message}</p>}
                    </div>
                  </>
                )}

                <button type="button" className="btn btn-outline" style={{ width: '100%', marginBottom: 12 }} onClick={() => setShowPasswordFields(!showPasswordFields)}>
                  {showPasswordFields ? 'Cancel' : 'Change Password'}
                </button>

                {showPasswordFields && (
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={passLoading}>
                    {passLoading ? 'Changing...' : 'Update Password'}
                  </button>
                )}
              </form>

              {/* Account info */}
              <div style={{ marginTop: 28, padding: 16, background: 'var(--bg)', borderRadius: 12 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 12 }}>Account Info</h3>
                {[
                  { label: 'Role', value: user?.role },
                  { label: 'Account Status', value: user?.isBlocked ? 'Blocked' : 'Active', color: user?.isBlocked ? 'var(--error)' : 'var(--success)' },
                  { label: 'Member Since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'N/A' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-light)' }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: r.color || 'var(--text-dark)', textTransform: 'capitalize' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </AppLayout>
  );
};

export default Profile;

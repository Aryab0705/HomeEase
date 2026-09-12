import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, Phone, UserCheck, MapPin, Clock, DollarSign, Briefcase } from 'lucide-react';
import { setCredentials } from '../../redux/authSlice';
import API from '../../services/api';
import toast from 'react-hot-toast';

const SERVICE_CATEGORIES = [
  "Plumbing", "Electrician", "Painting", "Carpenter", "AC Repair",
  "Cleaning", "Renovation", "Appliance Repair", "Pest Control", "Interior Design"
];

const Register = () => {
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [searchParams]            = useSearchParams();
  const dispatch                  = useDispatch();
  const navigate                  = useNavigate();

  const defaultRole = searchParams.get('role') || 'customer';

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { role: defaultRole },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      const res = await API.post('/auth/register', data);
      dispatch(setCredentials(res.data));
      toast.success('Account created successfully!');
      const redirectMap = { admin: '/admin/dashboard', provider: '/provider/dashboard', customer: '/dashboard' };
      navigate(redirectMap[res.data.user.role] || '/dashboard');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 50%, var(--accent) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ width: '100%', maxWidth: 480, padding: 40 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, var(--dark-accent), #7fa8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 12px' }}>🏠</div>
          <h1 style={{ fontSize: 26, marginBottom: 4 }}>Create Account</h1>
          <p style={{ color: 'var(--text-light)', fontSize: 14 }}>Join HomeEase today — it's free!</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Role selector */}
          <div className="form-group">
            <label className="label">I am a</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {['customer', 'provider'].map(role => (
                <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: `2px solid ${watch('role') === role ? 'var(--dark-accent)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', background: watch('role') === role ? 'var(--primary)' : 'white', transition: 'all 0.2s' }}>
                  <input type="radio" value={role} {...register('role')} style={{ display: 'none' }} />
                  <UserCheck size={16} color={watch('role') === role ? '#5a85ff' : 'var(--text-light)'} />
                  <span style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize', color: watch('role') === role ? 'var(--text-dark)' : 'var(--text-light)' }}>{role}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="form-group">
            <label className="label">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input className={`input ${errors.name ? 'input-error' : ''}`} style={{ paddingLeft: 38 }} placeholder="Arjun Sharma"
                {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })} />
            </div>
            {errors.name && <p className="error-text">{errors.name.message}</p>}
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input className={`input ${errors.email ? 'input-error' : ''}`} style={{ paddingLeft: 38 }} placeholder="arjun@example.com" type="email"
                {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })} />
            </div>
            {errors.email && <p className="error-text">{errors.email.message}</p>}
          </div>

          {/* Phone */}
          <div className="form-group">
            <label className="label">Phone Number</label>
            <div style={{ position: 'relative' }}>
              <Phone size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input className="input" style={{ paddingLeft: 38 }} placeholder="98765 43210" type="tel"
                {...register('phone')} />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input className={`input ${errors.password ? 'input-error' : ''}`} style={{ paddingLeft: 38, paddingRight: 44 }}
                type={showPass ? 'text' : 'password'} placeholder="Min 8 characters"
                {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Min 8 characters' } })} />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="error-text">{errors.password.message}</p>}
          </div>

          {/* Provider-specific fields */}
          {selectedRole === 'provider' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: 20, padding: 20, background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-dark)' }}>Provider Details</h3>

              {/* Service Category */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="label">Service Category</label>
                <select className={`input ${errors.serviceCategory ? 'input-error' : ''}`}
                  {...register('serviceCategory', { required: 'Service category is required for providers' })}>
                  <option value="">Select category</option>
                  {SERVICE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                {errors.serviceCategory && <p className="error-text">{errors.serviceCategory.message}</p>}
              </div>

              {/* Experience */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="label">Experience (years)</label>
                <div style={{ position: 'relative' }}>
                  <Briefcase size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                  <input className="input" style={{ paddingLeft: 38 }} type="number" min="0" placeholder="5"
                    {...register('experience', { required: 'Experience is required', min: { value: 0, message: 'Cannot be negative' } })} />
                </div>
                {errors.experience && <p className="error-text">{errors.experience.message}</p>}
              </div>

              {/* Site Visit / Consultation Fee */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="label">Site Visit / Consultation Fee (₹)</label>
                <div style={{ position: 'relative' }}>
                  <DollarSign size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                  <input className="input" style={{ paddingLeft: 38 }} type="number" min="0" placeholder="500"
                    {...register('hourlyRate', { required: 'Site visit fee is required', min: { value: 0, message: 'Cannot be negative' } })} />
                </div>
                {errors.hourlyRate && <p className="error-text">{errors.hourlyRate.message}</p>}
              </div>

              {/* Service Area */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="label">Service Area (City)</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                  <input className="input" style={{ paddingLeft: 38 }} placeholder="Mumbai"
                    {...register('serviceArea', { required: 'Service area is required' })} />
                </div>
                {errors.serviceArea && <p className="error-text">{errors.serviceArea.message}</p>}
              </div>

              {/* About Me */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="label">About Me</label>
                <textarea className="input" rows="3" placeholder="Describe your skills and experience..."
                  {...register('bio', { required: 'Bio is required', maxLength: { value: 500, message: 'Too long' } })}></textarea>
                {errors.bio && <p className="error-text">{errors.bio.message}</p>}
              </div>

              {/* Working Hours */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="label">Working Hours</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ position: 'relative' }}>
                    <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                    <input className="input" style={{ paddingLeft: 38 }} type="time" defaultValue="09:00"
                      {...register('workingHoursStart', { required: 'Working hours are required' })} />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                    <input className="input" style={{ paddingLeft: 38 }} type="time" defaultValue="18:00"
                      {...register('workingHoursEnd', { required: 'Working hours are required' })} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-light)' }}>
          Already have an account? <Link to="/login" style={{ color: '#5a85ff', fontWeight: 600, textDecoration: 'none' }}>Sign In</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Register;

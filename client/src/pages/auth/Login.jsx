import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { setCredentials } from '../../redux/authSlice';
import { initSocket } from '../../services/socket';
import { getRoleFromPath, ROLE_DASHBOARDS } from '../../utils/authStorage';
import API from '../../services/api';
import toast from 'react-hot-toast';

const Login = () => {
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname;

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      const res = await API.post('/auth/login', data);

      if (!res.data?.user || !res.data?.accessToken) {
        throw new Error('Invalid response from server');
      }

      dispatch(setCredentials({ user: res.data.user, accessToken: res.data.accessToken }));

      try { initSocket(res.data.accessToken); } catch {}

      const userName = res.data.user.name?.split(' ')[0] || 'User';
      toast.success(`Welcome back, ${userName}!`);

      const defaultRoute = ROLE_DASHBOARDS[res.data.user.role] || '/dashboard';
      const targetRoute  = from && getRoleFromPath(from) === res.data.user.role ? from : defaultRoute;
      navigate(targetRoute);

    } catch (err) {
      const msg = err?.response?.status === 502
        ? 'API server is offline or cannot connect to MongoDB. Check the backend terminal.'
        : err?.response?.data?.message || err?.message || 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 50%, var(--accent) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{ width: '100%', maxWidth: 440, padding: 40 }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, var(--dark-accent), #7fa8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 12px' }}>🏠</div>
          <h1 style={{ fontSize: 26, marginBottom: 4 }}>Welcome Back</h1>
          <p style={{ color: 'var(--text-light)', fontSize: 14 }}>Sign in to your HomeEase account</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label className="label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input
                className={`input ${errors.email ? 'input-error' : ''}`}
                style={{ paddingLeft: 38 }}
                type="email"
                placeholder="your@email.com"
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                })}
              />
            </div>
            {errors.email && <p className="error-text">{errors.email.message}</p>}
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label className="label" style={{ marginBottom: 0 }}>Password</label>
              <Link to="/forgot-password" style={{ fontSize: 13, color: '#5a85ff', textDecoration: 'none', fontWeight: 500 }}>
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
              <input
                className={`input ${errors.password ? 'input-error' : ''}`}
                style={{ paddingLeft: 38, paddingRight: 44 }}
                type={showPass ? 'text' : 'password'}
                placeholder="Your password"
                {...register('password', { required: 'Password is required' })}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="error-text">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-light)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#5a85ff', fontWeight: 600, textDecoration: 'none' }}>Sign Up</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;

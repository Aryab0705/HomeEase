import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import toast from 'react-hot-toast';

const ForgotPassword = () => {
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const { loading, request } = useApi();
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async ({ email }) => {
    try {
      await request('post', '/auth/forgot-password', { email });
      setSentEmail(email);
      setSent(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not send reset email. Try again.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 50%, var(--accent) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="card" style={{ width: '100%', maxWidth: 420, padding: 40 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, var(--dark-accent), #7fa8ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 12px' }}>🏠</div>
          <h1 style={{ fontSize: 24, marginBottom: 4 }}>{sent ? 'Check Your Email' : 'Forgot Password?'}</h1>
          <p style={{ color: 'var(--text-light)', fontSize: 14 }}>
            {sent ? `We sent a reset link to ${sentEmail}` : "Enter your email and we'll send you a reset link"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle size={36} color="#22C55E" />
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '14px 16px', marginBottom: 24, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-light)', lineHeight: 1.6 }}>
                Didn't receive it? Check your spam folder or wait a few minutes.
              </div>
              <button onClick={() => setSent(false)} className="btn btn-outline btn-lg" style={{ width: '100%' }}>
                Try a different email
              </button>
            </motion.div>
          ) : (
            <motion.form key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSubmit(onSubmit)}>
              <div className="form-group">
                <label className="label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                  <input className={`input ${errors.email ? 'input-error' : ''}`} style={{ paddingLeft: 38 }} type="email" placeholder="your@email.com"
                    {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })} />
                </div>
                {errors.email && <p className="error-text">{errors.email.message}</p>}
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <Link to="/login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24, fontSize: 14, color: 'var(--text-light)', textDecoration: 'none', fontWeight: 500 }}>
          <ArrowLeft size={15} /> Back to Sign In
        </Link>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;

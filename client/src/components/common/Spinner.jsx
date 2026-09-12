// Spinner.jsx — Loading indicators for HomeEase
// Provides: default Spinner (legacy), PageSpinner (full-screen), InlineSpinner (inline)
import { motion } from 'framer-motion';

// ─── Legacy default spinner (retained for backward compat) ──────────────────
const Spinner = ({ size = 36, color = 'var(--dark-accent)' }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
    <div
      style={{
        width: size,
        height: size,
        border: `3px solid var(--primary)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ─── Full-screen page-level spinner (used by Suspense fallback) ──────────────
export const PageSpinner = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}
  >
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: '3px solid var(--primary)',
        borderTopColor: 'var(--dark-accent)',
      }}
    />
  </div>
);

// ─── Small inline spinner (e.g. inside buttons or cards) ────────────────────
export const InlineSpinner = ({ size = 20 }) => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      border: '2px solid var(--accent)',
      borderTopColor: 'var(--dark-accent)',
      display: 'inline-block',
    }}
  />
);

export default Spinner;
